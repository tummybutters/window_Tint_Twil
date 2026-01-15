import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

// For server-side operations, use service_role key if available to bypass RLS
// Fallback to anon key if service_role is not provided (requires RLS to be configured)
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

export const supabase = createClient(env.SUPABASE_URL, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
