"use client";

import { useRef, useState } from "react";
import { db } from "@/lib/db";
import { supabase, hasSupabaseEnv } from "@/lib/supabase";
import { ListRow, Avatar } from "./ui";
import { Icon } from "./Icon";
import type { Profile } from "@/lib/types";

/** Debounced profile search (server when online, local mirror offline). */
export function UserPicker({
  uid,
  excludeIds,
  actionLabel = "Add",
  onPick,
}: {
  uid: string;
  excludeIds?: Set<string>;
  actionLabel?: string;
  onPick: (p: Profile) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(term: string) {
    setQ(term);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSearch(term), 300);
  }

  async function runSearch(term: string) {
    const t = term.trim().toLowerCase();
    if (t.length < 2) { setResults([]); return; }
    setSearching(true);

    if (navigator.onLine && hasSupabaseEnv()) {
      try {
        const pattern = t.replace(/[%_,]/g, "");
        if (pattern) {
          const { data, error } = await supabase()
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .neq("id", uid)
            .or(`username.ilike.%${pattern}%,display_name.ilike.%${pattern}%`)
            .limit(10);
          if (!error && data) {
            const merged = await Promise.all(
              data.map(async (d) => ({ ...(await db().profiles.get(d.id)), ...d }))
            );
            await db().profiles.bulkPut(merged as Profile[]);
            setResults(data as Profile[]);
            setSearching(false);
            return;
          }
        }
      } catch { /* fall through to local */ }
    }

    const rows = await db()
      .profiles.filter((p) => p.id !== uid && (p.username.includes(t) || p.display_name.toLowerCase().includes(t)))
      .limit(10)
      .toArray();
    setResults(rows);
    setSearching(false);
  }

  const shown = results.filter((p) => !excludeIds?.has(p.id));

  return (
    <>
      <div className="relative mb-3">
        <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sub2" />
        <input
          className="input pl-11"
          placeholder="Search by username or name"
          value={q}
          onChange={(e) => void search(e.target.value)}
        />
      </div>
      <div className="card mb-4">
        {shown.length === 0 ? (
          <p className="card-pad text-sub text-[14px] text-center py-5">
            {searching ? "Searching…" : q.trim().length >= 2 ? "No users found" : "Type a username — they need the app too"}
          </p>
        ) : (
          shown.map((p) => (
            <ListRow
              key={p.id}
              icon={<Avatar name={p.display_name} id={p.id} size={36} src={p.avatar_url} />}
              title={p.display_name}
              subtitle={`@${p.username}`}
              right={
                <button className="pill bg-tint text-white" onClick={() => onPick(p)}>
                  {actionLabel}
                </button>
              }
            />
          ))
        )}
      </div>
    </>
  );
}
