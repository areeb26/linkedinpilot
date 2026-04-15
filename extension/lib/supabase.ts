import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXT_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.EXT_SUPABASE_ANON_KEY || "placeholder"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
