import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = 'https://oqtumgalnozppqnnjjdb.supabase.co';
const VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdHVtZ2Fsbm96cHBxbm5qamRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NDY2OTYsImV4cCI6MjA4MDEyMjY5Nn0.Vlfh2iZcrDr14dPGaWZ8rBARWfd0AngtAY_msumBkiI';

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: matches } = await supabase.from('prode_matches').select('*');
  const { data: preds } = await supabase.from('prode_predictions').select('*');
  const { data: parts } = await supabase.from('prode_participants').select('*');

  console.log('Matches (isFinished):', matches.filter(m => m.is_finished).length);
  console.log('Total matches:', matches.length);
  console.log('Total predictions:', preds.length);
  console.log('Total participants:', parts.length);
  
  if (preds.length > 0) {
      console.log('Sample pred:', preds[0]);
  }
}

check();
