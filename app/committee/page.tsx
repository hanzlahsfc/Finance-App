"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useCommittees, useProfileMap } from "@/lib/hooks";
import { createCommittee } from "@/lib/actions";
import { formatMoney, toISODate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { UserPicker } from "@/components/UserPicker";
import type { Profile } from "@/lib/types";

export default function CommitteePage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const committees = useCommittees(uid);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-tint p-1 -ml-1" aria-label="Back">
          <Icon name="chevronLeft" size={26} />
        </button>
        <h1 className="large-title flex-1">Committee</h1>
        <button className="pill bg-tint text-white" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      {committees.length === 0 ? (
        <Card>
          <EmptyState icon="coins" title="No committee yet" hint="Monthly rotating pot — everyone pays, one person collects each month" />
        </Card>
      ) : (
        <Card className="mb-6">
          {committees.map((c) => (
            <Link href={`/committee/${c.id}`} key={c.id}>
              <ListRow
                icon="coins"
                iconBg="rgba(0,200,83,0.15)"
                title={c.name}
                subtitle={`${formatMoney(c.amount, currency)} / month each`}
                right={<Icon name="chevronRight" size={16} className="text-sub2" />}
              />
            </Link>
          ))}
        </Card>
      )}

      {createOpen && <CreateCommitteeSheet uid={uid!} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateCommitteeSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const profileMap = useProfileMap();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startMonth, setStartMonth] = useState(toISODate(new Date()).slice(0, 7));
  const [picked, setPicked] = useState<Profile[]>([]);
  const [collector, setCollector] = useState(uid);
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  const valid = name.trim() && parsed > 0 && picked.length > 0 && startMonth && !saving;
  const collectorIds = [uid, ...picked.map((p) => p.id)];

  return (
    <Sheet title="New committee" onClose={onClose}>
      <input className="input mb-3" placeholder="Name — e.g. Beesi 2026" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Monthly amount each — e.g. 5,000" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <label className="section-title">First month</label>
      <input className="input mb-5" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />

      <label className="section-title">Payout order — add people in the order they collect the pot</label>
      {picked.length > 0 && (
        <div className="card mb-3">
          {picked.map((p, i) => (
            <ListRow
              key={p.id}
              icon={<span className="text-[15px] font-bold text-sub w-5 text-center">{i + 1}</span>}
              title={p.display_name}
              subtitle={`@${p.username} · gets pot in month ${i + 1}`}
              right={
                <button
                  aria-label="Remove"
                  className="text-sub2 p-1"
                  onClick={() => {
                    setPicked(picked.filter((x) => x.id !== p.id));
                    if (collector === p.id) setCollector(uid);
                  }}
                >
                  <Icon name="x" size={15} />
                </button>
              }
            />
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
          await createCommittee({
            created_by: uid,
            name,
            amount: parsed,
            collector_id: collector,
            start_month: `${startMonth}-01`,
            member_ids: picked.map((p) => p.id),
          });
          onClose();
        }}
      >
        Create committee
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">
        {parsed > 0 && picked.length > 0
          ? `${picked.length + 1} members · pot is ${formatMoney(parsed * (picked.length + 1))} each month`
          : "Order people in the order they'll take the pot"}
      </p>
    </Sheet>
  );
}
