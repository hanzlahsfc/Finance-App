"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useObligations, useGoals, useOwedToMe, useFriendships, useProfileMap, useSavingsPool } from "@/lib/hooks";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Segmented, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import {
  addObligation, payObligation, deleteObligation, updateObligation, reserveForObligation,
  addGoal, contributeToGoal, updateGoal, deleteGoal,
} from "@/lib/actions";
import type { Obligation, SavingsGoal, ObligationDirection, GoalKind, Priority } from "@/lib/types";

type Tab = "debts" | "goals";
const PRIO_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const PRIO_STYLE: Record<Priority, string> = {
  high: "bg-[rgba(255,69,58,0.15)] text-red",
  normal: "bg-card2 text-sub",
  low: "bg-card2 text-sub2",
};

export default function ObligationsPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";

  const [tab, setTab] = useState<Tab>("debts");
  const obligations = useObligations(uid);
  const goals = useGoals(uid);
  const pool = useSavingsPool(uid, profile?.savings_percent ?? 20);
  const { owed: groupOwed, iOwe: groupIOwe } = useOwedToMe(uid);

  const [addObligOpen, setAddObligOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [selOblig, setSelOblig] = useState<Obligation | null>(null);
  const [selGoal, setSelGoal] = useState<SavingsGoal | null>(null);

  const open = obligations.filter((o) => o.status === "open");
  const settled = obligations.filter((o) => o.status === "settled");
  const iOwePersonal = open.filter((o) => o.direction === "i_owe").reduce((s, o) => s + o.total_amount - o.settled_amount, 0);
  const owedPersonal = open.filter((o) => o.direction === "owed_to_me").reduce((s, o) => s + o.total_amount - o.settled_amount, 0);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center justify-between mb-5">
        <h1 className="large-title">Obligations</h1>
        <button className="pill bg-tint text-white" onClick={() => (tab === "debts" ? setAddObligOpen(true) : setAddGoalOpen(true))}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      <Segmented
        options={[
          { value: "debts", label: "Debts" },
          { value: "goals", label: "Wants & Needs" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="h-4" />

      <PoolCard pool={pool} currency={currency} />
      <div className="h-5" />

      {tab === "debts" ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="card-pad">
              <p className="text-[12px] text-sub mb-1">You owe</p>
              <p className="text-[20px] font-bold tabular-nums text-orange">{formatMoney(iOwePersonal + groupIOwe, currency)}</p>
              {groupIOwe > 0 && <p className="text-sub2 text-[11px] mt-0.5">incl. {formatMoney(groupIOwe, currency)} from splits</p>}
            </Card>
            <Card className="card-pad">
              <p className="text-[12px] text-sub mb-1">Owed to you</p>
              <p className="text-[20px] font-bold tabular-nums text-green">{formatMoney(owedPersonal + groupOwed, currency)}</p>
              {groupOwed > 0 && <p className="text-sub2 text-[11px] mt-0.5">incl. {formatMoney(groupOwed, currency)} from splits</p>}
            </Card>
          </div>

          {open.length === 0 && settled.length === 0 ? (
            <Card>
              <EmptyState icon="coins" title="No obligations" hint="Track money or things you owe — and what's owed to you" />
            </Card>
          ) : (
            <>
              {(["i_owe", "owed_to_me"] as const).map((dir) => {
                const rows = open.filter((o) => o.direction === dir);
                if (!rows.length) return null;
                return (
                  <div key={dir} className="mb-5">
                    <SectionTitle>{dir === "i_owe" ? "You owe" : "Owed to you"}</SectionTitle>
                    <Card>
                      {rows.map((o) => <ObligationRow key={o.id} o={o} currency={currency} onClick={() => setSelOblig(o)} />)}
                    </Card>
                  </div>
                );
              })}
              {settled.length > 0 && (
                <>
                  <SectionTitle>Settled</SectionTitle>
                  <Card>
                    {settled.map((o) => (
                      <ListRow
                        key={o.id}
                        icon={<Icon name="check" size={15} className="text-green" />}
                        title={<span className="text-sub line-through">{o.counterparty}</span>}
                        subtitle={o.title || (o.kind === "item" ? "Item" : undefined)}
                        right={<span className="text-sub text-[14px] tabular-nums">{formatMoney(o.total_amount, currency)}</span>}
                        onClick={() => setSelOblig(o)}
                      />
                    ))}
                  </Card>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <GoalsView goals={goals} currency={currency} onSelect={setSelGoal} />
      )}

      {addObligOpen && <AddObligationSheet uid={uid!} onClose={() => setAddObligOpen(false)} />}
      {addGoalOpen && <AddGoalSheet uid={uid!} onClose={() => setAddGoalOpen(false)} />}
      {selOblig && (
        <ObligationDetail
          o={obligations.find((x) => x.id === selOblig.id) ?? selOblig}
          pool={pool}
          currency={currency}
          onClose={() => setSelOblig(null)}
        />
      )}
      {selGoal && (
        <GoalDetail
          g={goals.find((x) => x.id === selGoal.id) ?? selGoal}
          pool={pool}
          currency={currency}
          onClose={() => setSelGoal(null)}
        />
      )}
    </div>
  );
}

// ---------- savings pool ----------

function PoolCard({ pool, currency }: { pool: ReturnType<typeof useSavingsPool>; currency: string }) {
  return (
    <Card className="card-pad">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[13px] font-semibold text-sub uppercase tracking-wide">Savings pool</span>
        <span className="text-[20px] font-bold tabular-nums text-teal">{formatMoney(pool.free, currency)}</span>
      </div>
      <div className="flex justify-between items-baseline text-[13px] text-sub">
        <span>Set aside so far</span>
        <span className="tabular-nums">{formatMoney(pool.setAsideTotal, currency)}</span>
      </div>
      <div className="flex justify-between items-baseline text-[13px] text-sub">
        <span>In goals · earmarked for debts</span>
        <span className="tabular-nums">{formatMoney(pool.inGoals, currency)} · {formatMoney(pool.inDebts, currency)}</span>
      </div>
      {pool.weeklyPlan > 0 && (
        <div className="flex justify-between items-baseline text-[13px] text-sub mt-1 pt-1.5 border-t border-card2">
          <span>Planned each week</span>
          <span className="tabular-nums text-label font-medium">{formatMoney(pool.weeklyPlan, currency)}</span>
        </div>
      )}
      {pool.setAsideTotal === 0 && <p className="text-sub2 text-[12px] mt-1">Log pay to build your set-aside pool</p>}
    </Card>
  );
}

// ---------- debts ----------

function ObligationRow({ o, currency, onClick }: { o: Obligation; currency: string; onClick: () => void }) {
  const rem = Math.max(0, o.total_amount - o.settled_amount);
  const pct = o.total_amount ? (o.settled_amount / o.total_amount) * 100 : 0;
  return (
    <div className="list-row !flex-col !items-stretch gap-2 cursor-pointer active:bg-card2" onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--color-card2)" }}>
          <Icon name={o.direction === "i_owe" ? "chevronRight" : "chevronLeft"} size={17} className={o.direction === "i_owe" ? "text-orange" : "text-green"} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium truncate">{o.counterparty}</div>
          <div className="text-[13px] text-sub truncate">
            {o.title || (o.kind === "item" ? "Item" : "Money")}
            {o.due_date ? ` · due ${formatDate(o.due_date)}` : ""}
            {o.weekly_amount > 0 ? ` · ${formatMoney(o.weekly_amount, currency)}/wk` : ""}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-semibold tabular-nums">{formatMoney(rem, currency)}</p>
          <p className="text-[12px] text-sub tabular-nums">of {formatMoney(o.total_amount, currency)}</p>
        </div>
      </div>
      {(o.settled_amount > 0 || o.reserved_amount > 0) && (
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              position: "absolute",
              width: `${Math.min(100, pct + (o.reserved_amount / o.total_amount) * 100)}%`,
              background: o.direction === "i_owe" ? "var(--color-orange)" : "var(--color-green)",
              opacity: 0.35,
            }}
          />
          <div className="progress-fill" style={{ position: "absolute", width: `${pct}%`, background: o.direction === "i_owe" ? "var(--color-orange)" : "var(--color-green)" }} />
        </div>
      )}
      {o.reserved_amount > 0 && (
        <p className="text-[12px] text-teal px-0.5 -mt-1">{formatMoney(o.reserved_amount, currency)} set aside</p>
      )}
    </div>
  );
}

function AddObligationSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const friendships = useFriendships(uid);
  const profileMap = useProfileMap();
  const [direction, setDirection] = useState<ObligationDirection>("i_owe");
  const [kind, setKind] = useState<"money" | "item">("money");
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [weekly, setWeekly] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(amount.replace(/,/g, ""));

  const friendIds = friendships.filter((f) => f.status === "accepted").map((f) => (f.user_id === uid ? f.friend_id : f.user_id));

  return (
    <Sheet title="New obligation" onClose={onClose}>
      <Segmented
        options={[
          { value: "i_owe", label: "I owe them" },
          { value: "owed_to_me", label: "They owe me" },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <div className="h-4" />
      <Segmented
        options={[
          { value: "money", label: "Money" },
          { value: "item", label: "Item / other" },
        ]}
        value={kind}
        onChange={setKind}
      />

      <label className="section-title mt-5">Who</label>
      <input className="input mb-2" placeholder="Name — e.g. Ahmed" value={who} onChange={(e) => setWho(e.target.value)} />
      {friendIds.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {friendIds.map((fid) => {
            const p = profileMap.get(fid);
            const on = who === (p?.display_name ?? "");
            return (
              <button key={fid} className={`pill shrink-0 ${on ? "bg-tint text-white" : "bg-card2 text-sub"}`} onClick={() => setWho(p?.display_name ?? "")}>
                {(p?.display_name ?? "…").split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      <label className="section-title">What for</label>
      <input className="input mb-3" placeholder={kind === "item" ? "e.g. Phone charger, PS5 controller" : "e.g. Dinner last week, rent share"} value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder={kind === "item" ? "Value" : "Amount"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Weekly plan — optional (e.g. 3,000/wk)" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <input className="input mb-6" type="date" value={due} onChange={(e) => setDue(e.target.value)} />

      <button
        className="btn"
        disabled={!who.trim() || !parsed || saving}
        onClick={async () => {
          setSaving(true);
          await addObligation({
            user_id: uid, direction, kind, counterparty: who, title,
            total_amount: parsed,
            weekly_amount: parseFloat(weekly.replace(/,/g, "")) || 0,
            due_date: due || null,
          });
          onClose();
        }}
      >
        Add obligation
      </button>
    </Sheet>
  );
}

function ObligationDetail({ o, pool, currency, onClose }: { o: Obligation; pool: ReturnType<typeof useSavingsPool>; currency: string; onClose: () => void }) {
  const [payOpen, setPayOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [weekly, setWeekly] = useState(String(o.weekly_amount || ""));
  const rem = Math.max(0, o.total_amount - o.settled_amount);
  return (
    <Sheet title={o.counterparty} onClose={onClose}>
      <div className="text-center py-4">
        <p className="text-[34px] font-bold tabular-nums">{formatMoney(rem, currency)}</p>
        <p className="text-sub text-[14px]">remaining of {formatMoney(o.total_amount, currency)} {o.title && `· ${o.title}`}</p>
        <span className={`pill mt-3 ${o.status === "settled" ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-[rgba(255,159,10,0.15)] text-orange"}`}>
          {o.status === "settled" ? "Settled" : o.direction === "i_owe" ? "You owe" : "They owe you"}
        </span>
        {o.reserved_amount > 0 && (
          <p className="text-teal text-[13px] mt-2">{formatMoney(o.reserved_amount, currency)} set aside from your pool</p>
        )}
        {o.settled_amount > 0 && (
          <div className="progress-track mt-4 mx-8">
            <div className="progress-fill" style={{ width: `${(o.settled_amount / o.total_amount) * 100}%`, background: "var(--color-tint)" }} />
          </div>
        )}
      </div>

      {o.status === "open" && (
        <>
          <label className="section-title">Weekly plan</label>
          <div className="flex items-center gap-2 mb-4">
            <input className="input" inputMode="decimal" placeholder="e.g. 3,000" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/[^\d.,]/g, ""))} />
            <button
              className="btn !w-auto px-5"
              disabled={String(o.weekly_amount || "") === weekly}
              onClick={() => void updateObligation(o, { weekly_amount: parseFloat(weekly.replace(/,/g, "")) || 0 })}
            >
              /wk
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setPayOpen(true)}>
              {o.direction === "i_owe" ? "Record a payment" : "Record received"}
            </button>
            <button className="btn !bg-card2 !text-label" onClick={() => setFundOpen(true)}>
              Set aside
            </button>
          </div>
        </>
      )}
      <button className="btn btn-danger mt-2" onClick={async () => { await deleteObligation(o.id); onClose(); }}>
        <Icon name="trash" size={17} /> Delete
      </button>
      {payOpen && <PaySheet o={o} max={rem} currency={currency} onClose={() => setPayOpen(false)} />}
      {fundOpen && <ReserveSheet o={o} pool={pool} currency={currency} onClose={() => setFundOpen(false)} />}
    </Sheet>
  );
}

function PaySheet({ o, max, currency, onClose }: { o: Obligation; max: number; currency: string; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title={o.direction === "i_owe" ? "Payment" : "Received"} onClose={onClose}>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3" placeholder="0" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <div className="flex gap-2 justify-center mb-5">
        {o.reserved_amount > 0 && (
          <button className="pill bg-[rgba(94,229,200,0.15)] text-teal" onClick={() => setAmount(String(Math.min(max, o.reserved_amount)))}>
            Reserved: {formatMoney(Math.min(max, o.reserved_amount), currency)}
          </button>
        )}
        <button className="pill bg-card2 text-sub" onClick={() => setAmount(String(max))}>Full: {formatMoney(max, currency)}</button>
      </div>
      <button className="btn" disabled={parsed <= 0 || parsed > max} onClick={async () => { await payObligation(o, parsed); onClose(); }}>
        Record {parsed > 0 ? formatMoney(parsed, currency) : ""}
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Also logs a matching transaction automatically</p>
    </Sheet>
  );
}

function ReserveSheet({ o, pool, currency, onClose }: { o: Obligation; pool: ReturnType<typeof useSavingsPool>; currency: string; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  const rem = o.total_amount - o.settled_amount - o.reserved_amount;
  const max = Math.min(rem, pool.free);
  return (
    <Sheet title="Set aside" onClose={onClose}>
      <p className="text-sub text-[14px] text-center mt-1">
        Free pool: {formatMoney(pool.free, currency)} · still needed: {formatMoney(rem, currency)}
      </p>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3" placeholder="0" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <button className="pill bg-card2 text-sub mx-auto mb-5" onClick={() => setAmount(String(max))}>All I can: {formatMoney(max, currency)}</button>
      <button className="btn" disabled={parsed <= 0 || parsed > max} onClick={async () => { await reserveForObligation(o, parsed); onClose(); }}>
        Set aside {parsed > 0 ? formatMoney(parsed, currency) : ""}
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Earmarks pool money — record a payment when you hand it over</p>
    </Sheet>
  );
}

// ---------- goals ----------

function GoalsView({ goals, currency, onSelect }: {
  goals: SavingsGoal[]; currency: string; onSelect: (g: SavingsGoal) => void;
}) {
  const sorted = [...goals].sort((a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const needs = sorted.filter((g) => g.kind === "need");
  const wants = sorted.filter((g) => g.kind === "want");

  return (
    <>
      {(["need", "want"] as const).map((k) => (
        <div key={k} className="mb-5">
          <SectionTitle>{k === "need" ? "Needs" : "Wants"}</SectionTitle>
          <Card>
            {goals.length === 0 && k === "need" && (
              <EmptyState icon="target" title="No goals yet" hint="Needs: rent, emergency fund. Wants: phone, trip, PS5" />
            )}
            {(k === "need" ? needs : wants).map((g) => {
              const pct = g.target_amount ? Math.min(100, (g.saved_amount / g.target_amount) * 100) : 0;
              return (
                <div key={g.id} className="list-row !flex-col !items-stretch gap-2 cursor-pointer active:bg-card2" onClick={() => onSelect(g)}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: k === "need" ? "rgba(48,209,88,0.15)" : "rgba(191,90,242,0.15)" }}>
                      <Icon name={k === "need" ? "check" : "heart"} size={16} className={k === "need" ? "text-green" : "text-purple"} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-medium truncate">{g.title}</span>
                        {g.priority !== "normal" && <span className={`pill !py-0.5 !px-2 !text-[10px] ${PRIO_STYLE[g.priority]}`}>{g.priority === "high" ? "Top" : "Low"}</span>}
                      </div>
                      <div className="text-[13px] text-sub">
                        {g.status === "done" ? "Funded" : g.weekly_amount > 0 ? `${formatMoney(g.weekly_amount, currency)}/wk plan` : "No weekly plan"}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-semibold tabular-nums">{formatMoney(g.saved_amount, currency)}</p>
                      <p className="text-[12px] text-sub tabular-nums">of {formatMoney(g.target_amount, currency)}</p>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: k === "need" ? "var(--color-green)" : "var(--color-purple)" }} />
                  </div>
                </div>
              );
            })}
            {(k === "need" ? needs : wants).length === 0 && goals.length > 0 && (
              <p className="card-pad text-sub2 text-[13px] text-center py-4">Nothing here</p>
            )}
          </Card>
        </div>
      ))}
    </>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex gap-2">
      {(["high", "normal", "low"] as const).map((p) => (
        <button key={p} className={`pill ${value === p ? "bg-tint text-white" : "bg-card2 text-sub"}`} onClick={() => onChange(p)}>
          {p === "high" ? "Top priority" : p === "normal" ? "Normal" : "Low"}
        </button>
      ))}
    </div>
  );
}

function AddGoalSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [kind, setKind] = useState<GoalKind>("need");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(target.replace(/,/g, ""));

  return (
    <Sheet title="New goal" onClose={onClose}>
      <Segmented
        options={[
          { value: "need", label: "Need" },
          { value: "want", label: "Want" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <label className="section-title mt-5">Goal</label>
      <input className="input mb-3" placeholder={kind === "need" ? "e.g. Rent deposit, emergency fund" : "e.g. New phone, trip to Hunza"} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Target amount" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Weekly amount — e.g. 3,000" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <label className="section-title">Priority</label>
      <PriorityPicker value={priority} onChange={setPriority} />
      <div className="h-6" />
      <button
        className="btn"
        disabled={!title.trim() || !parsed || saving}
        onClick={async () => {
          setSaving(true);
          await addGoal({
            user_id: uid, kind, title, target_amount: parsed,
            weekly_amount: parseFloat(weekly.replace(/,/g, "")) || 0,
            priority,
          });
          onClose();
        }}
      >
        Add goal
      </button>
    </Sheet>
  );
}

function GoalDetail({ g, pool, currency, onClose }: { g: SavingsGoal; pool: ReturnType<typeof useSavingsPool>; currency: string; onClose: () => void }) {
  const [fundOpen, setFundOpen] = useState(false);
  const [fund, setFund] = useState("");
  const [weekly, setWeekly] = useState(String(g.weekly_amount || ""));
  const pct = Math.min(100, (g.saved_amount / g.target_amount) * 100);
  const rem = Math.max(0, g.target_amount - g.saved_amount);
  const fundParsed = Math.min(rem, parseFloat(fund.replace(/,/g, "")) || 0);

  return (
    <Sheet title={g.title} onClose={onClose}>
      <div className="text-center py-4">
        <p className="text-[34px] font-bold tabular-nums">{formatMoney(g.saved_amount, currency)}</p>
        <p className="text-sub text-[14px]">saved of {formatMoney(g.target_amount, currency)} · {formatMoney(rem, currency)} to go</p>
        <div className="progress-track mt-4 mx-8">
          <div className="progress-fill" style={{ width: `${pct}%`, background: g.kind === "need" ? "var(--color-green)" : "var(--color-purple)" }} />
        </div>
        <span className={`pill mt-3 ${g.status === "done" ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-card2 text-sub"}`}>
          {g.status === "done" ? "Funded" : g.weekly_amount > 0 ? `${formatMoney(g.weekly_amount, currency)}/wk plan` : "No weekly plan"}
        </span>
      </div>

      <label className="section-title">Priority</label>
      <PriorityPicker value={g.priority} onChange={(p) => void updateGoal(g, { priority: p })} />
      <div className="h-4" />
      <label className="section-title">Weekly amount</label>
      <div className="flex items-center gap-2 mb-4">
        <input className="input" inputMode="decimal" placeholder="e.g. 3,000" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/[^\d.,]/g, ""))} />
        <button
          className="btn !w-auto px-5"
          disabled={String(g.weekly_amount || "") === weekly}
          onClick={() => void updateGoal(g, { weekly_amount: parseFloat(weekly.replace(/,/g, "")) || 0 })}
        >
          /wk
        </button>
      </div>

      {g.status === "active" && !fundOpen && <button className="btn" onClick={() => setFundOpen(true)}>Move from pool</button>}
      {fundOpen && (
        <>
          <p className="text-sub text-[13px] text-center mb-2">Free pool: {formatMoney(pool.free, currency)}</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sub">Rs</span>
            <input className="input" placeholder={`up to ${formatMoney(Math.min(rem, pool.free), currency)}`} inputMode="decimal" autoFocus value={fund} onChange={(e) => setFund(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <button className="btn" disabled={!(fundParsed > 0) || fundParsed > pool.free} onClick={async () => { await contributeToGoal(g, fundParsed); setFundOpen(false); }}>
            Move {formatMoney(fundParsed, currency)}
          </button>
        </>
      )}
      <button className="btn btn-danger mt-2" onClick={async () => { await deleteGoal(g.id); onClose(); }}>
        <Icon name="trash" size={17} /> Delete goal
      </button>
    </Sheet>
  );
}
