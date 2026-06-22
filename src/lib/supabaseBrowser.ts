import { createBrowserClient } from "@supabase/ssr";

// Browser-side client for auth (login page, sign-out, reading the session in
// client components). Uses the anon key only.
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
