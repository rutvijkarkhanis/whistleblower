"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabaseBrowser";

function LoginInner() {
  const params = useSearchParams();
  const notAllowed = params.get("error") === "not_allowed";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const supabase = browserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <div className="card p-6">
        <h1 className="text-lg font-semibold">🕵️ Whistleblower</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with a magic link.</p>

        {notAllowed && (
          <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
            That email isn&apos;t allowed to access this app.
          </p>
        )}

        {sent ? (
          <p className="mt-4 rounded bg-green-50 px-3 py-3 text-sm text-green-700">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email.trim() && send()}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || !email.trim()} onClick={send}>
              {busy ? "Sending…" : "Send magic link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
