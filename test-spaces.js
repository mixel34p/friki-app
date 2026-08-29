
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching spaces...");
  const { data, error } = await supabase
    .from("spaces")
    .select(`
        *,
        owner:profiles (username, display_name, avatar_url)
    `)
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Error fetching spaces:", error);
  } else {
    console.log("Success! Fetched", data.length, "spaces.");
    console.log(data);
  }
}

run();

