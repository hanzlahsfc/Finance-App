"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, hasSupabaseEnv } from "@/lib/supabase";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (!hasSupabaseEnv()) {
    return (
      <div className="screen flex flex-col items-center justify-center px-8 text-center">
        <p className="text-xl font-bold mb-2">Demo mode</p>
        <p className="text-sub text-[15px] mb-6">
          Running fully offline with demo data. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable sign in and friends.
        </p>
        <Link href="/" className="btn">Open the app</Link>
      </div>
    );
  }

  return (
    <div className="screen flex flex-col px-7 pt-24">
      <div className="w-[72px] h-[72px] rounded-[20px] bg-tint flex items-center justify-center mb-6 shadow-[0_10px_30px_rgba(10,132,255,0.35)]">
        <Icon name="wallet" size={36} color="#fff" strokeWidth={1.6} />
      </div>
      <h1 className="large-title mb-2">Hisab</h1>
      <p className="text-sub text-[16px] mb-10">
        Weekly pay, bills, spending and shared expenses with friends — all in one place.
      </p>

      {sent ? (
        <div className="card card-pad text-center py-10">
          <div className="w-14 h-14 rounded-full bg-[rgba(48,209,88,0.15)] flex items-center justify-center mx-auto mb-4">
            <Icon name="send" size={26} className="text-green" />
          </div>
          <p className="text-[19px] font-semibold mb-1">Check your email</p>
          <p className="text-sub text-[15px]">
            We sent a sign-in link to <span className="text-label font-medium">{email}</span>. Tap it to continue.
          </p>
          <button className="text-tint text-[15px] font-medium mt-5" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-4">
          <input
            className="input"
            type="email"
            required
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-red text-[14px]">{error}</p>}
          <button className="btn" disabled={loading || !email.trim()}>
            {loading ? "Sending…" : "Continue with email"}
          </button>
          <p className="text-sub2 text-[13px] text-center">
            Passwordless — we&apos;ll email you a magic link.
          </p>
        </form>
      )}
    </div>
  );
}
