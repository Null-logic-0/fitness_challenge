import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

/**
 * Shared Supabase client. Uses the publishable key, which is safe to embed
 * in browser bundles — access control is enforced by Postgres Row Level
 * Security (see supabase/schema.sql), not by keeping this key secret.
 *
 * Used both from the browser (auth, submitting results, invites) and from
 * server-rendered pages (`export const prerender = false`) that need fresh
 * per-request data, e.g. the public result and invite pages.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
