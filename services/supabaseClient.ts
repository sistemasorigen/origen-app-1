
import { createClient } from '@supabase/supabase-js';

// Credentials provided
const PROJECT_URL = 'https://oqtumgalnozppqnnjjdb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdHVtZ2Fsbm96cHBxbm5qamRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NDY2OTYsImV4cCI6MjA4MDEyMjY5Nn0.Vlfh2iZcrDr14dPGaWZ8rBARWfd0AngtAY_msumBkiI';

export const supabase = createClient(PROJECT_URL, ANON_KEY);
