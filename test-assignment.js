import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://oqtumgalnozppqnnjjdb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace key in script
const supabase = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdHVtZ2Fsbm96cHBxbm5qamRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NDY2OTYsImV4cCI6MjA4MDEyMjY5Nn0.Vlfh2iZcrDr14dPGaWZ8rBARWfd0AngtAY_msumBkiI');

async function test() {
  console.log('Fetching a group...');
  const { data: groups, error: err } = await supabase.from('groups').select('*').limit(1);
  if (err || !groups?.length) {
      console.log('Error fetching group', err);
      return;
  }
  const group = groups[0];
  console.log(`Original host_id for ${group.name}:`, group.host_id);
  
  // Create a payload with a dummy host_id
  const dummyUUID = '11111111-1111-1111-1111-111111111111';
  
  // Transform to dbRow format as done in updateGroupDirect
  const dbRow = {
    name: group.name,
    status: group.status,
    leader_name: group.leader_name || '',
    leader_surname: group.leader_surname || '',
    leader_phone: group.leader_phone || '',
    meeting_day: group.meeting_day || 'Lunes',
    meeting_time: group.meeting_time || '20:00',
    start_date: group.start_date || null,
    end_date: group.end_date || null,
    location: group.location || '',
    members_count: group.members_count || 0,
    max_capacity: group.max_capacity || 12,
    description: group.description || '',
    image_url: group.image_url || '',
    category_id: group.category_id || null,
    tags: group.tags || [],
    host_id: dummyUUID,  // The new host_id
    co_host_id: group.co_host_id || null,
    co_host_first_name: group.co_host_first_name || '',
    co_host_last_name: group.co_host_last_name || '',
    min_age: group.min_age || 0,
    max_age: group.max_age || 100,
    target_gender: group.target_gender || 'Mixto'
  };

  console.log('Calling admin_update_group_v2...');
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_group_v2', {
    p_group_id: group.id,
    p_group_data: dbRow
  });

  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
  } else {
    console.log('RPC Success!', rpcRes.host_id === dummyUUID ? 'Host ID updated!' : 'Host ID NOT updated!');
  }
  
  // Verify with fresh fetch
  const { data: verify } = await supabase.from('groups').select('host_id').eq('id', group.id).single();
  console.log('Verified host_id in DB:', verify?.host_id);

  // Revert back
  dbRow.host_id = group.host_id;
  await supabase.rpc('admin_update_group_v2', { p_group_id: group.id, p_group_data: dbRow });
  console.log('Reverted back to original host.');
}

test();
