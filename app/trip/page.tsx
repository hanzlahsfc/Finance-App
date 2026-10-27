"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useTrips, useProfileMap } from "@/lib/hooks";
import { createTrip } from "@/lib/actions";
import { Card, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { UserPicker } from "@/components/UserPicker";
import type { Profile } from "@/lib/types";

export default function TripPage() {
  const { session } = useApp();
  const uid = session?.user.id;
  const trips = useTrips(uid);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  // There's only ever one trip — go straight to it.
  useEffect(() => {
    if (trips && trips.length > 0) router.replace(`/trip/${trips[0].id}`);
  }, [trips, router]);

  if (!session || trips === undefined || trips.length > 0) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center justify-between mb-6">
        <h1 className="large-title">Trip</h1>
      </div>
      <Card>
        <EmptyState icon="send" title="No trip yet" hint="Start a trip fund — everyone saves toward their own target" />
      </Card>
      <button className="btn mt-4" onClick={() => setCreateOpen(true)}>
        <Icon name="plus" size={17} /> Create the trip
      </button>
      {createOpen && <CreateTripSheet uid={uid!} onClose={() => setCreateOpen(false)} />}
    </div>
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
