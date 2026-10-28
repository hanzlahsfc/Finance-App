"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/lib/store";
import { useFriendships, useGroups, useProfileMap, useFriendStats } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase, hasSupabaseEnv } from "@/lib/supabase";
import { sendFriendRequest, acceptFriendRequest, removeFriendship, createGroup } from "@/lib/actions";
import { formatMoney } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import type { Profile, Friendship, Group } from "@/lib/types";

export default function GroupsPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const friendships = useFriendships(uid);
  const groups = useGroups(uid);
  const profileMap = useProfileMap();
  const friendStats = useFriendStats(uid);

  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const friends = useMemo(
    () => friendships.filter((f) => f.status === "accepted"),
    [friendships]
  );
  const incoming = friendships.filter((f) => f.status === "pending" && f.friend_id === uid);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.user_id === uid);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center justify-between mb-6">
        <h1 className="large-title">Friends</h1>
        <button className="pill bg-tint text-white" onClick={() => setAddFriendOpen(true)}>
          <Icon name="userPlus" size={14} /> Add friend
        </button>
      </div>

      {incoming.length > 0 && (
        <>
          <SectionTitle>Requests</SectionTitle>
          <Card className="mb-6">
            {incoming.map((f) => {
              const p = profileMap.get(f.user_id);
              return (
                <ListRow
                  key={f.id}
                  icon={<Avatar name={p?.display_name ?? "?"} id={f.user_id} size={36} src={p?.avatar_url} />}
                  title={p?.display_name ?? "…"}
                  subtitle={`@${p?.username ?? ""} wants to add you`}
                  right={
                    <div className="flex gap-2">
                      <button className="pill bg-tint text-white" onClick={() => acceptFriendRequest(f.id)}>Accept</button>
                      <button className="pill bg-card2 text-sub" onClick={() => removeFriendship(f.id)}>Decline</button>
                    </div>
                  }
                />
              );
            })}
          </Card>
        </>
      )}

      {/* friends list */}
      <SectionTitle>Friends</SectionTitle>
      <Card className="mb-6">
        {friends.length === 0 && outgoing.length === 0 ? (
          <EmptyState icon="userPlus" title="No friends yet" hint="Search by username to add people you split expenses with" />
        ) : (
          <>
            {friends.map((f) => {
              const otherId = f.user_id === uid ? f.friend_id : f.user_id;
              const p = profileMap.get(otherId);
              const st = friendStats.get(otherId);
              const net = (st?.theyOwe ?? 0) - (st?.iOwe ?? 0);
              return (
                <Link href={`/friends/${otherId}`} key={f.id}>
                  <ListRow
                    icon={<Avatar name={p?.display_name ?? "?"} id={otherId} size={36} src={p?.avatar_url} />}
                    title={p?.display_name ?? "…"}
                    subtitle={
                      `@${p?.username ?? ""}` +
                      (st && st.events > 0 ? ` · ${st.events} ${st.events === 1 ? "event" : "events"}` : "")
                    }
                    right={
                      <div className="flex items-center gap-2">
                        {net !== 0 && (
                          <span className={`text-[13px] font-semibold tabular-nums ${net > 0 ? "text-green" : "text-orange"}`}>
                            {net > 0 ? `owes ${formatMoney(net, currency)}` : `you owe ${formatMoney(-net, currency)}`}
                          </span>
                        )}
                        <Icon name="chevronRight" size={16} className="text-sub2" />
                      </div>
                    }
                  />
                </Link>
              );
            })}
            {outgoing.map((f) => {
              const p = profileMap.get(f.friend_id);
              return (
                <ListRow
                  key={f.id}
                  icon={<Avatar name={p?.display_name ?? "?"} id={f.friend_id} size={36} src={p?.avatar_url} />}
                  title={p?.display_name ?? "…"}
                  subtitle="Request sent"
                  right={<span className="pill bg-card2 text-sub">Pending</span>}
                />
              );
            })}
          </>
        )}
      </Card>

      {/* ad-hoc splits from QuickAdd */}
      {groups.some((g) => g.is_adhoc) && (
        <>
          <SectionTitle>Shared splits</SectionTitle>
          <Card className="mb-6">
            {groups.filter((g) => g.is_adhoc).map((g) => (
              <AdhocSplitRow key={g.id} group={g} uid={uid!} profileMap={profileMap} currency={currency} />
            ))}
          </Card>
        </>
      )}

      {/* groups — secondary, most splits happen via + */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">Groups</span>
        <button className="text-sub text-[14px] font-medium flex items-center gap-1" onClick={() => setNewGroupOpen(true)}>
          <Icon name="plus" size={15} /> New group
        </button>
      </div>
      {groups.filter((g) => !g.is_adhoc).length > 0 && (
        <Card className="mb-4">
          {groups.filter((g) => !g.is_adhoc).map((g) => (
            <Link href={`/groups/${g.id}`} key={g.id}>
              <ListRow
                icon="people"
                iconBg="rgba(0,200,83,0.15)"
                title={g.name}
                subtitle="Tap to view activity"
              />
            </Link>
          ))}
        </Card>
      )}

      {addFriendOpen && <AddFriendSheet uid={uid!} existing={friendships} onClose={() => setAddFriendOpen(false)} />}
      {newGroupOpen && <NewGroupSheet uid={uid!} friends={friends} profileMap={profileMap} onClose={() => setNewGroupOpen(false)} />}
    </div>
  );
}

