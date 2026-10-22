"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasSupabaseEnv } from "./supabase";
import { subscribePrivacy, getPrivacySnapshot, isAmountsHidden } from "./privacy";
import { initSync, teardownSync, subscribeSync, getSyncState } from "./sync";
import { updateProfile } from "./actions";
import { ensureDemoData, DEMO_SESSION } from "./demo";
import { db } from "./db";
import type { Profile } from "./types";

interface AppState {
  session: Session | null;
  profile: Profile | null | undefined; // undefined = still loading
  ready: boolean;
  amountsHidden: boolean;
}

const AppCtx = createContext<AppState>({ session: null, profile: undefined, ready: false, amountsHidden: false });

export function useApp() {
  return useContext(AppCtx);
}

export function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState, () => ({ status: "offline" as const, pending: 0 }));
}

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const amountsHidden = useSyncExternalStore(subscribePrivacy, getPrivacySnapshot, () => false);
  const router = useRouter();
  const pathname = usePathname();

  const uid = session?.user.id;

  // Profile is reactive: onboarding's optimistic insert flips this instantly.
  const liveProfile = useLiveQuery(
    async () => (uid ? ((await db().profiles.get(uid)) ?? null) : undefined),
    [uid],
    undefined
  );
  const profile: Profile | null | undefined = !ready
    ? undefined
    : !session
      ? null
      : liveProfile === undefined
        ? undefined
        : liveProfile;

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      // Demo mode — fully local session so the app is usable before
      // Supabase is configured. Demo data clears itself on first real sync.
      void ensureDemoData().then(() => {
        setSession(DEMO_SESSION);
        setReady(true);
      });
      return;
    }
    const sb = supabase();
    let cancelled = false;

    async function boot(s: Session | null) {
      if (s) await initSync(s.user.id);
      if (!cancelled) {
        setSession(s);
        setReady(true);
      }
    }

    sb.auth.getSession().then(({ data }) => void boot(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      if (!s) {
        void teardownSync();
        setSession(null);
      } else {
        void boot(s);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Backfill email onto the profile (friends can see it unless hidden)
  useEffect(() => {
    if (session && liveProfile && session.user.email && liveProfile.email !== session.user.email) {
      void updateProfile(session.user.id, { email: session.user.email });
    }
  }, [session, liveProfile]);

  // Route gating
  useEffect(() => {
    if (!ready) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!hasSupabaseEnv()) {
      if (isPublic) router.replace("/"); // demo mode: skip auth screens
      return;
    }
    if (!session && !isPublic) {
      router.replace("/login");
    } else if (session && profile === null && pathname !== "/onboarding") {
      router.replace("/onboarding");
    } else if (session && profile && isPublic) {
      router.replace("/");
    }
  }, [ready, session, profile, pathname, router]);

  return <AppCtx.Provider value={{ session, profile, ready, amountsHidden }}>{children}</AppCtx.Provider>;
}
