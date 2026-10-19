"use client";

import Link from "next/link";
import { useApp, useSyncState } from "@/lib/store";
import { useTransactions, useWeekTransactions, useIncome, useBills, useBillPayments, billPaidThisPeriod, useGroups, useOwedToMe, todaySpend } from "@/lib/hooks";
import { formatMoney, weekKey, formatDayLabel } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Avatar, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { categoryById } from "@/lib/categories";

export default function Home() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const sync = useSyncState();

  const txns = useTransactions(uid);
  const weekTxns = useWeekTransactions(uid);
  const income = useIncome(uid);
  const bills = useBills(uid);
  const payments = useBillPayments(uid);
  const groups = useGroups(uid);
  const { owed } = useOwedToMe(uid);

  const thisWeekKey = weekKey(new Date());
  const weekIncome = income.filter((i) => i.week_start === thisWeekKey);
  const pay =
    weekIncome.reduce((s, i) => s + i.amount, 0) +
    weekTxns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const setAside = (pay * (profile?.savings_percent ?? 20)) / 100;
  const spent = weekTxns.filter((t) => t.kind !== "income").reduce((s, t) => s + t.amount, 0);
  const left = pay - setAside - spent;
  const billsDue = bills.filter((b) => !billPaidThisPeriod(b, payments));

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sub text-[14px]">{formatDayLabel(new Date().toISOString())}</p>
          <h1 className="large-title">Hi, {profile?.display_name?.split(" ")[0] ?? "…"}</h1>
        </div>
        <Link href="/settings">
          <Avatar name={profile?.display_name ?? "?"} id={uid ?? "x"} size={42} />
        </Link>
      </div>

      {sync.status === "offline" && (
        <div className="pill bg-card2 text-sub mb-4">
          <Icon name="wifiOff" size={13} /> Offline{sync.pending > 0 && ` · ${sync.pending} to sync`}
        </div>
      )}

      {/* this week hero card */}
      <Card className="card-pad mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="section-title !mb-0">This week</span>
          <Link href="/money" className="text-tint text-[14px] font-medium flex items-center gap-0.5">
            Pay & bills <Icon name="chevronRight" size={14} />
          </Link>
        </div>
        <div className="amount-hero mt-2" style={{ color: left >= 0 ? "var(--color-label)" : "var(--color-red)" }}>
          {formatMoney(Math.max(0, left), currency)}
        </div>
        <p className="text-sub text-[13px] mb-4">left to spend this week</p>

        <div className="progress-track mb-4">
          <div
            className="progress-fill"
            style={{
              width: `${pay > 0 ? Math.min(100, ((spent + setAside) / pay) * 100) : 0}%`,
              background: "linear-gradient(90deg, var(--color-tint), var(--color-purple))",
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pay" value={pay} currency={currency} color="var(--color-green)" />
          <Stat label="Set aside" value={setAside} currency={currency} color="var(--color-teal)" />
          <Stat label="Spent" value={spent} currency={currency} color="var(--color-orange)" />
        </div>
      </Card>

      {/* bills due */}
      {billsDue.length > 0 && (
        <>
          <SectionTitle>Bills due</SectionTitle>
          <Card className="mb-6">
            {billsDue.slice(0, 3).map((b) => (
              <ListRow
                key={b.id}
                icon={categoryById(b.category).icon}
                title={b.name}
                subtitle={`${b.frequency} bill`}
                right={<span className="text-[15px] font-semibold tabular-nums">{formatMoney(b.amount, currency)}</span>}
              />
            ))}
            {billsDue.length > 3 && (
              <Link href="/money" className="list-row justify-center text-tint text-[15px] font-medium">
                View all {billsDue.length}
              </Link>
            )}
          </Card>
        </>
      )}

      {/* quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/transactions">
          <Card className="card-pad">
            <Icon name="receipt" size={20} className="text-orange mb-2" />
            <p className="text-[22px] font-bold tabular-nums">{formatMoney(todaySpend(txns), currency)}</p>
            <p className="text-sub text-[13px]">spent today</p>
          </Card>
        </Link>
        <Link href="/groups">
          <Card className="card-pad">
            <Icon name="people" size={20} className="text-tint mb-2" />
            <p className="text-[22px] font-bold tabular-nums">{owed > 0 ? formatMoney(owed, currency) : groups.length}</p>
            <p className="text-sub text-[13px]">{owed > 0 ? "friends owe you" : groups.length === 1 ? "group" : "groups"}</p>
          </Card>
        </Link>
      </div>

      {/* recent */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">Recent</span>
        <Link href="/transactions" className="text-tint text-[14px] font-medium">See all</Link>
      </div>
      <Card>
        {txns.length === 0 ? (
          <EmptyState icon="receipt" title="No transactions yet" hint="Tap + to log your first expense" />
        ) : (
          txns.slice(0, 5).map((t) => {
            const c = categoryById(t.category);
            const out = t.kind === "expense" || t.kind === "loan_given";
            return (
              <ListRow
                key={t.id}
                icon={<span style={{ color: c.color }}>{c.icon}</span>}
                title={t.note || c.label}
                subtitle={`${c.label} · ${formatDayLabel(t.occurred_at)}`}
                right={
                  <span className={`text-[15px] font-semibold tabular-nums ${out ? "" : "text-green"}`}>
                    {out ? "−" : "+"}{formatMoney(t.amount, currency)}
                  </span>
                }
              />
            );
          })
        )}
      </Card>
      <div className="h-6" />
    </div>
  );
}

function Stat({ label, value, currency, color }: { label: string; value: number; currency: string; color: string }) {
  return (
    <div>
      <p className="text-[12px] text-sub mb-0.5">{label}</p>
      <p className="text-[16px] font-bold tabular-nums" style={{ color }}>{formatMoney(value, currency)}</p>
    </div>
  );
}
