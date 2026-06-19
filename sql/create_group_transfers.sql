-- ═══════════════════════════════════════════════
-- TABLA: group_transfer_requests
-- Gestiona las solicitudes de transferencia de
-- titularidad de un grupo entre anfitriones.
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.group_transfer_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    TEXT NOT NULL
                    REFERENCES public.groups(id)
                    ON DELETE CASCADE,
    from_user_id UUID NOT NULL
                    REFERENCES auth.users(id)
                    ON DELETE CASCADE,
    to_user_id   UUID NOT NULL
                    REFERENCES auth.users(id)
                    ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',
                        'accepted',
                        'rejected',
                        'cancelled'
                    )),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transfers_group
    ON public.group_transfer_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_user
    ON public.group_transfer_requests(to_user_id)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transfers_from_user
    ON public.group_transfer_requests(from_user_id)
    WHERE status = 'pending';

-- Único pendiente por grupo: índice parcial (solo status='pending')
-- Permite historial ilimitado de aceptadas/rechazadas
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_transfer
    ON public.group_transfer_requests(group_id)
    WHERE status = 'pending';

-- Habilitar RLS
ALTER TABLE public.group_transfer_requests
    ENABLE ROW LEVEL SECURITY;

-- ── POLÍTICAS RLS ─────────────────────────────

-- El anfitrión origen puede ver sus transferencias
-- El destinatario puede ver las que le llegan
-- Los admins ven todo
DROP POLICY IF EXISTS "transfers_select"
    ON public.group_transfer_requests;
CREATE POLICY "transfers_select"
    ON public.group_transfer_requests
    FOR SELECT TO authenticated
    USING (
        from_user_id = auth.uid()
        OR to_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('SUPER_ADMIN', 'PASTOR',
                         'ENCARGADO_GRUPOS', 'ADMIN_GROUPS')
        )
    );

-- Solo el anfitrión origen puede crear la solicitud
DROP POLICY IF EXISTS "transfers_insert"
    ON public.group_transfer_requests;
CREATE POLICY "transfers_insert"
    ON public.group_transfer_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        from_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.groups
            WHERE id = group_id
            AND host_id = auth.uid()
            AND status = 'approved'
        )
    );

-- El destinatario puede aceptar/rechazar.
-- El origen puede cancelar.
-- Los admins pueden hacer cualquier cambio.
DROP POLICY IF EXISTS "transfers_update"
    ON public.group_transfer_requests;
CREATE POLICY "transfers_update"
    ON public.group_transfer_requests
    FOR UPDATE TO authenticated
    USING (
        to_user_id = auth.uid()
        OR from_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('SUPER_ADMIN', 'ENCARGADO_GRUPOS',
                         'ADMIN_GROUPS')
        )
    )
    WITH CHECK (
        to_user_id = auth.uid()
        OR from_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('SUPER_ADMIN', 'ENCARGADO_GRUPOS',
                         'ADMIN_GROUPS')
        )
    );

-- Verificar
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'group_transfer_requests'
ORDER BY cmd;
