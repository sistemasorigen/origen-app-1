-- ==============================================================================
-- SCHEMA RESET SCRIPT FOR ORIGEN APP
-- ==============================================================================
-- CAUTION: This script will DROP ALL EXISTING TABLES relating to the app.
-- Use this to reset the database to a clean state matching types.ts.
-- ==============================================================================

-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DROP EVERYTHING (Reverse order of dependency)
-- =======================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_notifications CASCADE;

DROP TABLE IF EXISTS public.app_events CASCADE;

DROP TABLE IF EXISTS public.loans CASCADE;
DROP TABLE IF EXISTS public.child_presentations CASCADE;
DROP TABLE IF EXISTS public.baptisms CASCADE;
DROP TABLE IF EXISTS public.info_point_movements CASCADE;
DROP TABLE IF EXISTS public.info_point_products CASCADE;

DROP TABLE IF EXISTS public.store_order_items CASCADE;
DROP TABLE IF EXISTS public.store_orders CASCADE;
DROP TABLE IF EXISTS public.store_products CASCADE;
DROP TABLE IF EXISTS public.store_events CASCADE;

DROP TABLE IF EXISTS public.alabanza_playback_records CASCADE;
DROP TABLE IF EXISTS public.alabanza_applications CASCADE;
DROP TABLE IF EXISTS public.alabanza_songs CASCADE;
DROP TABLE IF EXISTS public.alabanza_artists CASCADE;
DROP TABLE IF EXISTS public.alabanza_categories CASCADE;

DROP TABLE IF EXISTS public.group_registrations CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.leader_applications CASCADE;

DROP TABLE IF EXISTS public.users CASCADE;

-- Drop Types/Enums
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.product_type CASCADE;
DROP TYPE IF EXISTS public.movement_type CASCADE;
DROP TYPE IF EXISTS public.pending_status CASCADE;
DROP TYPE IF EXISTS public.event_type CASCADE;
DROP TYPE IF EXISTS public.store_order_status CASCADE;


-- 3. RECREATE TYPES (ENUMS)
-- =======================================================
CREATE TYPE public.user_role AS ENUM (
  'SUPER_ADMIN', 
  'ADMIN_PUNTO', 
  'ADMIN_GROUPS', 
  'ADMIN_STORE', 
  'ADMIN_ALABANZA', 
  'PASTOR', 
  'LEADER', 
  'VIEWER'
);

CREATE TYPE public.product_type AS ENUM ('Remeras', 'Buzos');

CREATE TYPE public.movement_type AS ENUM ('Entrada', 'Salida', 'Ajuste');

CREATE TYPE public.pending_status AS ENUM ('Pendiente', 'Realizado', 'Cancelado');

CREATE TYPE public.event_type AS ENUM (
  'Culto', 
  'Ayuno', 
  'Retiro', 
  'Conferencia', 
  'Reunión de Oración', 
  'Estudio Bíblico', 
  'Servicio Comunitario', 
  'Evento Social', 
  'Otro'
);

CREATE TYPE public.store_order_status AS ENUM (
  'Procesando', 
  'Pagado', 
  'Enviado', 
  'Entregado', 
  'Cancelado'
);


-- 4. RECREATE TABLES
-- =======================================================

-- TABLE: USERS (Syncs with Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role public.user_role DEFAULT 'VIEWER',
  is_active BOOLEAN DEFAULT true,
  linked_group_id UUID,          -- Can link to a group if they are a leader
  volunteer_roles TEXT[],        -- Array of roles/modules they help with
  is_system_volunteer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS for Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all users" ON public.users FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('SUPER_ADMIN'))
);
CREATE POLICY "Users update own data" ON public.users FOR UPDATE USING (auth.uid() = id);


