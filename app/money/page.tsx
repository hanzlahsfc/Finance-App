"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useIncome, useBills, useBillPayments, billPaidThisPeriod, useWeekTransactions } from "@/lib/hooks";
import { formatMoney, weekKey, formatDate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Segmented, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { addIncome, deleteIncome, addBill, markBillPaid, unmarkBillPaid, deleteBill, updateProfile } from "@/lib/actions";
import { categoryById, CATEGORIES } from "@/lib/categories";
import type { IncomeKind, BillFrequency, Bill } from "@/lib/types";
import Link from "next/link";

export default function MoneyPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";

  const income = useIncome(uid);
  const bills = useBills(uid);
  const payments = useBillPayments(uid);
  const weekTxns = useWeekTransactions(uid);

  const [incomeSheet, setIncomeSheet] = useState(false);
  const [billSheet, setBillSheet] = useState(false);
  const [selBill, setSelBill] = useState<Bill | null>(null);
  const [selIncome, setSelIncome] = useState<string | null>(null);
  const [savingsSheet, setSavingsSheet] = useState(false);

  const wk = weekKey(new Date());
  const weekIncome = income.filter((i) => i.week_start === wk);
  const txnIncome = weekTxns.filter((t) => t.kind === "income");
  const payTotal = weekIncome.reduce((s, i) => s + i.amount, 0)
    + txnIncome.reduce((s, t) => s + t.amount, 0);
  const pct = profile?.savings_percent ?? 20;

  const unpaid = bills.filter((b) => !billPaidThisPeriod(b, payments));
  const paid = bills.filter((b) => billPaidThisPeriod(b, payments));

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-tint"><Icon name="chevronLeft" size={26} /></Link>
        <h1 className="large-title">Pay & Bills</h1>
      </div>

      {/* weekly pay */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">This week&apos;s pay</span>
        <button className="text-tint text-[14px] font-medium flex items-center gap-1" onClick={() => setIncomeSheet(true)}>
          <Icon name="plus" size={15} /> Add
        </button>
      </div>
      <Card className="mb-6">
        {weekIncome.length === 0 && txnIncome.length === 0 ? (
          <div className="card-pad text-center py-6">
            <p className="text-sub text-[15px]">No pay logged this week</p>
            <button className="text-tint text-[15px] font-medium mt-1" onClick={() => setIncomeSheet(true)}>
              Add your weekly pay
            </button>
          </div>
        ) : (
          <>
            <div className="card-pad pb-2">
              <p className="amount-hero !text-[36px]">{formatMoney(payTotal, currency)}</p>
            </div>
            {weekIncome.map((i) => (
              <ListRow
                key={i.id}
                icon="wallet"
                iconBg="rgba(48,209,88,0.15)"
                title={i.label || (i.kind === "pay" ? "Weekly pay" : i.kind === "bonus" ? "Bonus" : "Income")}
                subtitle={formatDate(i.received_at)}
                right={<span className="text-green text-[15px] font-semibold tabular-nums">+{formatMoney(i.amount, currency)}</span>}
                onClick={() => setSelIncome(i.id)}
              />
            ))}
            {txnIncome.map((t) => (
              <ListRow
                key={t.id}
                icon={<span className="text-green">💵</span>}
                title={t.note || "Income"}
                subtitle={`via transactions · ${formatDate(t.occurred_at)}`}
                right={<span className="text-green text-[15px] font-semibold tabular-nums">+{formatMoney(t.amount, currency)}</span>}
              />
            ))}
          </>
        )}
      </Card>

      {/* savings */}
      <SectionTitle>Set aside</SectionTitle>
      <Card className="mb-6">
        <ListRow
          icon="chart"
          iconBg="rgba(100,210,255,0.15)"
          title={`${pct}% of pay`}
          subtitle={payTotal > 0 ? `${formatMoney((payTotal * pct) / 100, currency)} this week` : "Set your savings goal"}
          right={<Icon name="chevronRight" size={16} className="text-sub2" />}
          onClick={() => setSavingsSheet(true)}
        />
      </Card>

      {/* bills */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="section-title !mb-0">Bills & expenses</span>
        <button className="text-tint text-[14px] font-medium flex items-center gap-1" onClick={() => setBillSheet(true)}>
          <Icon name="plus" size={15} /> Add
        </button>
      </div>
      <Card className="mb-4">
        {unpaid.length === 0 && paid.length === 0 ? (
          <EmptyState icon="receipt" title="No bills yet" hint="Add recurring bills — rent, internet, petrol budget…" />
        ) : (
          unpaid.map((b) => (
            <ListRow
              key={b.id}
              icon={categoryById(b.category).icon}
              title={b.name}
              subtitle={`${b.frequency}${b.due_day ? ` · due ${b.frequency === "weekly" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][b.due_day - 1] ?? "" : `${b.due_day}${ord(b.due_day)}`}` : ""}`}
              right={
                <button
                  className="pill bg-card2 text-sub"
                  onClick={(e) => { e.stopPropagation(); void markBillPaid(b, uid!); }}
                >
                  {formatMoney(b.amount, currency)} · Mark paid
                </button>
              }
              onClick={() => setSelBill(b)}
            />
          ))
        )}
        {paid.map((b) => (
          <ListRow
            key={b.id}
            icon={<Icon name="check" size={16} className="text-green" />}
            title={<span className="text-sub line-through">{b.name}</span>}
            subtitle={`paid · ${b.frequency}`}
            right={<span className="text-sub text-[14px] tabular-nums">{formatMoney(b.amount, currency)}</span>}
            onClick={() => setSelBill(b)}
          />
        ))}
      </Card>

      {incomeSheet && <IncomeSheet uid={uid!} onClose={() => setIncomeSheet(false)} />}
      {billSheet && <BillSheet uid={uid!} onClose={() => setBillSheet(false)} />}
      {selBill && (
        <BillDetail
          bill={selBill}
          paid={billPaidThisPeriod(selBill, payments)}
          onClose={() => setSelBill(null)}
        />
      )}
      {selIncome && (
        <Sheet title="Income" onClose={() => setSelIncome(null)}>
          {(() => {
            const i = weekIncome.find((x) => x.id === selIncome)!;
            return (
              <>
                <div className="text-center py-4">
                  <p className="text-[34px] font-bold tabular-nums text-green">+{formatMoney(i.amount, currency)}</p>
                  <p className="text-sub text-[15px]">{i.label || i.kind}</p>
                  <p className="text-sub2 text-[13px] mt-1">{formatDate(i.received_at)} · week of {formatDate(i.week_start)}</p>
                </div>
                <button className="btn btn-danger mt-4" onClick={async () => { await deleteIncome(i.id); setSelIncome(null); }}>
                  <Icon name="trash" size={18} /> Delete entry
                </button>
              </>
            );
          })()}
        </Sheet>
      )}
      {savingsSheet && (
        <Sheet title="Set aside" onClose={() => setSavingsSheet(false)}>
          <SavingsEditor uid={uid!} current={pct} onDone={() => setSavingsSheet(false)} />
        </Sheet>
      )}
    </div>
  );
}

