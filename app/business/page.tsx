"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/lib/store";
import { useBusinessEntries } from "@/lib/hooks";
import { db } from "@/lib/db";
import { addBusinessEntry, addBusinessDraw, deleteBusinessEntry } from "@/lib/actions";
import { formatMoney, formatDayLabel, toISODate } from "@/lib/utils";
import { Card, SectionTitle, ListRow, Segmented, EmptyState, EyeToggle } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import type { BusinessEntry, BusinessKind } from "@/lib/types";

const ZAKAT_KEY = "zakat_percent";

export default function BusinessPage() {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const entries = useBusinessEntries(uid);

  const [addOpen, setAddOpen] = useState<"income" | "expense" | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [zakatOpen, setZakatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sel, setSel] = useState<BusinessEntry | null>(null);

  const zakatPct =
    useLiveQuery(async () => (await db().meta.get(ZAKAT_KEY))?.value ?? "15", [], "15");

  const income = entries.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);
  const zakatPaid = entries.filter((e) => e.kind === "zakat").reduce((s, e) => s + e.amount, 0);
  const drawn = entries.filter((e) => e.kind === "draw").reduce((s, e) => s + e.amount, 0);
  const profit = income - expense;
  const cash = profit - zakatPaid - drawn;
  const pct = parseFloat(zakatPct) || 15;
  const zakatDue = Math.max(0, Math.round((profit * pct) / 100 - zakatPaid));

  if (!session) return null;

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center justify-between mb-5">
        <h1 className="large-title">Cemzlah</h1>
        <button className="text-sub p-1" onClick={() => setSettingsOpen(true)} aria-label="Zakat settings">
          <Icon name="gear" size={22} />
        </button>
      </div>

      {/* profit + zakat hero */}
      <Card className="card-pad mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="section-title !mb-0">Business profit</span>
          <EyeToggle />
        </div>
        <p className={`amount-hero mt-2 ${profit < 0 ? "text-red" : ""}`}>{formatMoney(Math.max(0, profit), currency)}</p>
        <p className="text-sub text-[13px] mb-4">income {formatMoney(income, currency)} · spent {formatMoney(expense, currency)}</p>
        <p className="text-sub text-[13px] mb-3">
          cash in business {formatMoney(Math.max(0, cash), currency)}
          {drawn > 0 && <> · paid to me {formatMoney(drawn, currency)}</>}
        </p>
        <div className="border-t border-card2 pt-3 flex items-center justify-between">
          <div>
            <p className="text-[12px] text-sub mb-0.5">Zakat ({pct}% of profit)</p>
            <p className="text-[20px] font-bold tabular-nums text-teal">{formatMoney(zakatDue, currency)}</p>
            {zakatPaid > 0 && <p className="text-sub2 text-[11px] mt-0.5">{formatMoney(zakatPaid, currency)} given</p>}
          </div>
          <button className="pill bg-tint text-white" onClick={() => setZakatOpen(true)}>
            <Icon name="heart" size={13} /> Give zakat
          </button>
        </div>
      </Card>

      {/* add buttons */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button className="btn" onClick={() => setAddOpen("income")}>
          <Icon name="plus" size={17} /> Income
        </button>
        <button className="btn btn-secondary" onClick={() => setAddOpen("expense")}>
          <Icon name="minus" size={17} /> Expense
        </button>
      </div>
      <button className="btn btn-secondary w-full mb-6" onClick={() => setDrawOpen(true)}>
        <Icon name="wallet" size={17} /> Pay myself → personal
      </button>

      {/* entries */}
      <SectionTitle>Entries</SectionTitle>
      <Card className="mb-6">
        {entries.length === 0 ? (
          <EmptyState icon="wallet" title="Nothing yet" hint="Log business income and expenses — profit & zakat compute themselves" />
        ) : (
          entries.map((e) => (
            <ListRow
              key={e.id}
              icon={e.kind === "income" ? "chevronRight" : e.kind === "expense" ? "chevronLeft" : e.kind === "draw" ? "wallet" : "heart"}
              iconBg={e.kind === "income" ? "rgba(48,209,88,0.15)" : e.kind === "expense" ? "rgba(255,69,58,0.15)" : e.kind === "draw" ? "rgba(100,181,246,0.15)" : "rgba(94,229,200,0.15)"}
              title={e.note || (e.kind === "zakat" ? "Zakat" : e.kind === "draw" ? "Paid to me" : e.kind === "income" ? "Income" : "Expense")}
              subtitle={e.kind === "draw" ? `${formatDayLabel(e.occurred_at)} · to personal` : formatDayLabel(e.occurred_at)}
              right={
                <span className={`text-[15px] font-semibold tabular-nums ${e.kind === "income" ? "text-green" : e.kind === "zakat" ? "text-teal" : ""}`}>
                  {e.kind === "income" ? "+" : "−"}{formatMoney(e.amount, currency)}
                </span>
              }
              onClick={() => setSel(e)}
            />
          ))
        )}
      </Card>

      {addOpen && <AddSheet kind={addOpen} uid={uid!} onClose={() => setAddOpen(null)} />}
      {drawOpen && <DrawSheet uid={uid!} cash={cash} currency={currency} onClose={() => setDrawOpen(false)} />}
      {zakatOpen && <ZakatSheet uid={uid!} due={zakatDue} currency={currency} onClose={() => setZakatOpen(false)} />}
      {settingsOpen && <ZakatSettings current={pct} onClose={() => setSettingsOpen(false)} />}
      {sel && (
        <Sheet title={sel.note || "Entry"} onClose={() => setSel(null)}>
          <div className="text-center py-4">
            <p className="text-[34px] font-bold tabular-nums">{formatMoney(sel.amount, currency)}</p>
            <p className="text-sub text-[14px]">{sel.kind === "zakat" ? "Zakat" : sel.kind === "draw" ? "Paid to me" : sel.kind} · {formatDayLabel(sel.occurred_at)}</p>
            {sel.kind === "draw" && <p className="text-sub2 text-[12px] mt-1">deleting removes the personal income entry too</p>}
          </div>
          <button className="btn btn-danger" onClick={async () => { await deleteBusinessEntry(sel.id); setSel(null); }}>
            <Icon name="trash" size={17} /> Delete
          </button>
        </Sheet>
      )}
    </div>
  );
}

