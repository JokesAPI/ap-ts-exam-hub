// src/lib/supabase.js
// Fix: validate env vars before creating client

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.\n' +
    'Copy .env.example to .env and fill in your values.'
  )
}

import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(supabaseUrl, supabaseKey)
