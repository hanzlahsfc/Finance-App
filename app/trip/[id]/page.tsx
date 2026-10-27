"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useTrip, useProfileMap } from "@/lib/hooks";
import { formatMoney, formatDayLabel, toISODate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { UserPicker } from "@/components/UserPicker";
import { addTripMember, removeTripMember, deleteTrip, addTripContribution, approveTripContribution, deleteTripContribution } from "@/lib/actions";
import type { TripMember, TripContribution } from "@/lib/types";

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const data = useTrip(id);
  const profileMap = useProfileMap();

  const [payOpen, setPayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmTripDel, setConfirmTripDel] = useState(false);
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [confirmContribDel, setConfirmContribDel] = useState<string | null>(null);

  if (!session) return null;
  if (!data || !data.trip) {
    return (
      <div className="screen px-5 pt-14">
        <Link href="/trip" className="text-tint"><Icon name="chevronLeft" size={26} /></Link>
        <EmptyState icon="send" title="Trip not found" hint="It may still be syncing" />
      </div>
    );
  }

  const { trip, members, contributions } = data;
  const isCollector = trip.collector_id === uid;
  const isCreator = trip.created_by === uid;
  const isMember = members.some((m) => m.user_id === uid);
  const nameOf = (userId: string) => (userId === uid ? "You" : profileMap.get(userId)?.display_name ?? "…");

  const pending = contributions.filter((c) => c.status === "pending");
  const mine = contributions.filter((c) => c.user_id === uid);
  const sorted = [...members].sort((a, b) =>
    (a.user_id === trip.collector_id ? 0 : 1) - (b.user_id === trip.collector_id ? 0 : 1)
  );

  return (
    <div className="screen px-5 pt-14">
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-tint p-1 -ml-1" aria-label="Back">
          <Icon name="chevronLeft" size={26} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] font-bold truncate">{trip.name}</h1>
        </div>
        <span className="pill bg-card2 text-sub">
          <Icon name="wallet" size={13} /> {nameOf(trip.collector_id)} collects
        </span>
      </div>

      {/* members + progress */}
      <SectionTitle>Everyone&apos;s progress</SectionTitle>
      <Card className="mb-5">
        {sorted.map((m) => (
          <MemberRow
            key={m.user_id}
            m={m}
            target={trip.target_amount}
            currency={currency}
            name={nameOf(m.user_id)}
            isCollector={m.user_id === trip.collector_id}
            avatarUrl={profileMap.get(m.user_id)?.avatar_url}
            canKick={isCreator && m.user_id !== uid && m.user_id !== trip.collector_id}
            confirming={confirmKick === m.user_id}
            onConfirmKick={() => setConfirmKick(m.user_id)}
            onKick={async () => { await removeTripMember(trip.id, m.user_id); setConfirmKick(null); }}
          />
        ))}
      </Card>

      {/* actions */}
      <div className="flex gap-2 mb-6">
        {isMember && (
          <button className="btn flex-1" onClick={() => setPayOpen(true)}>
            <Icon name="plus" size={17} /> Add payment
          </button>
        )}
        {isCreator && (
          <button className="btn btn-secondary flex-1" onClick={() => setAddOpen(true)}>
            <Icon name="userPlus" size={17} /> Add person
          </button>
        )}
      </div>

      {/* payments feed */}
      {isCollector ? (
        <>
          <SectionTitle>Payments to approve</SectionTitle>
          <Card className="mb-5">
            {pending.length === 0 ? (
              <p className="card-pad text-sub text-[14px] text-center py-5">Nothing waiting on you</p>
            ) : (
              pending.map((c) => (
                <ContribRow
                  key={c.id}
                  c={c}
                  currency={currency}
                  name={nameOf(c.user_id)}
                  right={
                    <button className="pill bg-tint text-white" onClick={async () => approveTripContribution(c)}>
                      <Icon name="check" size={12} /> Received
                    </button>
                  }
                />
              ))
            )}
          </Card>
          <SectionTitle>Received</SectionTitle>
          <Card className="mb-5">
            {contributions.filter((c) => c.status === "received").length === 0 ? (
              <p className="card-pad text-sub text-[14px] text-center py-5">No confirmed payments yet</p>
            ) : (
              contributions.filter((c) => c.status === "received").map((c) => (
                <ContribRow key={c.id} c={c} currency={currency} name={nameOf(c.user_id)} />
              ))
            )}
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>Your payments</SectionTitle>
          <Card className="mb-5">
            {mine.length === 0 ? (
              <p className="card-pad text-sub text-[14px] text-center py-5">
                Add a payment when you hand money to {nameOf(trip.collector_id).split(" ")[0]}
              </p>
            ) : (
              mine.map((c) => (
                <ContribRow
                  key={c.id}
                  c={c}
                  currency={currency}
                  name={nameOf(c.user_id)}
                  right={
                    c.status === "pending" ? (
                      confirmContribDel === c.id ? (
                        <button
                          className="pill text-red"
                          style={{ background: "rgba(255,69,58,0.15)" }}
                          onClick={async () => { await deleteTripContribution(c); setConfirmContribDel(null); }}
                        >
                          Delete?
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="pill bg-[rgba(255,159,10,0.15)] text-orange">Waiting</span>
                          <button
                            aria-label="Remove payment"
                            className="text-sub2 p-1"
                            onClick={() => setConfirmContribDel(c.id)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="pill bg-[rgba(48,209,88,0.15)] text-green">
                        <Icon name="check" size={12} /> Received
                      </span>
                    )
                  }
                />
              ))
            )}
          </Card>
        </>
      )}

      {/* delete trip */}
      {isCreator &&
        (confirmTripDel ? (
          <div className="card card-pad">
            <p className="text-[15px] text-center mb-3">Delete this trip and its history?</p>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirmTripDel(false)}>Keep it</button>
              <button
                className="btn btn-danger flex-1"
                onClick={async () => { await deleteTrip(trip.id); router.replace("/trip"); }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmTripDel(true)}>
            <Icon name="trash" size={16} /> Delete trip
          </button>
        ))}

      {payOpen && (
        <PaySheet tripId={trip.id} uid={uid!} target={trip.target_amount} currency={currency} onClose={() => setPayOpen(false)} />
      )}

      {addOpen && (
        <Sheet title="Add person" onClose={() => setAddOpen(false)}>
          <UserPicker
            uid={uid!}
            excludeIds={new Set(members.map((m) => m.user_id))}
            onPick={async (p) => { await addTripMember(trip.id, p.id, uid!); }}
          />
        </Sheet>
      )}
    </div>
  );
}