function ord(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

function IncomeSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [kind, setKind] = useState<IncomeKind>("pay");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = parseFloat(amount.replace(/,/g, ""));

  return (
    <Sheet title="Add income" onClose={onClose}>
      <Segmented
        options={[
          { value: "pay", label: "Weekly pay" },
          { value: "bonus", label: "Bonus" },
          { value: "other", label: "Other" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[22px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[46px] font-bold w-[220px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <input className="input mb-5" placeholder="Label (optional) — e.g. Main job, overtime" value={label} onChange={(e) => setLabel(e.target.value)} />
      <button
        className="btn"
        disabled={!parsed || saving}
        onClick={async () => {
          setSaving(true);
          await addIncome({ user_id: uid, kind, amount: parsed, label });
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}

function BillSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState<BillFrequency>("monthly");
  const [category, setCategory] = useState("bills");
  const [dueDay, setDueDay] = useState("");
  const parsed = parseFloat(amount.replace(/,/g, ""));
  const cats = CATEGORIES.filter((c) => !["income", "loan_given", "loan_taken", "savings", "obligations"].includes(c.id));

  return (
    <Sheet title="New bill" onClose={onClose}>
      <input className="input mb-3" placeholder="Name — e.g. Rent, Internet, Petrol budget" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sub text-[15px] font-medium">Rs</span>
        <input className="input" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      <label className="section-title">Repeats</label>
      <Segmented
        options={[
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
          { value: "once", label: "Once" },
        ]}
        value={freq}
        onChange={setFreq}
      />
      {freq !== "once" && (
        <>
          <label className="section-title mt-4">Due {freq === "weekly" ? "day" : "date"}</label>
          <input className="input" placeholder={freq === "weekly" ? "1 = Monday … 7 = Sunday" : "Day of month (1–31)"} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} />
        </>
      )}
      <label className="section-title mt-4">Category</label>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {cats.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
            <span className="chip-icon" style={{ color: c.color }}>{c.icon}</span>
            {c.label.split(" ")[0]}
          </button>
        ))}
      </div>
      <button
        className="btn"
        disabled={!name.trim() || !parsed}
        onClick={async () => {
          const d = parseInt(dueDay, 10);
          await addBill({ user_id: uid, name, amount: parsed, frequency: freq, category, due_day: isNaN(d) ? null : d });
          onClose();
        }}
      >
        Save bill
      </button>
    </Sheet>
  );
}

function BillDetail({ bill, paid, onClose }: { bill: Bill; paid: boolean; onClose: () => void }) {
  const { session } = useApp();
  const { profile } = useApp();
  return (
    <Sheet title={bill.name} onClose={onClose}>
      <div className="text-center py-4">
        <span className="text-[40px]" style={{ color: categoryById(bill.category).color }}>{categoryById(bill.category).icon}</span>
        <p className="text-[34px] font-bold tabular-nums mt-2">{formatMoney(bill.amount, profile?.currency)}</p>
        <p className="text-sub text-[15px] capitalize">{bill.frequency} · {categoryById(bill.category).label}</p>
        <span className={`pill mt-3 ${paid ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-[rgba(255,159,10,0.15)] text-orange"}`}>
          {paid ? "Paid this period" : "Unpaid"}
        </span>
      </div>
      <button
        className="btn mt-4"
        onClick={async () => {
          if (paid) await unmarkBillPaid(bill);
          else await markBillPaid(bill, session!.user.id);
          onClose();
        }}
      >
        {paid ? "Mark as unpaid" : "Mark as paid"}
      </button>
      <button
        className="btn btn-danger mt-2"
        onClick={async () => { await deleteBill(bill.id); onClose(); }}
      >
        <Icon name="trash" size={18} /> Delete bill
      </button>
    </Sheet>
  );
}

function SavingsEditor({ uid, current, onDone }: { uid: string; current: number; onDone: () => void }) {
  const [v, setV] = useState(String(current));
  const presets = [10, 15, 20, 25, 30];
  return (
    <div>
      <p className="text-sub text-[14px] mb-4">Automatically set aside this share of every week&apos;s pay.</p>
      <div className="flex justify-center gap-2 mb-4">
        {presets.map((p) => (
          <button key={p} className={`pill ${parseFloat(v) === p ? "bg-tint text-white" : "bg-card2 text-sub"}`} onClick={() => setV(String(p))}>
            {p}%
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 justify-center mb-6">
        <input className="input text-center" style={{ width: 120 }} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} />
        <span className="text-sub">%</span>
      </div>
      <button
        className="btn"
        onClick={async () => {
          await updateProfile(uid, { savings_percent: Math.min(90, Math.max(0, parseFloat(v) || 0)) });
          onDone();
        }}
      >
        Save
      </button>
    </div>
  );
}
