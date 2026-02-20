
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!PROJECT_URL || !ANON_KEY) {
    throw new Error(
        '[supabaseClient] Faltan variables de entorno requeridas: ' +
        'VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar definidas en .env.local'
    );
}

export const supabase = createClient(PROJECT_URL, ANON_KEY);