function AdhocSplitRow({ group, uid, profileMap, currency }: { group: Group; uid: string; profileMap: Map<string, Profile>; currency: string }) {
  const info = useLiveQuery(
    async () => {
      const act = (await db().activities.where("group_id").equals(group.id).toArray())[0];
      if (!act) return null;
      const splits = await db().activity_splits.where("activity_id").equals(act.id).toArray();
      const owes = splits
        .filter((s) => s.user_id !== act.paid_by)
        .map((s) => ({ id: s.user_id, rem: Math.max(0, s.owed_amount - s.settled_amount) }));
      return { act, owes, paidBy: act.paid_by };
    },
    [group.id]
  );

  // hide deleted splits — an ad-hoc group with no activity is gone
  if (info === null) return null;

  return (
    <Link href={`/groups/${group.id}`}>
      <ListRow
        icon="receipt"
        iconBg="rgba(255,159,10,0.15)"
        title={info?.act.title ?? group.name}
        subtitle={
          info
            ? `${formatMoney(info.act.total_amount, currency)} total` +
              (info.owes.length
                ? " · " +
                  info.owes
                    .map((o) => {
                      const name = o.id === uid ? "you" : (profileMap.get(o.id)?.display_name ?? "…").split(" ")[0];
                      return o.rem > 0 ? `${name} owes ${formatMoney(o.rem, currency)}` : `${name} settled`;
                    })
                    .join(" · ")
                : "")
            : "Loading…"
        }
        right={<Icon name="chevronRight" size={16} className="text-sub2" />}
      />
    </Link>
  );
}

function AddFriendSheet({ uid, existing, onClose }: { uid: string; existing: { user_id: string; friend_id: string; status: string }[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
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

    // Online: ask the server so brand-new signups are found too.
    if (navigator.onLine && hasSupabaseEnv()) {
      try {
        const pattern = t.replace(/[%_,]/g, "");
        if (pattern) {
          const { data, error } = await supabase()
            .from("profiles")
            .select("id, username, display_name")
            .neq("id", uid)
            .or(`username.ilike.%${pattern}%,display_name.ilike.%${pattern}%`)
            .limit(10);
          if (!error && data) {
            // mirror into local cache so names resolve elsewhere — merge to
            // keep fields the partial select didn't return
            const merged = await Promise.all(
              data.map(async (d) => ({
                ...(await db().profiles.get(d.id)),
                ...d,
              }))
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

  const alreadyLinked = (id: string) =>
    existing.some((f) => (f.user_id === uid && f.friend_id === id) || (f.friend_id === uid && f.user_id === id));

  return (
    <Sheet title="Add friend" onClose={onClose}>
      <div className="relative mb-4">
        <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sub2" />
        <input
          className="input pl-11"
          placeholder="Search by username or name"
          autoFocus
          value={q}
          onChange={(e) => void search(e.target.value)}
        />
      </div>
      <div className="card mb-4">
        {results.length === 0 ? (
          <p className="card-pad text-sub text-[14px] text-center py-6">
            {searching ? "Searching…" : q.trim().length >= 2 ? "No users found" : "Type a username — they need the app too"}
          </p>
        ) : (
          results.map((p) => (
            <ListRow
              key={p.id}
              icon={<Avatar name={p.display_name} id={p.id} size={36} src={p.avatar_url} />}
              title={p.display_name}
              subtitle={`@${p.username}`}
              right={
                alreadyLinked(p.id) || sent.has(p.id) ? (
                  <span className="pill bg-card2 text-sub"><Icon name="check" size={12} /> {alreadyLinked(p.id) ? "Friends" : "Sent"}</span>
                ) : (
                  <button
                    className="pill bg-tint text-white"
                    onClick={async () => {
                      await sendFriendRequest(uid, p.id);
                      setSent(new Set(sent).add(p.id));
                    }}
                  >
                    Add
                  </button>
                )
              }
            />
          ))
        )}
      </div>
      <p className="text-sub2 text-[13px] text-center">They&apos;ll get a request to accept.</p>
    </Sheet>
  );
}

function NewGroupSheet({ uid, friends, profileMap, onClose }: { uid: string; friends: Friendship[]; profileMap: Map<string, Profile>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPicked(s);
  };

  return (
    <Sheet title="New group" onClose={onClose}>
      <input className="input mb-4" placeholder="Group name — e.g. Biryani nights" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <label className="section-title">Add friends</label>
      <div className="card mb-5">
        {friends.length === 0 ? (
          <p className="card-pad text-sub text-[14px] text-center py-5">Add friends first — you can also add them later</p>
        ) : (
          friends.map((f) => {
            const otherId = f.user_id === uid ? f.friend_id : f.user_id;
            const p = profileMap.get(otherId);
            const on = picked.has(otherId);
            return (
              <ListRow
                key={f.id}
                icon={<Avatar name={p?.display_name ?? "?"} id={otherId} size={36} />}
                title={p?.display_name ?? "…"}
                subtitle={`@${p?.username ?? ""}`}
                right={
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center ${on ? "bg-tint" : "bg-card3"}`}>
                    {on && <Icon name="check" size={14} color="#fff" />}
                  </span>
                }
                onClick={() => toggle(otherId)}
              />
            );
          })
        )}
      </div>
      <button
        className="btn"
        disabled={!name.trim() || saving}
        onClick={async () => {
          setSaving(true);
          await createGroup(uid, name, [...picked]);
          onClose();
        }}
      >
        Create group
      </button>
    </Sheet>
  );
}
