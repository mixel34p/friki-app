import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  // Test query 1: without hint
  const q1 = await supabase.from('space_messages').select('id, reply_to_id, reply_to:space_messages(id)').not('reply_to_id', 'is', null).limit(1);
  console.log("Q1 (no hint):", JSON.stringify(q1.data));
  // Test query 2: with !reply_to_id
  const q2 = await supabase.from('space_messages').select('id, reply_to_id, reply_to:space_messages!reply_to_id(id)').not('reply_to_id', 'is', null).limit(1);
  console.log("Q2 (!reply_to_id):", JSON.stringify(q2.data));
  // Test query 3: with !space_messages_reply_to_id_fkey
  const q3 = await supabase.from('space_messages').select('id, reply_to_id, reply_to:space_messages!space_messages_reply_to_id_fkey(id)').not('reply_to_id', 'is', null).limit(1);
  console.log("Q3 (!space_messages_reply_to_id_fkey):", JSON.stringify(q3.data));
}
test();
