
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from("space_channels").select("*");
  console.log("CHANNELS ERROR:", error);
  console.log("CHANNELS DATA LENGTH:", data ? data.length : 0);
  if (data && data.length > 0) {
      console.log("FIRST CHANNEL:", data[0]);
  }
}
run();

