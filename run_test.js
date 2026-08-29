import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('space_messages').select('id, reply_to_id').not('reply_to_id', 'is', null).limit(1);
  console.log('MESSAGES WITH REPLY_TO_ID:', data);
  const { data: d2, error: e2 } = await supabase.from('space_messages').select('id, reply_to_id, reply_to:space_messages(*)').not('reply_to_id', 'is', null).limit(1);
  if (e2) console.log('ERROR JOINING:', e2);
  else console.log('JOINED DATA:', JSON.stringify(d2, null, 2));
}
test();
