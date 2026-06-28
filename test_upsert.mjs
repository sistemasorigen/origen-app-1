import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const supabase = createClient(url, key);

async function run() {
  const { data: participants } = await supabase.from('prode_participants').select('id').limit(1);
  const { data: matches } = await supabase.from('prode_matches').select('id').limit(1);

  if (participants.length && matches.length) {
    const pId = participants[0].id;
    const mId = matches[0].id;

    console.log(`Testing with participant ${pId} and match ${mId}`);

    const res1 = await supabase.from('prode_predictions').upsert({
      participant_id: pId,
      match_id: mId,
      home_score_pred: 1,
      away_score_pred: 1,
      updated_at: new Date().toISOString()
    }, { onConflict: 'participant_id,match_id' });
    console.log('Upsert 1:', res1.error || 'Success');

    const res2 = await supabase.from('prode_predictions').upsert({
      participant_id: pId,
      match_id: mId,
      home_score_pred: 2,
      away_score_pred: 2,
      updated_at: new Date().toISOString()
    }, { onConflict: 'participant_id,match_id' });
    console.log('Upsert 2:', res2.error || 'Success');
    
    const { data } = await supabase.from('prode_predictions').select('*').eq('participant_id', pId).eq('match_id', mId);
    console.log('Current row:', data);
  }
}
run();
