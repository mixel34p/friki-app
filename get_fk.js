import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
async function test() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/?apikey=${env.VITE_SUPABASE_ANON_KEY}`);
  const openapi = await res.json();
  console.log(JSON.stringify(openapi, null, 2).slice(0, 500));
  // Find all refs for space_messages
  const defs = openapi.definitions || openapi.components?.schemas;
  console.log(JSON.stringify(defs?.space_messages, null, 2));
}
test();
