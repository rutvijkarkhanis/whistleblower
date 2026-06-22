"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabaseBrowser";

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (!email) return null;

  async function signOut() {
    await browserClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">{email}</span>
      <button onClick={signOut} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">
        Sign out
      </button>
    </div>
  );
}
