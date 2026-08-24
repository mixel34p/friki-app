import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mzkesbzdgpregglmxyrf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2VzYnpkZ3ByZWdnbG14eXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5OTY2OTIsImV4cCI6MjA4MjU3MjY5Mn0.ETM0HiWM5s7U6Jlc9Rvholv7kwLI4W2Gmyve5gF5gKU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function run() {
    const { data, error } = await supabase
        .from('library_entries')
        .select(`
            rating,
            created_at,
            profiles:user_id (
                avatar_url,
                username
            )
        `)
        .limit(1)

    console.log("With profiles:", { data, error })
    
    const { data: d2, error: e2 } = await supabase
        .from('library_entries')
        .select('*')
        .limit(1)
        
    console.log("Without profiles:", { data: d2, error: e2 })
}
run()
