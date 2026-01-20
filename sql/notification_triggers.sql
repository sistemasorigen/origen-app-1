-- ============================================
-- AUTOMATED NOTIFICATION TRIGGERS
-- For Group Approval Workflow
-- ============================================
-- Run this script in Supabase SQL Editor AFTER add_group_status.sql

-- ============================================
-- PART 1: Create Notifications Table (if not exists)
-- ============================================
-- This table stores system notifications that appear in NotificationCenter.tsx

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    type TEXT DEFAULT 'SYSTEM' CHECK (type IN ('REGISTRATION', 'SYSTEM', 'INQUIRY', 'GROUPS', 'EVENTS', 'ADMIN')),
    read BOOLEAN DEFAULT FALSE,
    target_roles TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by user and read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);


-- ============================================
-- PART 2: Trigger Function - Notify Host on Status Change
-- ============================================
-- When an Admin approves/rejects a group, notify the Host

CREATE OR REPLACE FUNCTION notify_host_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_type TEXT;
    status_label TEXT;
    note_text TEXT;
    admin_user RECORD;
    host_name TEXT;
BEGIN
    -- Only trigger if status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Determine notification type based on new status
        CASE NEW.status
            WHEN 'approved' THEN
                notification_type := 'GROUPS';
                status_label := 'APROBADO ✓';
            WHEN 'rejected' THEN
                notification_type := 'GROUPS';
                status_label := 'RECHAZADO ✗';
            WHEN 'pending' THEN
                notification_type := 'GROUPS';
                status_label := 'PENDIENTE (Re-enviado)';
            ELSE
                notification_type := 'SYSTEM';
                status_label := NEW.status;
        END CASE;
        
        -- Include admin note if present
        IF NEW.admin_note IS NOT NULL AND NEW.admin_note != '' THEN
            note_text := ' Nota del Admin: ' || NEW.admin_note;
        ELSE
            note_text := '';
        END IF;
        
        -- Insert notification for the Host
        INSERT INTO notifications (
            user_id,
            title,
            message,
            details,
            type,
            target_roles,
            metadata
        ) VALUES (
            NEW.host_id,
            'Estado de tu Grupo Actualizado',
            'Tu grupo "' || NEW.name || '" ha cambiado de estado a: ' || status_label || '.' || note_text,
            'ID del grupo: ' || NEW.id,
            notification_type,
            ARRAY['ANFITRION']::TEXT[],
            jsonb_build_object(
                'group_id', NEW.id,
                'group_name', NEW.name,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
        
        -- ============================================
        -- NOTIFY ADMINS when group is RE-SUBMITTED (edited by host, back to pending)
        -- ============================================
        IF NEW.status = 'pending' AND OLD.status = 'rejected' THEN
            -- Get host name for the admin notification
            SELECT name INTO host_name FROM users WHERE id = NEW.host_id;
            IF host_name IS NULL THEN
                host_name := 'Un anfitrión';
            END IF;
            
            -- Notify all admins about the re-submission
            FOR admin_user IN 
                SELECT id FROM users 
                WHERE role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
            LOOP
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    details,
                    type,
                    target_roles,
                    metadata
                ) VALUES (
                    admin_user.id,
                    '🔄 Grupo Re-enviado para Revisión',
                    host_name || ' ha editado y re-enviado el grupo "' || NEW.name || '". Requiere nueva revisión.',
                    'Este grupo fue previamente rechazado y ha sido modificado.',
                    'ADMIN',
                    ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR']::TEXT[],
                    jsonb_build_object(
                        'group_id', NEW.id,
                        'group_name', NEW.name,
                        'host_id', NEW.host_id,
                        'host_name', host_name,
                        'action_required', 'review',
                        'is_resubmission', true
                    )
                );
            END LOOP;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- PART 3: Trigger Function - Notify Admins on New Request
-- ============================================
-- When a Host creates a new group (pending), notify all admins

CREATE OR REPLACE FUNCTION notify_admins_on_new_group()
RETURNS TRIGGER AS $$
DECLARE
    admin_user RECORD;
    host_name TEXT;
BEGIN
    -- Only trigger for pending groups (new submissions)
    IF NEW.status = 'pending' OR NEW.status IS NULL THEN
        
        -- Get host name for the notification
        SELECT name INTO host_name FROM users WHERE id = NEW.host_id;
        IF host_name IS NULL THEN
            host_name := 'Un anfitrión';
        END IF;
        
        -- Loop through all admin users and create notifications
        FOR admin_user IN 
            SELECT id FROM users 
            WHERE role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
        LOOP
            INSERT INTO notifications (
                user_id,
                title,
                message,
                details,
                type,
                target_roles,
                metadata
            ) VALUES (
                admin_user.id,
                '📋 Nueva Solicitud de Grupo',
                host_name || ' ha creado el grupo "' || NEW.name || '". Pendiente de revisión.',
                'Ubicación: ' || COALESCE(NEW.location, 'No especificada') || ' | Horario: ' || COALESCE(NEW.meeting_day, 'No especificado') || ' ' || COALESCE(NEW.meeting_time, ''),
                'ADMIN',
                ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR']::TEXT[],
                jsonb_build_object(
                    'group_id', NEW.id,
                    'group_name', NEW.name,
                    'host_id', NEW.host_id,
                    'host_name', host_name,
                    'action_required', 'review'
                )
            );
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- PART 4: Create the Triggers
-- ============================================

-- Drop existing triggers if they exist (for clean re-runs)
DROP TRIGGER IF EXISTS trigger_notify_host_on_status_change ON groups;
DROP TRIGGER IF EXISTS trigger_notify_admins_on_new_group ON groups;

-- Trigger 1: After UPDATE on groups - notify host of status changes
CREATE TRIGGER trigger_notify_host_on_status_change
    AFTER UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION notify_host_on_status_change();

-- Trigger 2: After INSERT on groups - notify admins of new pending groups
CREATE TRIGGER trigger_notify_admins_on_new_group
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_on_new_group();


-- ============================================
-- PART 5: Test Queries (Optional - Comment out after testing)
-- ============================================

-- Check if triggers exist:
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'groups';

-- View recent notifications:
-- SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;


-- ============================================
-- DONE!
-- ============================================
-- The following notifications will now be automatic:
-- 
-- 1. When Admin approves/rejects a group:
--    → Host receives notification with status change and any admin note
--
-- 2. When Host creates a new group:
--    → All admins (SUPER_ADMIN, ADMIN_GROUPS, PASTOR) get notified
--
-- 3. When Host re-submits a rejected group:
--    → Admins get notified (via INSERT trigger on status back to pending)
