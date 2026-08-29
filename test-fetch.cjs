
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
let url = "";
let key = "";
for (const line of env.split("\n")) {
    if (line.startsWith("VITE_SUPABASE_URL=")) url = line.split("=")[1].trim().replace(/"/g,"");
    if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) key = line.split("=")[1].trim().replace(/"/g,"");
}

fetch(url + "/rest/v1/space_channels?select=*", {
    headers: {
        "apikey": key,
        "Authorization": "Bearer " + key
    }
})
.then(res => res.json())
.then(data => {
    console.log("CHANNELS DATA:", data);
})
.catch(err => console.error(err));

