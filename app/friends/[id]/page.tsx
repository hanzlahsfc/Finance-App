"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/lib/store";
import { useFriendships, useProfileMap, usePlans } from "@/lib/hooks";
import { db } from "@/lib/db";
import { removeFriendship } from "@/lib/actions";
import { formatMoney, formatDayLabel } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { PlanSheet } from "@/components/PlanSheet";
import { Icon } from "@/components/Icon";
import type { Activity, Plan } from "@/lib/types";

interface SharedEvent {
  activity: Activity;
  groupName: string;
  /** positive → friend owes me, negative → I owe them */
  friendBalance: number;
  friendShare: number;
}

export default function FriendPage() {
  const params = useParams();
  const router = useRouter();
  const friendId = String(params.id);
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";

  const friendships = useFriendships(uid);
  const profileMap = useProfileMap();
  const p = profileMap.get(friendId);
  const friendship = friendships.find(
    (f) => (f.user_id === uid && f.friend_id === friendId) || (f.friend_id === uid && f.user_id === friendId)
  );

  const [confirming, setConfirming] = useState(false);
  const plans = usePlans(friendId);
  const [openPlan, setOpenPlan] = useState<Plan | null>(null);

  const events = useLiveQuery(
    async (): Promise<SharedEvent[]> => {
      if (!uid) return [];
      const myGroups = new Set((await db().group_members.where("user_id").equals(uid).toArray()).map((m) => m.group_id));
      const acts = (await db().activities.toArray()).filter((a) => myGroups.has(a.group_id));
      const groupNames = new Map((await db().groups.toArray()).map((g) => [g.id, g.name]));
      const out: SharedEvent[] = [];
      for (const a of acts) {
        const ss = await db().activity_splits.where("activity_id").equals(a.id).toArray();
        const friendSplit = ss.find((s) => s.user_id === friendId);
        const mySplit = ss.find((s) => s.user_id === uid);
        if (a.paid_by === uid && friendSplit) {
          out.push({
            activity: a,
            groupName: groupNames.get(a.group_id) ?? "Split",
            friendBalance: Math.max(0, friendSplit.owed_amount - friendSplit.settled_amount),
            friendShare: friendSplit.owed_amount,
          });
        } else if (a.paid_by === friendId && mySplit) {
          out.push({
            activity: a,
            groupName: groupNames.get(a.group_id) ?? "Split",
            friendBalance: -Math.max(0, mySplit.owed_amount - mySplit.settled_amount),
            friendShare: mySplit.owed_amount,
          });
        }
      }
      return out.sort((a, b) => (b.activity.occurred_at ?? "").localeCompare(a.activity.occurred_at ?? ""));
    },
    [uid, friendId],
    [] as SharedEvent[]
  );

  const net = useMemo(() => events.reduce((s, e) => s + e.friendBalance, 0), [events]);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-tint p-1 -ml-1" aria-label="Back">
          <Icon name="chevronLeft" size={26} />
        </button>
        <h1 className="large-title">Friend</h1>
      </div>

      {/* profile card */}
      <Card className="card-pad flex flex-col items-center mb-6">
        <Avatar name={p?.display_name ?? "?"} id={friendId} size={84} src={p?.avatar_url} />
        <p className="text-[22px] font-bold mt-3">{p?.display_name ?? "…"}</p>
        <p className="text-sub text-[15px]">@{p?.username ?? "…"}</p>
        {p?.show_email !== false && p?.email && <p className="text-sub2 text-[14px] mt-0.5">{p.email}</p>}
        <div className="flex gap-2 mt-4">
          <span className="pill bg-card2 text-sub">{events.length} {events.length === 1 ? "event" : "events"}</span>
          {net !== 0 && (
            <span className={`pill ${net > 0 ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-[rgba(255,159,10,0.15)] text-orange"}`}>
              {net > 0 ? `owes you ${formatMoney(net, currency)}` : `you owe ${formatMoney(-net, currency)}`}
            </span>
          )}
        </div>
      </Card>

      {/* plans */}
      {plans.length > 0 && (
        <>
          <SectionTitle>Plans</SectionTitle>
          <Card className="mb-6">
            {plans.map((pl) => (
              <ListRow
                key={pl.id}
                icon={pl.kind === "diet" ? "apple" : "dumbbell"}
                iconBg="rgba(0,200,83,0.15)"
                title={pl.title}
                subtitle="Tap to open"
                onClick={() => setOpenPlan(pl)}
              />
            ))}
          </Card>
        </>
      )}

      {/* shared events */}
      <SectionTitle>Events together</SectionTitle>
      <Card className="mb-6">
        {events.length === 0 ? (
          <EmptyState icon="receipt" title="No events yet" hint="Splits you share will show up here" />
        ) : (
          events.map((e) => (
            <Link href={`/groups/${e.activity.group_id}`} key={e.activity.id}>
              <ListRow
                icon="receipt"
                iconBg={e.friendBalance > 0 ? "rgba(48,209,88,0.15)" : e.friendBalance < 0 ? "rgba(255,159,10,0.15)" : "rgba(142,142,147,0.15)"}
                title={e.activity.title}
                subtitle={`${e.groupName} · ${formatDayLabel(e.activity.occurred_at)} · total ${formatMoney(e.activity.total_amount, currency)}`}
                right={
                  e.friendBalance > 0 ? (
                    <span className="text-green text-[14px] font-semibold tabular-nums">owes {formatMoney(e.friendBalance, currency)}</span>
                  ) : e.friendBalance < 0 ? (
                    <span className="text-orange text-[14px] font-semibold tabular-nums">you owe {formatMoney(-e.friendBalance, currency)}</span>
                  ) : (
                    <span className="text-sub text-[13px]">settled</span>
                  )
                }
              />
            </Link>
          ))
        )}
      </Card>

      {openPlan && <PlanSheet plan={openPlan} onClose={() => setOpenPlan(null)} />}

      {/* unfriend */}
      {friendship && (
        confirming ? (
          <div className="card card-pad">
            <p className="text-[15px] text-center mb-3">Remove {p?.display_name?.split(" ")[0] ?? "them"} as a friend?</p>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirming(false)}>Keep friend</button>
              <button
                className="btn btn-danger flex-1"
                onClick={async () => {
                  await removeFriendship(friendship.id);
                  router.replace("/groups");
                }}
              >
                Unfriend
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>
            <Icon name="x" size={16} /> Unfriend
          </button>
        )
      )}
    </div>
  );
}


