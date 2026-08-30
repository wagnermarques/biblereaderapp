import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Login/sync is an optional layer on top of the fully-offline app — if no
// Supabase project is configured, `supabase` stays null and every caller
// treats that as "not signed in, local storage only".
export const supabase = url && anonKey ? createClient(url, anonKey) : null
