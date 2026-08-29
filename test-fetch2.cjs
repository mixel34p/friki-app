
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from("spaces").select("id").limit(1).single();
  if (!data) return console.log("No spaces");
  const spaceId = data.id;
  const res1 = await supabase.from("space_channels").select("*").eq("space_id", spaceId);
  console.log("CHANNELS ERROR:", res1.error);
  console.log("CHANNELS DATA:", res1.data);
}
run();

