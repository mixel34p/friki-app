import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const q4 = await supabase.from('space_messages').select('id, reply_to_id, space_messages!fk_space_messages_reply_to_id(id)').not('reply_to_id', 'is', null).limit(1);
  console.log("Q4 (!fk_space_messages_reply_to_id):", JSON.stringify(q4.data));
  const q5 = await supabase.from('space_messages').select('id, reply_to_id, space_messages!reply_to_id_fkey(id)').not('reply_to_id', 'is', null).limit(1);
  console.log("Q5 (!reply_to_id_fkey):", JSON.stringify(q5.data));
}
test();
