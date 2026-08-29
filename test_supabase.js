import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
    const { data, error } = await supabase.from('space_messages').select('id, content, reply_to_id, reply_to:space_messages!reply_to_id(id, content)').not('reply_to_id', 'is', null).limit(1);
    console.log('Error:', error);
    console.log('Data:', JSON.stringify(data, null, 2));
}
test();
