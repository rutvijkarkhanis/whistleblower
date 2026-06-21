import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assert(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

// Service-role client — for all server-side MUTATIONS. Never import in the browser.
export function serviceClient(): SupabaseClient {
  return createClient(assert(url, "NEXT_PUBLIC_SUPABASE_URL"), assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

// Anon client — for client-safe READS.
export function anonClient(): SupabaseClient {
  return createClient(assert(url, "NEXT_PUBLIC_SUPABASE_URL"), assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
}
