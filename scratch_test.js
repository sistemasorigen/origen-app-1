import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('prode_participants')
    .select('*')
    .limit(1);

  console.log("Data:", data);
  console.log("Error:", error);

  if (data && data.length > 0) {
    const pId = data[0].id;
    const { data: updateData, error: updateError } = await supabase
      .from('prode_participants')
      .update({ total_points: data[0].total_points - 1 })
      .eq('id', pId);
    
    console.log("Update Error:", updateError);
  }
}

test();
