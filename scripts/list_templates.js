import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env reading from root .env
const envFile = fs.readFileSync(path.resolve('../.env'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.trim().split('=')));

const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listTemplates() {
    const { data, error } = await supabase.from('recruit_message_templates').select('template_key');
    if (error) console.error(error);
    else console.log(data);
}

listTemplates();
