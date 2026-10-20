"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useTransactions, useIncome } from "@/lib/hooks";
import { formatMoney, startOfWeek, endOfWeek, weekKey, weekRangeLabel } from "@/lib/utils";
import { Card, SectionTitle, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { categoryById } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

export default function ReportsPage() {
  const router = useRouter();
  const { session, profile } = useApp();
  const currency = profile?.currency ?? "PKR";
  const txns = useTransactions(session?.user.id);
  const income = useIncome(session?.user.id);
  const [offset, setOffset] = useState(0); // weeks back

  const range = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() - offset * 7);
    const s = startOfWeek(ref);
    const e = endOfWeek(ref);
    return { s, e, key: weekKey(ref) };
  }, [offset]);

  const weekTxns = useMemo(
    () =>
      txns.filter((t) => {
        const x = new Date(t.occurred_at).getTime();
        return x >= range.s.getTime() && x < range.e.getTime();
      }),
    [txns, range]
  );

  const weekIncome = income.filter((i) => i.week_start === range.key);
  const totalIn = weekTxns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0)
    + weekIncome.reduce((s, i) => s + i.amount, 0);
  const spent = weekTxns.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const lent = weekTxns.filter((t) => t.kind === "loan_given").reduce((s, t) => s + t.amount, 0);
  const borrowed = weekTxns.filter((t) => t.kind === "loan_taken").reduce((s, t) => s + t.amount, 0);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of weekTxns.filter((x) => x.kind !== "income")) {
      m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [weekTxns]);
  const catMax = byCat[0]?.[1] ?? 1;

  const byCounterparty = useMemo(() => groupSum(weekTxns, (t) => t.counterparty), [weekTxns]);
  const byPlace = useMemo(() => groupSum(weekTxns, (t) => t.place), [weekTxns]);

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-tint p-1 -ml-1" aria-label="Back">
          <Icon name="chevronLeft" size={26} />
        </button>
        <h1 className="large-title">Reports</h1>
      </div>

      {/* week picker */}
      <div className="card card-pad flex items-center justify-between mb-6">
        <button onClick={() => setOffset(offset + 1)} className="text-tint p-1"><Icon name="chevronLeft" size={22} /></button>
        <div className="text-center">
          <p className="text-[16px] font-semibold">{offset === 0 ? "This week" : offset === 1 ? "Last week" : `${offset} weeks ago`}</p>
          <p className="text-sub text-[13px]">{weekRangeLabel(range.key)}</p>
        </div>
        <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} className="text-tint p-1 disabled:opacity-30">
          <Icon name="chevronRight" size={22} />
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="card-pad">
          <p className="text-[12px] text-sub mb-1">Money in</p>
          <p className="text-[20px] font-bold tabular-nums text-green">{formatMoney(totalIn, currency)}</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[12px] text-sub mb-1">Money out</p>
          <p className="text-[20px] font-bold tabular-nums text-orange">{formatMoney(spent + lent, currency)}</p>
        </Card>
      </div>

      {(lent > 0 || borrowed > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {lent > 0 && (
            <Card className="card-pad">
              <p className="text-[12px] text-sub mb-1">Lent out</p>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: "#64d2ff" }}>{formatMoney(lent, currency)}</p>
            </Card>
          )}
          {borrowed > 0 && (
            <Card className="card-pad">
              <p className="text-[12px] text-sub mb-1">Borrowed</p>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: "#ac8e68" }}>{formatMoney(borrowed, currency)}</p>
            </Card>
          )}
        </div>
      )}

      {/* categories */}
      <SectionTitle>Spending by category</SectionTitle>
      <Card className="card-pad mb-6">
        {byCat.length === 0 ? (
          <p className="text-sub text-[15px] text-center py-4">No spending recorded this week</p>
        ) : (
          <div className="flex flex-col gap-4">
            {byCat.map(([cat, amt]) => {
              const c = categoryById(cat);
              return (
                <div key={cat}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[15px] font-medium flex items-center gap-2">
                      <span style={{ color: c.color }}>{c.icon}</span> {c.label}
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums">{formatMoney(amt, currency)}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(amt / catMax) * 100}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* where money went — people & places, for records/tax */}
      {byCounterparty.length > 0 && (
        <>
          <SectionTitle>Paid to / received from</SectionTitle>
          <Card className="mb-6">
            {byCounterparty.map(([name, amt]) => (
              <div key={name} className="list-row">
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-medium truncate">{name}</div>
                </div>
                <span className="text-[15px] font-semibold tabular-nums">{formatMoney(amt, currency)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {byPlace.length > 0 && (
        <>
          <SectionTitle>By place</SectionTitle>
          <Card className="mb-6">
            {byPlace.map(([name, amt]) => (
              <div key={name} className="list-row">
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-medium truncate">{name}</div>
                </div>
                <span className="text-[15px] font-semibold tabular-nums">{formatMoney(amt, currency)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {weekTxns.length === 0 && (
        <EmptyState icon="chart" title="No data this week" hint="Go back a week or add some transactions" />
      )}
      <div className="h-4" />
    </div>
  );
}

function groupSum(txns: Transaction[], key: (t: Transaction) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const t of txns) {
    const k = key(t).trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + t.amount);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
