
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from("spaces")
    .select(`
        *,
        owner:profiles!spaces_owner_id_fkey (username),
        member_count:space_members (count)
    `);
  console.log("ERROR:", error);
  console.log("DATA:", JSON.stringify(data, null, 2));
}
run();

