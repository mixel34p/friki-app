import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const q = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/` + '?apikey=' + env.VITE_SUPABASE_ANON_KEY);
  const json = await q.json();
  const paths = Object.keys(json.paths).filter(p => p.includes('space_messages'));
  console.log("PATHS:", paths);
}
test();
