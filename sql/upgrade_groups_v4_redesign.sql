-- Add start_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'start_date') THEN
        ALTER TABLE public.groups ADD COLUMN start_date DATE;
    END IF;
END $$;

-- Ensure other metadata columns exist (based on previous requests, just to be safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'co_host_first_name') THEN
        ALTER TABLE public.groups ADD COLUMN co_host_first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'co_host_last_name') THEN
        ALTER TABLE public.groups ADD COLUMN co_host_last_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'max_age') THEN
        ALTER TABLE public.groups ADD COLUMN max_age INTEGER DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'target_gender') THEN
        ALTER TABLE public.groups ADD COLUMN target_gender TEXT DEFAULT 'Mixto/No especificar';
    END IF;
END $$;
