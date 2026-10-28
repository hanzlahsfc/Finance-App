"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useCommittee, useProfileMap, committeeMonth } from "@/lib/hooks";
import { formatMoney, formatDayLabel, toISODate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { UserPicker } from "@/components/UserPicker";
import {
  addCommitteeMember, removeCommitteeMember, reorderCommitteeMembers, deleteCommittee, updateCommittee,
  addCommitteePayment, approveCommitteePayment, deleteCommitteePayment,
  markPotPaid, unmarkPotPaid,
} from "@/lib/actions";
import type { Committee, CommitteeMember, CommitteePayment } from "@/lib/types";

export default function CommitteeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const data = useCommittee(id);
  const profileMap = useProfileMap();

  const [payOpen, setPayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [confirmPayDel, setConfirmPayDel] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  if (!session) return null;
  if (!data || !data.committee) {
    return (
      <div className="screen px-5 pt-14">
        <button onClick={() => router.back()} className="text-tint"><Icon name="chevronLeft" size={26} /></button>
        <EmptyState icon="coins" title="Committee not found" hint="It may still be syncing" />
      </div>
    );
  }

  const { committee, members, payments, payouts } = data;
  const isCollector = committee.collector_id === uid;
  const isCreator = committee.created_by === uid;
  const isMember = members.some((m) => m.user_id === uid);
  const nameOf = (userId: string) => (userId === uid ? "You" : profileMap.get(userId)?.display_name ?? "…");

  const month = committeeMonth(committee.start_month);
  const n = members.length;
  const recipientId = n ? members.find((m) => m.position === ((month - 1) % n) + 1)?.user_id : undefined;
  const monthPayments = payments.filter((p) => p.month === month);
  const received = monthPayments.filter((p) => p.status === "received");
  const pot = committee.amount * n;
  const collected = received.reduce((s, p) => s + p.amount, 0);
  const potPaid = payouts.some((p) => p.month === month);
  const myPayment = monthPayments.find((p) => p.user_id === uid);
  const statusOf = (userId: string) => monthPayments.find((p) => p.user_id === userId)?.status;

  return (
    <div className="screen px-5 pt-14">
      {/* header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="text-tint p-1 -ml-1" aria-label="Back">
          <Icon name="chevronLeft" size={26} />
        </button>
        <h1 className="text-[26px] font-bold truncate flex-1">{committee.name}</h1>
        {(isCreator || isCollector) && (
          <button className="text-sub p-1" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Icon name="gear" size={22} />
          </button>
        )}
      </div>
      <p className="text-sub text-[14px] mb-5 flex items-center gap-1.5">
        <Icon name="wallet" size={14} /> {formatMoney(committee.amount, currency)}/mo each · {nameOf(committee.collector_id)} collects
      </p>

      {/* this month hero */}
      <Card className="card-pad mb-6 text-center">
        <p className="text-[12px] text-sub uppercase tracking-wide mb-1">Month {month}</p>
        <p className="text-[22px] font-bold">{nameOf(recipientId ?? "")}&apos;s pot</p>
        <p className="text-sub text-[13px] mt-1 mb-4">
          {formatMoney(collected, currency)} collected of {formatMoney(pot, currency)}
          {potPaid ? " · pot handed over" : ""}
        </p>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${pot ? Math.min(100, (collected / pot) * 100) : 0}%`, background: "linear-gradient(90deg, var(--color-tint), var(--color-purple))" }}
          />
        </div>
        {isCollector && !potPaid && (
          <button className="btn btn-secondary mt-4" onClick={async () => markPotPaid(committee.id, month)}>
            <Icon name="check" size={16} /> Mark pot handed to {nameOf(recipientId ?? "").split(" ")[0]}
          </button>
        )}
        {isCollector && potPaid && (
          <button className="text-sub text-[13px] mt-3" onClick={async () => unmarkPotPaid(committee.id, month)}>
            Undo — pot not handed yet
          </button>
        )}
      </Card>

      {/* actions */}
      <div className="flex gap-2 mb-6">
        {isMember && !myPayment && (
          <button className="btn flex-1" onClick={() => setPayOpen(true)}>
            <Icon name="plus" size={17} /> Pay {formatMoney(committee.amount, currency)}
          </button>
        )}
        {(isCreator || isCollector) && (
          <button className="btn btn-secondary flex-1" onClick={() => setAddOpen(true)}>
            <Icon name="userPlus" size={17} /> Add person
          </button>
        )}
      </div>

      {/* rotation */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">Payout order</span>
        {isCreator && (
          <button className="text-tint text-[14px] font-medium" onClick={() => setReorderOpen(true)}>
            Edit order
          </button>
        )}
      </div>
      <Card className="mb-6">
        {members.map((m) => {
          const mMonth = ((m.position - 1) % n) + 1 + Math.floor((month - 1) / n) * n;
          const st = statusOf(m.user_id);
          return (
            <RotationRow
              key={m.user_id}
              m={m}
              month={mMonth}
              name={nameOf(m.user_id)}
              avatarUrl={profileMap.get(m.user_id)?.avatar_url}
              isRecipient={m.user_id === recipientId}
              isCollector={m.user_id === committee.collector_id}
              status={st}
              canKick={isCreator && m.user_id !== uid && m.user_id !== committee.collector_id}
              confirming={confirmKick === m.user_id}
              onConfirmKick={() => setConfirmKick(m.user_id)}
              onKick={async () => { await removeCommitteeMember(committee.id, m.user_id); setConfirmKick(null); }}
            />
          );
        })}
      </Card>

      {/* this month's payments */}
      <SectionTitle>Month {month} payments</SectionTitle>
      <Card className="mb-6">
        {monthPayments.length === 0 ? (
          <p className="card-pad text-sub text-[14px] text-center py-5">No payments logged yet</p>
        ) : (
          monthPayments.map((p) => (
            <ListRow
              key={p.id}
              icon="wallet"
              iconBg={p.status === "received" ? "rgba(48,209,88,0.15)" : "rgba(255,159,10,0.15)"}
              title={`${nameOf(p.user_id)} · ${formatMoney(p.amount, currency)}`}
              subtitle={`paid ${formatDayLabel(p.paid_at)}${p.received_at ? ` · received ${formatDayLabel(p.received_at)}` : ""}`}
              right={
                p.status === "pending" && isCollector ? (
                  <button className="pill bg-tint text-white" onClick={async () => approveCommitteePayment(p)}>
                    <Icon name="check" size={12} /> Received
                  </button>
                ) : p.status === "pending" && p.user_id === uid ? (
                  confirmPayDel === p.id ? (
                    <button
                      className="pill text-red"
                      style={{ background: "rgba(255,69,58,0.15)" }}
                      onClick={async () => { await deleteCommitteePayment(p); setConfirmPayDel(null); }}
                    >
                      Delete?
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="pill bg-[rgba(255,159,10,0.15)] text-orange">Waiting</span>
                      <button aria-label="Remove payment" className="text-sub2 p-1" onClick={() => setConfirmPayDel(p.id)}>
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  )
                ) : p.status === "received" ? (
                  <span className="pill bg-[rgba(48,209,88,0.15)] text-green"><Icon name="check" size={12} /> Received</span>
                ) : (
                  <span className="pill bg-[rgba(255,159,10,0.15)] text-orange">Waiting</span>
                )
              }
            />
          ))
        )}
      </Card>

      {/* delete */}
      {isCreator &&
        (confirmDel ? (
          <div className="card card-pad">
            <p className="text-[15px] text-center mb-3">Delete this committee and its history?</p>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirmDel(false)}>Keep it</button>
              <button className="btn btn-danger flex-1" onClick={async () => { await deleteCommittee(committee.id); router.replace("/committee"); }}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>
            <Icon name="trash" size={16} /> Delete committee
          </button>
        ))}

      {payOpen && (
        <PaySheet
          committee={committee}
          month={month}
          uid={uid!}
          currency={currency}
          onClose={() => setPayOpen(false)}
        />
      )}

      {addOpen && (
        <Sheet title="Add person" onClose={() => setAddOpen(false)}>
          <UserPicker
            uid={uid!}
            excludeIds={new Set(members.map((m) => m.user_id))}
            onPick={async (p) => { await addCommitteeMember(committee.id, p.id, uid!); }}
          />
        </Sheet>
      )}

      {reorderOpen && (
        <ReorderSheet members={members} uid={uid!} nameOf={nameOf} onClose={() => setReorderOpen(false)} />
      )}

      {settingsOpen && (
        <CommitteeSettingsSheet committee={committee} members={members} uid={uid!} nameOf={nameOf} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function ReorderSheet({ members, uid, nameOf, onClose }: {
  members: CommitteeMember[];
  uid: string;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState(members.map((m) => m.user_id));
  const [saving, setSaving] = useState(false);
  const profileMap = useProfileMap();

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  };

  return (
    <Sheet title="Edit payout order" onClose={onClose}>
      <p className="text-sub text-[13px] mb-3 px-1">Who takes the pot each month, top to bottom.</p>
      <div className="card mb-5">
        {order.map((id, i) => (
          <div key={id} className="list-row">
            <span className="text-[15px] font-bold text-sub w-5 text-center shrink-0">{i + 1}</span>
            <Avatar name={nameOf(id)} id={id} size={32} src={profileMap.get(id)?.avatar_url} />
            <div className="flex-1 min-w-0 text-[15px] font-medium truncate">{nameOf(id)}</div>
            <div className="flex gap-1 shrink-0">
              <button aria-label="Move up" className="text-sub2 p-1.5" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="chevronDown" size={16} style={{ transform: "rotate(180deg)" }} />
              </button>
              <button aria-label="Move down" className="text-sub2 p-1.5" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <Icon name="chevronDown" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await reorderCommitteeMembers(members[0].committee_id, order);
          onClose();
        }}
      >
        Save order
      </button>
    </Sheet>
  );
}

function RotationRow({
  m, month, name, avatarUrl, isRecipient, isCollector, status, canKick, confirming, onConfirmKick, onKick,
}: {
  m: CommitteeMember;
  month: number;
  name: string;
  avatarUrl?: string | null;
  isRecipient: boolean;
  isCollector: boolean;
  status?: "pending" | "received";
  canKick: boolean;
  confirming: boolean;
  onConfirmKick: () => void;
  onKick: () => void;
}) {
  return (
    <div className="list-row">
      <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: isRecipient ? "var(--color-tint)" : "var(--color-card2)" }}>
        <span className={`text-[15px] font-bold ${isRecipient ? "text-white" : "text-sub"}`}>{m.position}</span>
      </span>
      <Avatar name={name} id={m.user_id} size={34} src={avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-medium truncate">
          {name}
          {isCollector && <span className="text-sub text-[12px]"> · collector</span>}
        </div>
        <div className="text-[13px] text-sub truncate">
          {isRecipient ? "takes the pot this month" : `pot in month ${month}`}
        </div>
      </div>
      {status === "received" && <Icon name="check" size={16} className="text-green shrink-0" />}
      {status === "pending" && <span className="pill bg-[rgba(255,159,10,0.15)] text-orange shrink-0">Waiting</span>}
      {canKick &&
        (confirming ? (
          <button className="pill text-red shrink-0" style={{ background: "rgba(255,69,58,0.15)" }} onClick={onKick}>
            Remove?
          </button>
        ) : (
          <button aria-label={`Remove ${name}`} className="text-sub2 p-1 shrink-0" onClick={onConfirmKick}>
            <Icon name="x" size={15} />
          </button>
        ))}
    </div>
  );
}

function PaySheet({ committee, month, uid, currency, onClose }: {
  committee: Committee; month: number; uid: string; currency: string; onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(committee.amount));
  const [date, setDate] = useState(toISODate(new Date()));
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title="Pay this month" onClose={onClose}>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <label className="section-title">Date paid</label>
      <input className="input mb-6" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button
        className="btn"
        disabled={parsed <= 0 || !date}
        onClick={async () => {
          await addCommitteePayment({ committee_id: committee.id, user_id: uid, month, amount: parsed, paid_at: new Date(date).toISOString() });
          onClose();
        }}
      >
        Mark as paid
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Counts once the collector confirms receipt.</p>
    </Sheet>
  );
}

function CommitteeSettingsSheet({ committee, members, uid, nameOf, onClose }: {
  committee: Committee;
  members: CommitteeMember[];
  uid: string;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const [name, setName] = useState(committee.name);
  const [amount, setAmount] = useState(String(committee.amount));
  const [collector, setCollector] = useState(committee.collector_id);
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  const valid = name.trim() && parsed > 0 && !saving;
  return (
    <Sheet title="Committee settings" onClose={onClose}>
      <label className="section-title">Name</label>
      <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="section-title">Monthly amount each</label>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <label className="section-title">Who collects the money?</label>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {members.map((m) => (
          <button
            key={m.user_id}
            className={`pill shrink-0 ${collector === m.user_id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
            onClick={() => setCollector(m.user_id)}
          >
            {nameOf(m.user_id).split(" ")[0]}
          </button>
        ))}
      </div>
      <button
        className="btn"
        disabled={!valid}
        onClick={async () => {
          setSaving(true);
          await updateCommittee(committee, { name: name.trim(), amount: parsed, collector_id: collector });
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
