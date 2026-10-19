"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Landing page for magic links. The Supabase browser client detects the
// code/hash in the URL and establishes the session automatically; we just
// wait for it, then go home.
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const sb = supabase();
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) router.replace("/");
    });
    const t = setTimeout(() => router.replace("/login"), 15_000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [router]);

  return (
    <div className="screen flex flex-col items-center justify-center gap-4">
      <div className="skeleton w-12 h-12 rounded-full" />
      <p className="text-sub text-[15px]">Signing you in…</p>
    </div>
  );
}
