"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/lib/store";
import { useTrips, useProfileMap } from "@/lib/hooks";
import { db } from "@/lib/db";
import { createTrip } from "@/lib/actions";
import { formatMoney } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { UserPicker } from "@/components/UserPicker";
import type { Trip, Profile } from "@/lib/types";

export default function TripPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const trips = useTrips(uid);
  const [createOpen, setCreateOpen] = useState(false);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center justify-between mb-6">
        <h1 className="large-title">Trip</h1>
        <button className="pill bg-tint text-white" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} /> New trip
        </button>
      </div>

      {trips.length === 0 ? (
        <Card>
          <EmptyState icon="send" title="No trip yet" hint="Start a trip fund — everyone saves toward their own target" />
        </Card>
      ) : (
        trips.map((t) => <TripRow key={t.id} trip={t} uid={uid!} currency={currency} />)
      )}

      {createOpen && <CreateTripSheet uid={uid!} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function TripRow({ trip, uid, currency }: { trip: Trip; uid: string; currency: string }) {
  const info = useLiveQuery(
    async () => {
      const members = await db().trip_members.where("trip_id").equals(trip.id).toArray();
      return {
        count: members.length,
        mine: members.find((m) => m.user_id === uid)?.paid_amount ?? 0,
        done: members.filter((m) => trip.target_amount > 0 && m.paid_amount >= trip.target_amount).length,
      };
    },
    [trip.id, uid, trip.target_amount]
  );

  const pct = trip.target_amount ? Math.min(100, ((info?.mine ?? 0) / trip.target_amount) * 100) : 0;

  return (
    <Link href={`/trip/${trip.id}`}>
      <Card className="card-pad mb-3">
        <div className="flex justify-between items-start mb-1">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold truncate">{trip.name}</p>
            <p className="text-sub text-[13px] mt-0.5">
              {info ? `${info.count} ${info.count === 1 ? "person" : "people"} · ${info.done} done` : "…"}
            </p>
          </div>
          <p className="text-[14px] font-semibold tabular-nums shrink-0 ml-3">
            {formatMoney(info?.mine ?? 0, currency)}
            <span className="text-sub font-medium"> / {trip.target_amount.toLocaleString("en-PK")}</span>
          </p>
        </div>
        <div className="progress-track mt-2">
          <div className="progress-fill" style={{ width: `${pct}%`, background: "var(--color-tint)" }} />
        </div>
      </Card>
    </Link>
  );
}

function CreateTripSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const profileMap = useProfileMap();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [picked, setPicked] = useState<Profile[]>([]);
  const [collector, setCollector] = useState(uid);
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(target.replace(/,/g, "")) || 0;
  const valid = name.trim() && parsed > 0 && picked.length > 0 && !saving;

  const collectorIds = [uid, ...picked.map((p) => p.id)];

  return (
    <Sheet title="New trip" onClose={onClose}>
      <input className="input mb-3" placeholder="Trip name — e.g. Hunza December" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 mb-5">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Target each — e.g. 18,000" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>

      <label className="section-title">People</label>
      {picked.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {picked.map((p) => (
            <button
              key={p.id}
              className="pill bg-card2 text-label"
              onClick={() => {
                setPicked(picked.filter((x) => x.id !== p.id));
                if (collector === p.id) setCollector(uid);
              }}
            >
              {p.display_name.split(" ")[0]} <Icon name="x" size={12} />
            </button>
          ))}
        </div>
      )}
      <UserPicker
        uid={uid}
        excludeIds={new Set(collectorIds)}
        onPick={(p) => setPicked([...picked, p])}
      />

      <label className="section-title">Who collects the money?</label>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {collectorIds.map((id) => {
          const label = id === uid ? "You" : (picked.find((p) => p.id === id)?.display_name ?? profileMap.get(id)?.display_name ?? "…").split(" ")[0];
          return (
            <button
              key={id}
              className={`pill shrink-0 ${collector === id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
              onClick={() => setCollector(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        className="btn"
        disabled={!valid}
        onClick={async () => {
          setSaving(true);
          await createTrip({
            created_by: uid,
            name,
            collector_id: collector,
            target_amount: parsed,
            member_ids: picked.map((p) => p.id),
          });
          onClose();
        }}
      >
        Create trip
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Only the collector sees individual payments — everyone sees progress.</p>
    </Sheet>
  );
}