-- MODULE: GROUPS
-- -------------------------
CREATE TABLE public.leader_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  completed_leader_course BOOLEAN DEFAULT false,
  completed_hiciste_crecer BOOLEAN DEFAULT false,
  completed_volunteer_training BOOLEAN DEFAULT false,
  attends_origen BOOLEAN DEFAULT false,
  applicant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  leader_surname TEXT NOT NULL,
  leader_phone TEXT,
  meeting_day TEXT,
  meeting_time TEXT,
  start_date TIMESTAMPTZ,
  location TEXT,
  members_count INTEGER DEFAULT 0,
  max_capacity INTEGER,
  description TEXT,
  image_url TEXT,
  category_id UUID, -- Placeholder for potential Category table
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.group_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dni TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- MODULE: ALABANZA
-- -------------------------
CREATE TABLE public.alabanza_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT,
  category TEXT,
  audio_file TEXT, 
  youtube_link TEXT,
  youtube_id TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.alabanza_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  attends_church BOOLEAN,
  did_crecer BOOLEAN,
  did_training BOOLEAN,
  status TEXT CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.alabanza_playback_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID REFERENCES public.alabanza_songs(id) ON DELETE SET NULL,
  song_title TEXT,
  artist TEXT,
  category TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- MODULE: STORE
-- -------------------------
CREATE TABLE public.store_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  color TEXT
);

CREATE TABLE public.store_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  image TEXT,
  description TEXT,
  sizes JSONB, -- Record<ClothingSize, ProductSizeInfo>
  total_stock INTEGER,
  event_ids TEXT[], 
  tags TEXT[],
  material TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TIMESTAMPTZ DEFAULT NOW(),
  status public.store_order_status DEFAULT 'Procesando',
  total DECIMAL(10,2) NOT NULL,
  customer_data JSONB, -- StoreCustomer
  payment_data JSONB,  -- PaymentDetails
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.store_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  selected_size TEXT,
  price_at_purchase DECIMAL(10,2)
);


-- MODULE: INFO POINT
-- -------------------------
CREATE TABLE public.info_point_products (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type public.product_type,
  size TEXT,
  price DECIMAL(10,2),
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0
);

CREATE TABLE public.info_point_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT REFERENCES public.info_point_products(code) ON DELETE CASCADE,
  product_name TEXT,
  type public.movement_type,
  quantity INTEGER,
  date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.baptisms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  completion_date TIMESTAMPTZ,
  is_pending INTEGER DEFAULT 1,
  status public.pending_status DEFAULT 'Pendiente'
);

CREATE TABLE public.child_presentations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_name TEXT NOT NULL,
  child_surname TEXT NOT NULL,
  mother_name TEXT,
  mother_surname TEXT,
  father_name TEXT,
  father_surname TEXT,
  email TEXT,
  phone TEXT,
  scheduled_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  is_pending INTEGER DEFAULT 1,
  status public.pending_status DEFAULT 'Pendiente'
);

CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lender_name TEXT NOT NULL,
  lender_surname TEXT NOT NULL,
  item_type public.product_type,
  item_size TEXT,
  loan_date TIMESTAMPTZ DEFAULT NOW(),
  return_date TIMESTAMPTZ,
  status TEXT CHECK (status IN ('ACTIVE', 'RETURNED')) DEFAULT 'ACTIVE'
);


-- MODULE: CALENDAR / EVENTS
-- -------------------------
CREATE TABLE public.app_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  link TEXT,
  qr_code_url TEXT,
  start_time TEXT,
  end_time TEXT,
  type public.event_type,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- MODULE: SYSTEM / NOTIFICATIONS
-- -------------------------
CREATE TABLE public.system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false,
  target_roles public.user_role[],
  type TEXT,
  metadata JSONB
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- 5. AUTOMATION (TRIGGERS)
-- =======================================================

-- Auto-create User in public.users when a new Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    'VIEWER' -- Default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ENABLE RLS ON ALL TABLES (Best Practice)
-- =======================================================
ALTER TABLE public.leader_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_registrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.alabanza_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alabanza_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alabanza_playback_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.store_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.info_point_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_point_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baptisms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. DEFAULT POLICIES (Development Mode: Allow All for Authenticated)
-- WARNING: Refine these before Production
-- =======================================================
DO $$
DECLARE
  pkg_name text;
BEGIN
  FOR pkg_name IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('CREATE POLICY "Allow All Authenticated" ON %I FOR ALL USING (auth.role() = ''authenticated'');', pkg_name);
  END LOOP;
END $$;