function MemberRow({
  m, target, currency, name, isCollector, avatarUrl, canKick, confirming, onConfirmKick, onKick,
}: {
  m: TripMember;
  target: number;
  currency: string;
  name: string;
  isCollector: boolean;
  avatarUrl?: string | null;
  canKick: boolean;
  confirming: boolean;
  onConfirmKick: () => void;
  onKick: () => void;
}) {
  const done = target > 0 && m.paid_amount >= target;
  const pct = target ? Math.min(100, (m.paid_amount / target) * 100) : 0;
  return (
    <div className="list-row !flex-col !items-stretch gap-2">
      <div className="flex items-center gap-3">
        <Avatar name={name} id={m.user_id} size={38} src={avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium truncate">
            {name}
            {isCollector && <span className="text-sub text-[12px]"> · collector</span>}
          </div>
          <div className="progress-track mt-1.5" style={{ width: 110 }}>
            <div
              className="progress-fill"
              style={{ width: `${pct}%`, background: done ? "var(--color-green)" : "var(--color-tint)" }}
            />
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {done && <span className="pill bg-[rgba(48,209,88,0.15)] text-green"><Icon name="check" size={12} /> Done</span>}
          <p className="text-[15px] font-semibold tabular-nums">
            {formatMoney(m.paid_amount, currency)}
            <span className="text-sub text-[12px] font-medium"> / {target.toLocaleString("en-PK")}</span>
          </p>
          {canKick &&
            (confirming ? (
              <button className="pill text-red" style={{ background: "rgba(255,69,58,0.15)" }} onClick={onKick}>
                Remove?
              </button>
            ) : (
              <button aria-label={`Remove ${name}`} className="text-sub2 p-1" onClick={onConfirmKick}>
                <Icon name="x" size={15} />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ContribRow({
  c, currency, name, right,
}: {
  c: TripContribution;
  currency: string;
  name: string;
  right?: React.ReactNode;
}) {
  return (
    <ListRow
      icon="wallet"
      iconBg={c.status === "received" ? "rgba(48,209,88,0.15)" : "rgba(255,159,10,0.15)"}
      title={`${name} · ${formatMoney(c.amount, currency)}`}
      subtitle={`paid ${formatDayLabel(c.paid_at)}${c.received_at ? ` · received ${formatDayLabel(c.received_at)}` : ""}`}
      right={right}
    />
  );
}

function PaySheet({ tripId, uid, target, currency, onClose }: {
  tripId: string; uid: string; target: number; currency: string; onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title="Add payment" onClose={onClose}>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <div className="flex gap-2 justify-center mb-5">
        {target > 0 && (
          <button className="pill bg-card2 text-sub" onClick={() => setAmount(String(target))}>
            Full: {formatMoney(target, currency)}
          </button>
        )}
      </div>
      <label className="section-title">Date paid</label>
      <input className="input mb-6" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button
        className="btn"
        disabled={parsed <= 0 || !date}
        onClick={async () => {
          await addTripContribution({ trip_id: tripId, user_id: uid, amount: parsed, paid_at: new Date(date).toISOString() });
          onClose();
        }}
      >
        Mark as paid
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Counts toward your total once the collector confirms receipt.</p>
    </Sheet>
  );
}