function AddSheet({ kind, uid, onClose }: { kind: "income" | "expense"; uid: string; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title={kind === "income" ? "Business income" : "Business expense"} onClose={onClose}>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <input className="input mb-3" placeholder={kind === "income" ? "What for — e.g. Order, invoice" : "What for — e.g. Stock, packaging"} value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="section-title">Date</label>
      <input className="input mb-6" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button
        className="btn"
        disabled={parsed <= 0 || !date}
        onClick={async () => {
          await addBusinessEntry({ user_id: uid, kind, amount: parsed, note, occurred_at: new Date(date).toISOString() });
          onClose();
        }}
      >
        Add {kind}
      </button>
    </Sheet>
  );
}

function DrawSheet({ uid, cash, currency, onClose }: { uid: string; cash: number; currency: string; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title="Pay myself" onClose={onClose}>
      <p className="text-sub text-[14px] text-center mt-1">Cash in business: {formatMoney(Math.max(0, cash), currency)}</p>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <input className="input mb-3" placeholder="Note — e.g. Monthly draw, expenses" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="section-title">Date</label>
      <input className="input mb-6" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button
        className="btn"
        disabled={parsed <= 0 || !date}
        onClick={async () => {
          await addBusinessDraw({ user_id: uid, amount: parsed, note, occurred_at: new Date(date).toISOString() });
          onClose();
        }}
      >
        Move to personal income
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Shows up in your Pay as &ldquo;{note.trim() || "Cemzlah"}&rdquo; — doesn&apos;t change profit or zakat.</p>
    </Sheet>
  );
}

function ZakatSheet({ uid, due, currency, onClose }: { uid: string; due: number; currency: string; onClose: () => void }) {
  const [amount, setAmount] = useState(String(due || ""));
  const [note, setNote] = useState("Zakat");
  const parsed = parseFloat(amount.replace(/,/g, "")) || 0;
  return (
    <Sheet title="Give zakat" onClose={onClose}>
      <p className="text-sub text-[14px] text-center mt-1">Due now: {formatMoney(due, currency)}</p>
      <div className="flex items-end justify-center gap-1 py-6">
        <span className="text-[20px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[44px] font-bold w-[200px] text-center tabular-nums placeholder:text-card3"
          placeholder="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>
      <input className="input mb-6" placeholder="Note — e.g. Edhi, family" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className="btn"
        disabled={parsed <= 0}
        onClick={async () => {
          await addBusinessEntry({ user_id: uid, kind: "zakat", amount: parsed, note });
          onClose();
        }}
      >
        Record zakat
      </button>
      <p className="text-sub2 text-[12px] text-center mt-3">Counts against what you owe — it won&apos;t hit your expense total.</p>
    </Sheet>
  );
}

function ZakatSettings({ current, onClose }: { current: number; onClose: () => void }) {
  const [pct, setPct] = useState(String(current));
  const parsed = parseFloat(pct) || 15;
  return (
    <Sheet title="Zakat rate" onClose={onClose}>
      <label className="section-title">% of profit given to charity</label>
      <div className="flex items-center gap-2 mb-6">
        <input className="input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))} />
        <span className="text-sub text-[15px] font-medium">%</span>
      </div>
      <button
        className="btn"
        disabled={parsed <= 0 || parsed > 100}
        onClick={async () => {
          await db().meta.put({ key: ZAKAT_KEY, value: String(parsed) });
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
