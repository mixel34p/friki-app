
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
let url = "";
let key = "";
for (const line of env.split("\n")) {
    if (line.startsWith("VITE_SUPABASE_URL=")) url = line.split("=")[1].trim().replace(/"/g,"");
    if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) key = line.split("=")[1].trim().replace(/"/g,"");
}
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

