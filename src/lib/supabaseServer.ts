import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Server-side auth client bound to the request cookies. Use in route handlers
// and server components to read the logged-in user. (Data mutations still go
// through serviceClient() in src/lib/supabase.ts.)
export function serverAuthClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes cookies
          }
        },
      },
    },
  );
}

// Allowlist check shared by middleware + callback. If ALLOWED_EMAILS is unset,
// any authenticated user is permitted (set it in production!).
export function isAllowedEmail(email: string | null | undefined): boolean {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw) return true;
  if (!email) return false;
  const allow = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
