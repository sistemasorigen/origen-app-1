import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: matches } = await supabase.from('prode_matches').select('*').eq('is_finished', true);
  console.log('Finished matches:', matches?.length);
  
  const { data: preds } = await supabase.from('prode_predictions').select('*');
  console.log('Total predictions:', preds?.length);
}
main();
