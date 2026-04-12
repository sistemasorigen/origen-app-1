import { createClient } from '@supabase/supabase-js';

// Setup basic supabase
const URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'dummy'; // Will try to read from .env if needed

async function run() {
    console.log("Reading env from ../.env");
    const dotenv = require('dotenv');
    dotenv.config({ path: '../.env' });
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if(!supabaseUrl || !supabaseKey) {
        console.error("Missing config!");
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: events, error } = await supabase.from('events').select('*').limit(5);
    
    if (error) console.error(error);
    else {
        console.log("Events:", events.map(e => ({ name: e.name, qrC: e.qr_code_url, qrCodeUrl: e.qrCodeUrl })));
    }
}

run();
