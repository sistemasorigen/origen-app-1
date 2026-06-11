import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oqtumgalnozppqnnjjdb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdHVtZ2Fsbm96cHBxbm5qamRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NDY2OTYsImV4cCI6MjA4MDEyMjY5Nn0.Vlfh2iZcrDr14dPGaWZ8rBARWfd0AngtAY_msumBkiI'
);

async function test() {
  const { data, error } = await supabase
    .from('prode_participants')
    .select('*')
    .limit(1);

  console.log("Participant:", data?.[0]);

  if (data && data.length > 0) {
    const pId = data[0].id;
    console.log("Updating participant", pId);
    
    // Test update total_points
    const res1 = await supabase
      .from('prode_participants')
      .update({ total_points: 0 })
      .eq('id', pId);
    console.log("Update total_points error:", res1.error);

    // Test with points_adjustment
    const res2 = await supabase
      .from('prode_participants')
      .update({ points_adjustment: 0 })
      .eq('id', pId);
    console.log("Update points_adjustment error:", res2.error);
  }
}

test();
