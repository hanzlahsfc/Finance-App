"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/hooks";
import { formatMoney, formatDayLabel, formatTime, toISODate, startOfWeek, endOfWeek, startOfDay } from "@/lib/utils";
import { Card, Segmented, EmptyState, ListRow } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { CATEGORIES, categoryById } from "@/lib/categories";
import { deleteTransaction, updateTransaction } from "@/lib/actions";
import type { Transaction } from "@/lib/types";

type Range = "daily" | "weekly" | "all";

export default function TransactionsPage() {
  const { session, profile } = useApp();
  const currency = profile?.currency ?? "PKR";
  const txns = useTransactions(session?.user.id);
  const [range, setRange] = useState<Range>("weekly");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const now = new Date();
    let out = txns;
    if (range === "daily") {
      const s = startOfDay(now).getTime();
      out = out.filter((t) => new Date(t.occurred_at).getTime() >= s);
    } else if (range === "weekly") {
      const s = startOfWeek(now).getTime();
      const e = endOfWeek(now).getTime();
      out = out.filter((t) => {
        const x = new Date(t.occurred_at).getTime();
        return x >= s && x < e;
      });
    }
    if (catFilter) out = out.filter((t) => t.category === catFilter);
    return out;
  }, [txns, range, catFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const k = toISODate(new Date(t.occurred_at));
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalOut = filtered.filter((t) => t.kind !== "income").reduce((s, t) => s + t.amount, 0);
  const totalIn = filtered.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);

  const usedCats = useMemo(() => {
    const ids = new Set(filtered.map((t) => t.category));
    return CATEGORIES.filter((c) => ids.has(c.id));
  }, [filtered]);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <h1 className="large-title mb-4">Activity</h1>

      <Segmented
        options={[
          { value: "daily", label: "Today" },
          { value: "weekly", label: "This week" },
          { value: "all", label: "All" },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="flex gap-4 my-4 px-1">
        <span className="text-[14px] text-sub">Out <span className="text-label font-semibold tabular-nums">{formatMoney(totalOut, currency)}</span></span>
        <span className="text-[14px] text-sub">In <span className="text-green font-semibold tabular-nums">{formatMoney(totalIn, currency)}</span></span>
      </div>

      {usedCats.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-5 px-5">
          <button
            className={`pill shrink-0 ${catFilter === null ? "bg-tint text-white" : "bg-card2 text-sub"}`}
            onClick={() => setCatFilter(null)}
          >
            All
          </button>
          {usedCats.map((c) => (
            <button
              key={c.id}
              className={`pill shrink-0 ${catFilter === c.id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
              onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}
            >
              <span style={catFilter === c.id ? {} : { color: c.color }}>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="receipt" title="Nothing here" hint="Transactions you add will show up grouped by day" />
      ) : (
        groups.map(([day, items]) => {
          const dayOut = items.filter((t) => t.kind !== "income").reduce((s, t) => s + t.amount, 0);
          return (
            <div key={day} className="mb-5">
              <div className="flex justify-between items-center px-1 mb-2">
                <span className="section-title !mb-0">{formatDayLabel(day)}</span>
                {dayOut > 0 && <span className="text-[12px] text-sub tabular-nums">−{formatMoney(dayOut, currency)}</span>}
              </div>
              <Card>
                {items.map((t) => {
                  const c = categoryById(t.category);
                  const out = t.kind === "expense" || t.kind === "loan_given" || t.kind === "set_aside";
                  return (
                    <ListRow
                      key={t.id}
                      icon={<span style={{ color: c.color }}>{c.icon}</span>}
                      title={t.note || c.label}
                      subtitle={`${c.label} · ${formatTime(t.occurred_at)}${t.place ? ` · ${t.place}` : ""}`}
                      right={
                        <span className={`text-[15px] font-semibold tabular-nums ${out ? "" : "text-green"}`}>
                          {out ? "−" : "+"}{formatMoney(t.amount, currency)}
                        </span>
                      }
                      onClick={() => setSelected(t)}
                    />
                  );
                })}
              </Card>
            </div>
          );
        })
      )}

      {selected && (
        <TxnDetail
          t={txns.find((x) => x.id === selected.id) ?? selected}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TxnDetail({ t, currency, onClose }: { t: Transaction; currency: string; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(t.amount));
  const [note, setNote] = useState(t.note);
  const [place, setPlace] = useState(t.place);
  const [counterparty, setCounterparty] = useState(t.counterparty);
  const [category, setCategory] = useState(t.category);
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(amount.replace(/,/g, ""));
  const pickerCats = t.kind === "income" ? CATEGORIES.filter((c) => ["income", "other"].includes(c.id)) : CATEGORIES.filter((c) => c.id !== "income");

  if (!editing) {
    return (
      <Sheet title="Transaction" onClose={onClose}>
        <div className="text-center py-4">
          <span className="text-[40px]">{categoryById(t.category).icon}</span>
          <p className="text-[34px] font-bold tabular-nums mt-2">{formatMoney(t.amount, currency)}</p>
          <p className="text-sub text-[15px]">{t.note || categoryById(t.category).label}</p>
          <p className="text-sub2 text-[13px] mt-1">
            {formatDayLabel(t.occurred_at)} · {formatTime(t.occurred_at)} · {categoryById(t.category).label}
          </p>
        </div>
        {(t.place || t.counterparty) && (
          <Card className="mt-4">
            {t.place && (
              <ListRow title="Place" right={<span className="text-[15px]">{t.place}</span>} />
            )}
            {t.counterparty && (
              <ListRow
                title={t.kind === "income" || t.kind === "loan_taken" ? "From" : "To"}
                right={<span className="text-[15px]">{t.counterparty}</span>}
              />
            )}
          </Card>
        )}
        <button className="btn mt-4" onClick={() => setEditing(true)}>Edit</button>
        <button
          className="btn btn-danger mt-2"
          onClick={async () => {
            await deleteTransaction(t.id);
            onClose();
          }}
        >
          <Icon name="trash" size={18} /> Delete transaction
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Edit transaction" onClose={onClose}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <input className="input mb-3" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2 mb-4">
        <input className="input" placeholder="Place" value={place} onChange={(e) => setPlace(e.target.value)} />
        <input className="input" placeholder={t.kind === "income" || t.kind === "loan_taken" ? "From" : "To"} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
      </div>
      <span className="section-title">Category</span>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {pickerCats.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
            <span className="chip-icon" style={{ color: c.color }}>{c.icon}</span>
            {c.label.split(" ")[0]}
          </button>
        ))}
      </div>
      <button
        className="btn"
        disabled={!parsed || saving}
        onClick={async () => {
          setSaving(true);
          await updateTransaction(t, { amount: parsed, note: note.trim(), place: place.trim(), counterparty: counterparty.trim(), category });
          onClose();
        }}
      >
        Save changes
      </button>
    </Sheet>
  );
}
