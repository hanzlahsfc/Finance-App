"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useObligations, useGoals, useOwedToMe, useIncome, useFriendships, useProfileMap } from "@/lib/hooks";
import { formatMoney, formatDate, weekKey } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Segmented, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { addObligation, payObligation, deleteObligation, addGoal, contributeToGoal, updateGoal, deleteGoal } from "@/lib/actions";
import type { Obligation, SavingsGoal, ObligationDirection, GoalKind } from "@/lib/types";

type Tab = "debts" | "goals";

export default function ObligationsPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";

  const [tab, setTab] = useState<Tab>("debts");
  const obligations = useObligations(uid);
  const goals = useGoals(uid);
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
        <GoalsView
          goals={goals}
          uid={uid!}
          currency={currency}
          savingsPercent={profile?.savings_percent ?? 20}
          onSelect={setSelGoal}
        />
      )}

      {addObligOpen && <AddObligationSheet uid={uid!} onClose={() => setAddObligOpen(false)} />}
      {addGoalOpen && <AddGoalSheet uid={uid!} goals={goals} onClose={() => setAddGoalOpen(false)} />}
      {selOblig && (
        <ObligationDetail o={obligations.find((x) => x.id === selOblig.id) ?? selOblig} currency={currency} onClose={() => setSelOblig(null)} />
      )}
      {selGoal && (
        <GoalDetail g={goals.find((x) => x.id === selGoal.id) ?? selGoal} currency={currency} onClose={() => setSelGoal(null)} />
      )}
    </div>
  );
}

// ---------- shared bits ----------

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
          <div className="text-[13px] text-sub truncate">{o.title || (o.kind === "item" ? "Item" : "Money")}{o.due_date ? ` · due ${formatDate(o.due_date)}` : ""}</div>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-semibold tabular-nums">{formatMoney(rem, currency)}</p>
          <p className="text-[12px] text-sub tabular-nums">of {formatMoney(o.total_amount, currency)}</p>
        </div>
      </div>
      {o.settled_amount > 0 && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%`, background: o.direction === "i_owe" ? "var(--color-orange)" : "var(--color-green)" }} />
        </div>
      )}
    </div>
  );
}

// ---------- debts sheets ----------

function AddObligationSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const friendships = useFriendships(uid);
  const profileMap = useProfileMap();
  const [direction, setDirection] = useState<ObligationDirection>("i_owe");
  const [kind, setKind] = useState<"money" | "item">("money");
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
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
      <input className="input mb-6" type="date" value={due} onChange={(e) => setDue(e.target.value)} />

      <button
        className="btn"
        disabled={!who.trim() || !parsed || saving}
        onClick={async () => {
          setSaving(true);
          await addObligation({ user_id: uid, direction, kind, counterparty: who, title, total_amount: parsed, due_date: due || null });
          onClose();
        }}
      >
        Add obligation
      </button>
    </Sheet>
  );
}

function ObligationDetail({ o, currency, onClose }: { o: Obligation; currency: string; onClose: () => void }) {
  const [payOpen, setPayOpen] = useState(false);
  const rem = Math.max(0, o.total_amount - o.settled_amount);
  return (
    <Sheet title={o.counterparty} onClose={onClose}>
      <div className="text-center py-4">
        <p className="text-[34px] font-bold tabular-nums">{formatMoney(rem, currency)}</p>
        <p className="text-sub text-[14px]">remaining of {formatMoney(o.total_amount, currency)} {o.title && `· ${o.title}`}</p>
        <span className={`pill mt-3 ${o.status === "settled" ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-[rgba(255,159,10,0.15)] text-orange"}`}>
          {o.status === "settled" ? "Settled" : o.direction === "i_owe" ? "You owe" : "They owe you"}
        </span>
        {o.settled_amount > 0 && (
          <div className="progress-track mt-4 mx-8">
            <div className="progress-fill" style={{ width: `${(o.settled_amount / o.total_amount) * 100}%`, background: "var(--color-tint)" }} />
          </div>
        )}
      </div>
      {o.status === "open" && (
        <button className="btn mt-3" onClick={() => setPayOpen(true)}>
          {o.direction === "i_owe" ? "Record a payment" : "Record received"}
        </button>
      )}
      <button className="btn btn-danger mt-2" onClick={async () => { await deleteObligation(o.id); onClose(); }}>
        <Icon name="trash" size={17} /> Delete
      </button>
      {payOpen && <PaySheet o={o} max={rem} currency={currency} onClose={() => setPayOpen(false)} />}
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
      <button className="pill bg-card2 text-sub mx-auto mb-5" onClick={() => setAmount(String(max))}>Full: {formatMoney(max, currency)}</button>
      <button className="btn" disabled={parsed <= 0 || parsed > max} onClick={async () => { await payObligation(o, parsed); onClose(); }}>
        Record {parsed > 0 ? formatMoney(parsed, currency) : ""}
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Also logs a matching transaction automatically</p>
    </Sheet>
  );
}

