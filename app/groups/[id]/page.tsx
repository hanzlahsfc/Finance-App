"use client";

import { useMemo, useState, use } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useGroup, useProfileMap, useFriendships } from "@/lib/hooks";
import { formatMoney, formatDayLabel } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { createActivity, deleteActivity, transferActivityAdmin, recordPayment, addGroupMember, renameGroup, updateActivity, updateSplit, insertSplit, deleteSplit } from "@/lib/actions";
import type { Activity, ActivitySplit, GroupMember } from "@/lib/types";

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const data = useGroup(id);
  const profileMap = useProfileMap();
  const friendships = useFriendships(uid);

  const [newActOpen, setNewActOpen] = useState(false);
  const [selActivity, setSelActivity] = useState<Activity | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const nameOf = (userId: string) =>
    userId === uid ? "You" : profileMap.get(userId)?.display_name ?? "…";

  const balance = useMemo(() => {
    if (!data) return { owed: 0, iOwe: 0 };
    let owed = 0, iOwe = 0;
    const paidByMe = new Set(data.activities.filter((a) => a.paid_by === uid).map((a) => a.id));
    for (const s of data.splits) {
      const rem = s.owed_amount - s.settled_amount;
      if (rem <= 0) continue;
      if (s.user_id === uid && !paidByMe.has(s.activity_id)) iOwe += rem;
      else if (s.user_id !== uid && paidByMe.has(s.activity_id)) owed += rem;
    }
    return { owed, iOwe };
  }, [data, uid]);

  if (!session) return null;
  if (!data || !data.group) {
    return (
      <div className="screen px-5 pt-14">
        <Link href="/groups" className="text-tint"><Icon name="chevronLeft" size={26} /></Link>
        <EmptyState icon="people" title="Group not found" hint="It may still be syncing" />
      </div>
    );
  }

  const splitsFor = (a: Activity) => data.splits.filter((s) => s.activity_id === a.id);
  const memberIds = new Set(data.members.map((m) => m.user_id));
  const friendIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => (f.user_id === uid ? f.friend_id : f.user_id))
    .filter((f) => !memberIds.has(f));

  return (
    <div className="screen px-5 pt-14">
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/groups" className="text-tint"><Icon name="chevronLeft" size={26} /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] font-bold truncate">{data.group.name}</h1>
        </div>
        <button className="text-sub p-1" onClick={() => setSettingsOpen(true)}><Icon name="gear" size={22} /></button>
      </div>

      {/* members */}
      <div className="flex gap-3 mb-5 overflow-x-auto no-scrollbar">
        {data.members.map((m) => (
          <div key={m.user_id} className="flex flex-col items-center gap-1 shrink-0">
            <Avatar name={profileMap.get(m.user_id)?.display_name ?? "?"} id={m.user_id} size={46} src={profileMap.get(m.user_id)?.avatar_url} />
            <span className="text-[11px] text-sub max-w-[56px] truncate">
              {m.user_id === uid ? "You" : (profileMap.get(m.user_id)?.display_name ?? "…").split(" ")[0]}
            </span>
          </div>
        ))}
      </div>

      {/* balance */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="card-pad">
          <p className="text-[12px] text-sub mb-1">You&apos;re owed</p>
          <p className="text-[20px] font-bold tabular-nums text-green">{formatMoney(balance.owed, currency)}</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[12px] text-sub mb-1">You owe</p>
          <p className="text-[20px] font-bold tabular-nums text-orange">{formatMoney(balance.iOwe, currency)}</p>
        </Card>
      </div>

      {/* activities */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">Activities</span>
        <button className="text-tint text-[14px] font-medium flex items-center gap-1" onClick={() => setNewActOpen(true)}>
          <Icon name="plus" size={15} /> Add expense
        </button>
      </div>

      {data.activities.length === 0 ? (
        <Card>
          <EmptyState icon="receipt" title="No shared expenses" hint="Add one — e.g. &quot;Biryani&quot; — and pick who paid" />
        </Card>
      ) : (
        data.activities.map((a) => {
          const splits = splitsFor(a);
          const remaining = splits
            .filter((x) => x.user_id !== a.paid_by)
            .reduce((s, x) => s + Math.max(0, x.owed_amount - x.settled_amount), 0);
          const myShare = splits.find((s) => s.user_id === uid);
          const myRem = myShare ? Math.max(0, myShare.owed_amount - myShare.settled_amount) : 0;
          return (
            <Card key={a.id} className="card-pad mb-3" >
              <div className="flex justify-between items-start" onClick={() => setSelActivity(a)} role="button">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold truncate">{a.title}</p>
                  <p className="text-sub text-[13px] mt-0.5">
                    {nameOf(a.paid_by)} paid {formatMoney(a.total_amount, currency)} · {formatDayLabel(a.occurred_at)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {a.paid_by === uid ? (
                    <p className={`text-[14px] font-semibold ${remaining > 0 ? "text-green" : "text-sub"}`}>
                      {remaining > 0 ? `owed ${formatMoney(remaining, currency)}` : "settled"}
                    </p>
                  ) : myRem > 0 ? (
                    <p className="text-[14px] font-semibold text-orange">you owe {formatMoney(myRem, currency)}</p>
                  ) : (
                    <p className="text-[14px] font-semibold text-sub">settled</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}
      <div className="h-4" />

      {newActOpen && (
        <NewActivitySheet
          groupId={id}
          uid={uid!}
          members={data.members}
          profileMap={profileMap}
          onClose={() => setNewActOpen(false)}
        />
      )}
      {selActivity && (
        <ActivitySheet
          activity={selActivity}
          splits={splitsFor(selActivity)}
          members={data.members}
          settlements={data.settlements.filter((s) => s.activity_id === selActivity.id)}
          uid={uid!}
          currency={currency}
          profileMap={profileMap}
          onClose={() => setSelActivity(null)}
        />
      )}
      {settingsOpen && (
        <GroupSettings
          groupId={id}
          name={data.group.name}
          isCreator={data.group.created_by === uid}
          friendIds={friendIds}
          profileMap={profileMap}
          uid={uid!}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ---------- new activity ----------

function NewActivitySheet({
  groupId, uid, members, profileMap, onClose,
}: {
  groupId: string;
  uid: string;
  members: GroupMember[];
  profileMap: Map<string, { display_name: string; avatar_url?: string | null }>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [paidBy, setPaidBy] = useState(uid);
  const [included, setIncluded] = useState<Set<string>>(new Set(members.map((m) => m.user_id)));
  const [custom, setCustom] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(total.replace(/,/g, "")) || 0;
  const includedIds = members.map((m) => m.user_id).filter((id) => included.has(id));
  const isCustom = custom.size > 0;
  const perHead = includedIds.length ? parsed / includedIds.length : 0;

  const splits = includedIds.map((id) => ({
    user_id: id,
    owed_amount: isCustom ? parseFloat(custom.get(id) ?? "") || 0 : Math.round((perHead + Number.EPSILON) * 100) / 100,
  }));
  const splitsTotal = splits.reduce((s, x) => s + x.owed_amount, 0);
  const valid = title.trim() && parsed > 0 && includedIds.length > 0 && (!isCustom || Math.abs(splitsTotal - parsed) < 0.01);

  const toggle = (id: string) => {
    const s = new Set(included);
    if (s.has(id)) { s.delete(id); const c = new Map(custom); c.delete(id); setCustom(c); }
    else s.add(id);
    setIncluded(s);
  };

  return (
    <Sheet title="Add shared expense" onClose={onClose}>
      <input className="input mb-3" placeholder="What was it? — e.g. Biryani, petrol, movie" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 mb-5">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Total amount" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>

      <label className="section-title">Who paid?</label>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {members.map((m) => (
          <button
            key={m.user_id}
            className={`pill shrink-0 ${paidBy === m.user_id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
            onClick={() => setPaidBy(m.user_id)}
          >
            {m.user_id === uid ? "You" : (profileMap.get(m.user_id)?.display_name ?? "…").split(" ")[0]}
          </button>
        ))}
      </div>

      <label className="section-title">Split between</label>
      <div className="card mb-3">
        {members.map((m) => {
          const on = included.has(m.user_id);
          const name = m.user_id === uid ? "You" : profileMap.get(m.user_id)?.display_name ?? "…";
          return (
            <ListRow
              key={m.user_id}
              icon={<Avatar name={name} id={m.user_id} size={34} src={profileMap.get(m.user_id)?.avatar_url} />}
              title={name}
              right={
                on ? (
                  <input
                    className="input !py-1.5 text-right tabular-nums"
                    style={{ width: 96 }}
                    placeholder={perHead ? perHead.toFixed(0) : "0"}
                    inputMode="decimal"
                    value={custom.get(m.user_id) ?? ""}
                    onChange={(e) => {
                      const c = new Map(custom);
                      const v = e.target.value.replace(/[^\d.]/g, "");
                      if (v) c.set(m.user_id, v); else c.delete(m.user_id);
                      setCustom(c);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : undefined
              }
              onClick={() => toggle(m.user_id)}
            />
          );
        })}
      </div>

      <p className={`text-[13px] mb-5 px-1 ${isCustom ? (Math.abs(splitsTotal - parsed) < 0.01 ? "text-green" : "text-orange") : "text-sub"}`}>
        {isCustom
          ? `Custom split: ${splitsTotal.toFixed(0)} of ${parsed.toFixed(0)} allocated`
          : `Split equally — ${perHead ? formatMoney(perHead) : "—"} each`}
      </p>

      <button
        className="btn"
        disabled={!valid || saving}
        onClick={async () => {
          setSaving(true);
          await createActivity({
            group_id: groupId, created_by: uid, paid_by: paidBy,
            title, total_amount: parsed, splits,
          });
          onClose();
        }}
      >
        Add expense
      </button>
    </Sheet>
  );
}

// ---------- activity detail ----------

function ActivitySheet({
  activity, splits, members, settlements, uid, currency, profileMap, onClose,
}: {
  activity: Activity;
  splits: ActivitySplit[];
  members: GroupMember[];
  settlements: { from_user: string; amount: number; note: string; created_at?: string }[];
  uid: string;
  currency: string;
  profileMap: Map<string, { display_name: string; avatar_url?: string | null }>;
  onClose: () => void;
}) {
  const [paySheet, setPaySheet] = useState<string | null>(null); // from_user
  const [adminOpen, setAdminOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const isAdmin = activity.created_by === uid;
  const nameOf = (id: string) => (id === uid ? "You" : profileMap.get(id)?.display_name ?? "…");

  return (
    <Sheet title={activity.title} onClose={onClose}>
      <div className="text-center py-3">
        <p className="text-[34px] font-bold tabular-nums">{formatMoney(activity.total_amount, currency)}</p>
        <p className="text-sub text-[14px]">{nameOf(activity.paid_by)} paid · {formatDayLabel(activity.occurred_at)}</p>
      </div>

      <div className="card mb-4">
        {splits.map((s) => {
          const rem = Math.max(0, s.owed_amount - s.settled_amount);
          const isPayer = s.user_id === activity.paid_by;
          const done = rem <= 0;
          const canRecord =
            !isPayer && !done &&
            (s.user_id === uid || activity.paid_by === uid || isAdmin);
          return (
            <div key={s.id} className="list-row">
              <Avatar name={nameOf(s.user_id)} id={s.user_id} size={36} src={profileMap.get(s.user_id)?.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium">
                  {nameOf(s.user_id)}
                  {isPayer && <span className="text-sub text-[12px]"> · paid</span>}
                </div>
                <div className="progress-track mt-1.5" style={{ width: 110 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${s.owed_amount ? Math.min(100, (s.settled_amount / s.owed_amount) * 100) : 0}%`,
                      background: done || isPayer ? "var(--color-green)" : "var(--color-orange)",
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className={`text-[14px] font-semibold tabular-nums ${done || isPayer ? "text-sub" : "text-orange"}`}>
                  {done || isPayer ? formatMoney(s.owed_amount, currency) : `${formatMoney(rem, currency)} left`}
                </p>
                {canRecord && (
                  <button className="text-tint text-[13px] font-medium" onClick={() => setPaySheet(s.user_id)}>
                    Record payment
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {settlements.length > 0 && (
        <>
          <SectionTitle>Payments</SectionTitle>
          <div className="card mb-4">
            {settlements.map((st, i) => (
              <ListRow
                key={i}
                icon="check"
                iconBg="rgba(48,209,88,0.15)"
                title={`${nameOf(st.from_user)} paid ${formatMoney(st.amount, currency)}`}
                subtitle={st.created_at ? formatDayLabel(st.created_at) : st.note || undefined}
              />
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>
            <Icon name="pencil" size={16} /> Edit event
          </button>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-secondary flex-1" onClick={() => setAdminOpen(true)}>
              <Icon name="crown" size={17} /> Transfer admin
            </button>
            <button
              className="btn btn-danger flex-1"
              onClick={async () => { await deleteActivity(activity.id); onClose(); }}
            >
              <Icon name="trash" size={17} /> Delete
            </button>
          </div>
        </>
      )}

      {paySheet && (
        <PaySheetInner
          activity={activity}
          fromUser={paySheet}
          max={Math.max(0, (splits.find((s) => s.user_id === paySheet)?.owed_amount ?? 0) - (splits.find((s) => s.user_id === paySheet)?.settled_amount ?? 0))}
          name={nameOf(paySheet)}
          uid={uid}
          currency={currency}
          onClose={() => setPaySheet(null)}
        />
      )}

      {editOpen && (
        <EditActivitySheet
          activity={activity}
          splits={splits}
          members={members}
          profileMap={profileMap}
          nameOf={nameOf}
          onClose={() => setEditOpen(false)}
        />
      )}

      {adminOpen && (
        <Sheet title="Transfer admin" onClose={() => setAdminOpen(false)}>
          <div className="card">
            {members.filter((m) => m.user_id !== activity.created_by).map((m) => (
              <ListRow
                key={m.user_id}
                icon={<Avatar name={nameOf(m.user_id)} id={m.user_id} size={36} src={profileMap.get(m.user_id)?.avatar_url} />}
                title={nameOf(m.user_id)}
                onClick={async () => {
                  await transferActivityAdmin(activity, m.user_id);
                  setAdminOpen(false);
                }}
              />
            ))}
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function EditActivitySheet({
  activity, splits, members, profileMap, nameOf, onClose,
}: {
  activity: Activity;
  splits: ActivitySplit[];
  members: GroupMember[];
  profileMap: Map<string, { display_name: string; avatar_url?: string | null }>;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(activity.title);
  const [total, setTotal] = useState(String(activity.total_amount));
  const [paidBy, setPaidBy] = useState(activity.paid_by);
  // people: existing splits + members added via the picker, minus removed
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Map<string, string>>(
    new Map(splits.map((s) => [s.user_id, String(s.owed_amount)]))
  );
  const [paids, setPaids] = useState<Map<string, string>>(
    new Map(splits.map((s) => [s.user_id, String(s.settled_amount)]))
  );
  const [saving, setSaving] = useState(false);

  const existingIds = splits.map((s) => s.user_id);
  const activeIds = [
    ...existingIds.filter((id) => !removed.has(id)),
    ...[...added].filter((id) => !existingIds.includes(id)),
  ];
  const addable = members.map((m) => m.user_id).filter((id) => !activeIds.includes(id));

  const totalParsed = parseFloat(total.replace(/,/g, "")) || 0;
  const amt = (id: string) => parseFloat(amounts.get(id) ?? "") || 0;
  const paid = (id: string) => parseFloat(paids.get(id) ?? "") || 0;
  const splitSum = activeIds.reduce((s, id) => s + amt(id), 0);
  const paidExceeds = activeIds.some((id) => paid(id) > amt(id));
  const ok = title.trim() && totalParsed > 0 && activeIds.length > 0 && Math.abs(splitSum - totalParsed) < 0.5 && !paidExceeds;

  const remove = (id: string) => {
    const r = new Set(removed); r.add(id); setRemoved(r);
    const a = new Set(added); a.delete(id); setAdded(a);
  };
  const add = (id: string) => {
    const r = new Set(removed); r.delete(id); setRemoved(r);
    const a = new Set(added); a.add(id); setAdded(a);
    const am = new Map(amounts); if (!am.has(id)) am.set(id, ""); setAmounts(am);
    const pd = new Map(paids); if (!pd.has(id)) pd.set(id, ""); setPaids(pd);
  };

  return (
    <Sheet title="Edit event" onClose={onClose}>
      <input className="input mb-3" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>

      <label className="section-title">Paid by</label>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {activeIds.map((id) => (
          <button
            key={id}
            className={`pill shrink-0 ${paidBy === id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
            onClick={() => setPaidBy(id)}
          >
            {nameOf(id).split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="flex justify-between px-2 mb-1">
        <span className="section-title !mb-0">Shares</span>
        <span className="text-[11px] text-sub2 self-end">share · paid so far</span>
      </div>
      <div className="card mb-3">
        {activeIds.map((id) => {
          const s = splits.find((x) => x.user_id === id);
          const isPayer = id === paidBy;
          return (
            <div key={id} className="list-row !px-2">
              <Avatar name={nameOf(id)} id={id} size={32} src={profileMap.get(id)?.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate">
                  {nameOf(id)}
                  {isPayer && <span className="text-tint text-[11px]"> · paid the bill</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  className="input !py-2 text-right tabular-nums"
                  style={{ width: 76 }}
                  placeholder="share"
                  inputMode="decimal"
                  value={amounts.get(id) ?? ""}
                  onChange={(e) => setAmounts(new Map(amounts).set(id, e.target.value.replace(/[^\d.]/g, "")))}
                />
                {!isPayer ? (
                  <input
                    className="input !py-2 text-right tabular-nums"
                    style={{ width: 76 }}
                    placeholder="paid"
                    inputMode="decimal"
                    value={paids.get(id) ?? ""}
                    onChange={(e) => setPaids(new Map(paids).set(id, e.target.value.replace(/[^\d.]/g, "")))}
                  />
                ) : (
                  <span className="pill bg-[rgba(48,209,88,0.15)] text-green" style={{ width: 76, justifyContent: "center" }}>paid</span>
                )}
                {(!s || s.settled_amount === 0) && activeIds.length > 1 ? (
                  <button className="text-sub2 p-1" onClick={() => remove(id)}>
                    <Icon name="x" size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {addable.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {addable.map((id) => (
            <button key={id} className="pill shrink-0 bg-card2 text-sub flex items-center gap-1.5" onClick={() => add(id)}>
              <Icon name="plus" size={12} /> {nameOf(id).split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <p className={`text-[13px] px-1 mb-4 ${ok ? "text-sub2" : "text-red"}`}>
        {paidExceeds
          ? "Someone's paid amount is more than their share"
          : `Shares must add up to the total — currently ${formatMoney(splitSum, "PKR")}`}
      </p>
      <button
        className="btn"
        disabled={!ok || saving}
        onClick={async () => {
          setSaving(true);
          const payerChanged = paidBy !== activity.paid_by;
          await updateActivity(activity, { title: title.trim(), total_amount: totalParsed, paid_by: paidBy });
          for (const id of removed) {
            const s = splits.find((x) => x.user_id === id);
            if (s) await deleteSplit(s.id);
          }
          for (const id of activeIds) {
            const v = amt(id);
            const p = id === paidBy ? v : paid(id);
            const s = splits.find((x) => x.user_id === id);
            if (!s) {
              await insertSplit(activity.id, id, v, p);
            } else {
              const patch: { owed_amount?: number; settled_amount?: number } = {};
              if (v !== s.owed_amount) patch.owed_amount = v;
              if (p !== s.settled_amount) patch.settled_amount = p;
              if (patch.owed_amount !== undefined || patch.settled_amount !== undefined || payerChanged) {
                if (payerChanged && patch.settled_amount === undefined && s.settled_amount !== (id === paidBy ? v : s.settled_amount)) {
                  patch.settled_amount = id === paidBy ? v : s.settled_amount;
                }
                await updateSplit(s, patch);
              }
            }
          }
          // payer change: reset the old payer's settled flag if they didn't keep it
          if (payerChanged) {
            const oldPayer = splits.find((x) => x.user_id === activity.paid_by);
            if (oldPayer && oldPayer.settled_amount !== paid(oldPayer.user_id)) {
              await updateSplit(oldPayer, { settled_amount: paid(oldPayer.user_id) });
            }
          }
          onClose();
        }}
      >
        Save changes
      </button>
    </Sheet>
  );
}

function PaySheetInner({
  activity, fromUser, max, name, uid, currency, onClose,
}: {
  activity: Activity; fromUser: string; max: number; name: string; uid: string; currency: string; onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  const valid = parsed > 0 && parsed <= max;
  return (
    <Sheet title={`Payment from ${name}`} onClose={onClose}>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <button className="pill bg-card2 text-sub mx-auto mb-5" onClick={() => setAmount(String(max))}>
        Full amount: {formatMoney(max, currency)}
      </button>
      <button
        className="btn"
        disabled={!valid}
        onClick={async () => {
          await recordPayment({ activity, from_user: fromUser, amount: parsed, recorded_by: uid });
          onClose();
        }}
      >
        Record {valid ? formatMoney(parsed, currency) : "payment"}
      </button>
      {parsed > max && <p className="text-red text-[13px] text-center mt-2">Can&apos;t exceed {formatMoney(max, currency)}</p>}
    </Sheet>
  );
}

// ---------- group settings ----------

function GroupSettings({
  groupId, name, isCreator, friendIds, profileMap, uid, onClose,
}: {
  groupId: string; name: string; isCreator: boolean; friendIds: string[];
  profileMap: Map<string, { display_name: string; username: string; avatar_url?: string | null }>;
  uid: string; onClose: () => void;
}) {
  const [newName, setNewName] = useState(name);
  return (
    <Sheet title="Group settings" onClose={onClose}>
      {isCreator && (
        <>
          <label className="section-title">Name</label>
          <div className="flex gap-2 mb-5">
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button
              className="btn !w-auto px-5"
              disabled={newName.trim() === name || !newName.trim()}
              onClick={async () => { await renameGroup(groupId, newName); }}
            >
              Save
            </button>
          </div>
        </>
      )}
      <label className="section-title">Add friends to group</label>
      <div className="card">
        {friendIds.length === 0 ? (
          <p className="card-pad text-sub text-[14px] text-center py-5">All your friends are already here</p>
        ) : (
          friendIds.map((fid) => {
            const p = profileMap.get(fid);
            return (
              <ListRow
                key={fid}
                icon={<Avatar name={p?.display_name ?? "?"} id={fid} size={36} src={p?.avatar_url} />}
                title={p?.display_name ?? "…"}
                subtitle={`@${p?.username ?? ""}`}
                right={
                  <button className="pill bg-tint text-white" onClick={() => addGroupMember(groupId, fid, uid)}>
                    Add
                  </button>
                }
              />
            );
          })
        )}
      </div>
    </Sheet>
  );
}
