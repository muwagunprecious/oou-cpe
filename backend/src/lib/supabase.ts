import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import ws from "ws";

// Assign WebSocket globally for Node 20 environments
globalThis.WebSocket = ws as any;

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration in environment variables");
}

// Client for general operations (honors RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

// Client for administrative bypass operations (e.g. checking/approving profiles)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