// ---------- goals ----------

function GoalsView({ goals, uid, currency, savingsPercent, onSelect }: {
  goals: SavingsGoal[]; uid: string; currency: string; savingsPercent: number; onSelect: (g: SavingsGoal) => void;
}) {
  const income = useIncome(uid);
  const wk = weekKey(new Date());
  const weekPay = income.filter((i) => i.week_start === wk).reduce((s, i) => s + i.amount, 0);
  const pool = (weekPay * savingsPercent) / 100;
  const allocated = goals.filter((g) => g.status === "active").reduce((s, g) => s + g.allocation_percent, 0);

  const needs = goals.filter((g) => g.kind === "need");
  const wants = goals.filter((g) => g.kind === "want");

  return (
    <>
      <Card className="card-pad mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[13px] text-sub">This week&apos;s set-aside</span>
          <span className="text-[18px] font-bold tabular-nums text-teal">{formatMoney(pool, currency)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] text-sub">Allocated to goals</span>
          <span className={`text-[14px] font-semibold tabular-nums ${allocated > 100 ? "text-red" : ""}`}>{allocated}%</span>
        </div>
        {allocated > 100 && <p className="text-red text-[12px] mt-1">Over-allocated — lower some goals</p>}
        {pool === 0 && <p className="text-sub2 text-[12px] mt-1">Log this week&apos;s pay to see goal funding</p>}
      </Card>

      {(["need", "want"] as const).map((k) => (
        <div key={k} className="mb-5">
          <SectionTitle>{k === "need" ? "Needs" : "Wants"}</SectionTitle>
          <Card>
            {needs.length + wants.length === 0 && k === "need" ? (
              <EmptyState icon="target" title="No goals yet" hint="Needs: rent, emergency fund. Wants: phone, trip, PS5" />
            ) : null}
            {(k === "need" ? needs : wants).map((g) => {
              const weekly = (pool * g.allocation_percent) / 100;
              const pct = g.target_amount ? Math.min(100, (g.saved_amount / g.target_amount) * 100) : 0;
              return (
                <div key={g.id} className="list-row !flex-col !items-stretch gap-2 cursor-pointer active:bg-card2" onClick={() => onSelect(g)}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: k === "need" ? "rgba(48,209,88,0.15)" : "rgba(191,90,242,0.15)" }}>
                      <Icon name={k === "need" ? "check" : "heart"} size={16} className={k === "need" ? "text-green" : "text-purple"} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-medium truncate">{g.title}</div>
                      <div className="text-[13px] text-sub">{g.status === "done" ? "Funded" : `${g.allocation_percent}% of set-aside${weekly > 0 ? ` ≈ ${formatMoney(weekly, currency)}/wk` : ""}`}</div>
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
            {(k === "need" ? needs : wants).length === 0 && needs.length + wants.length > 0 && (
              <p className="card-pad text-sub2 text-[13px] text-center py-4">Nothing here</p>
            )}
          </Card>
        </div>
      ))}
    </>
  );
}

function AddGoalSheet({ uid, goals, onClose }: { uid: string; goals: SavingsGoal[]; onClose: () => void }) {
  const [kind, setKind] = useState<GoalKind>("need");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [alloc, setAlloc] = useState("20");
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(target.replace(/,/g, ""));
  const allocated = goals.filter((g) => g.status === "active").reduce((s, g) => s + g.allocation_percent, 0);
  const free = Math.max(0, 100 - allocated);

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
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Target amount" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <label className="section-title">Weekly allocation — % of set-aside</label>
      <div className="flex gap-2 mb-2">
        {[10, 20, 30, 50].map((p) => (
          <button key={p} className={`pill ${parseFloat(alloc) === p ? "bg-tint text-white" : "bg-card2 text-sub"}`} onClick={() => setAlloc(String(p))}>{p}%</button>
        ))}
        <input className="input !py-1 text-center tabular-nums" style={{ width: 80 }} inputMode="decimal" value={alloc} onChange={(e) => setAlloc(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      <p className="text-sub2 text-[12px] px-1 mb-6">{free}% of set-aside currently unallocated</p>
      <button
        className="btn"
        disabled={!title.trim() || !parsed || !(parseFloat(alloc) > 0) || saving}
        onClick={async () => {
          setSaving(true);
          await addGoal({ user_id: uid, kind, title, target_amount: parsed, allocation_percent: Math.min(100, parseFloat(alloc) || 0) });
          onClose();
        }}
      >
        Add goal
      </button>
    </Sheet>
  );
}

function GoalDetail({ g, currency, onClose }: { g: SavingsGoal; currency: string; onClose: () => void }) {
  const [fundOpen, setFundOpen] = useState(false);
  const [fund, setFund] = useState("");
  const [alloc, setAlloc] = useState(String(g.allocation_percent));
  const pct = Math.min(100, (g.saved_amount / g.target_amount) * 100);
  const rem = Math.max(0, g.target_amount - g.saved_amount);

  return (
    <Sheet title={g.title} onClose={onClose}>
      <div className="text-center py-4">
        <p className="text-[34px] font-bold tabular-nums">{formatMoney(g.saved_amount, currency)}</p>
        <p className="text-sub text-[14px]">saved of {formatMoney(g.target_amount, currency)} · {formatMoney(rem, currency)} to go</p>
        <div className="progress-track mt-4 mx-8">
          <div className="progress-fill" style={{ width: `${pct}%`, background: g.kind === "need" ? "var(--color-green)" : "var(--color-purple)" }} />
        </div>
        <span className={`pill mt-3 ${g.status === "done" ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-card2 text-sub"}`}>
          {g.status === "done" ? "Funded" : `${g.allocation_percent}% of weekly set-aside`}
        </span>
      </div>

      {!fundOpen ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input className="input" inputMode="decimal" value={alloc} onChange={(e) => setAlloc(e.target.value.replace(/[^\d.]/g, ""))} />
            <button className="btn !w-auto px-5" disabled={parseFloat(alloc) === g.allocation_percent} onClick={async () => { await updateGoal(g, { allocation_percent: Math.min(100, parseFloat(alloc) || 0) }); }}>%</button>
          </div>
          {g.status === "active" && <button className="btn" onClick={() => setFundOpen(true)}>Add funds</button>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sub">Rs</span>
            <input className="input" placeholder={`up to ${formatMoney(rem, currency)}`} inputMode="decimal" autoFocus value={fund} onChange={(e) => setFund(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <button className="btn" disabled={!(parseFloat(fund) > 0)} onClick={async () => { await contributeToGoal(g, Math.min(rem, parseFloat(fund.replace(/,/g, "")) || 0)); setFundOpen(false); }}>
            Add {formatMoney(Math.min(rem, parseFloat(fund.replace(/,/g, "")) || 0), currency)}
          </button>
        </>
      )}
      <button className="btn btn-danger mt-2" onClick={async () => { await deleteGoal(g.id); onClose(); }}>
        <Icon name="trash" size={17} /> Delete goal
      </button>
    </Sheet>
  );
}
