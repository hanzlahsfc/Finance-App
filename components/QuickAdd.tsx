"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Segmented } from "./ui";
import { Icon } from "./Icon";
import { useApp } from "@/lib/store";
import { addTransaction } from "@/lib/actions";
import { CATEGORIES, categorize, categoryById } from "@/lib/categories";
import type { TxnKind } from "@/lib/types";

const KIND_OPTIONS: { value: TxnKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "loan_given", label: "Lent" },
  { value: "loan_taken", label: "Borrowed" },
];

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { session } = useApp();
  const [kind, setKind] = useState<TxnKind>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [place, setPlace] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [category, setCategory] = useState<string | null>(null); // null = auto
  const [saving, setSaving] = useState(false);

  const autoCat = useMemo(() => categorize(note, kind), [note, kind]);
  const effectiveCat = category ?? autoCat;
  const parsed = parseFloat(amount.replace(/,/g, ""));
  const valid = !isNaN(parsed) && parsed > 0;

  async function save() {
    if (!valid || !session) return;
    setSaving(true);
    try {
      await addTransaction({
        user_id: session.user.id,
        kind,
        amount: parsed,
        note,
        category: effectiveCat,
        place,
        counterparty,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const pickerCats =
    kind === "income"
      ? CATEGORIES.filter((c) => c.id === "income" || c.id === "other")
      : CATEGORIES.filter((c) => !["income"].includes(c.id));

  return (
    <Sheet title="Add transaction" onClose={onClose}>
      <Segmented options={KIND_OPTIONS} value={kind} onChange={(k) => { setKind(k); setCategory(null); }} />

      <div className="flex items-end justify-center gap-1 py-7">
        <span className="text-[24px] font-semibold text-sub mb-1.5">Rs</span>
        <input
          className="bg-transparent outline-none text-[52px] font-bold w-[230px] text-center tabular-nums placeholder:text-card3"
          placeholder="0"
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </div>

      <input
        className="input mb-3"
        placeholder="Note — e.g. petrol, biryani with friends"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {!showDetails ? (
        <button
          className="text-tint text-[14px] font-medium mb-4 px-1 flex items-center gap-1"
          onClick={() => setShowDetails(true)}
        >
          <Icon name="plus" size={14} /> Add place & person <span className="text-sub2 font-normal">(optional, for records)</span>
        </button>
      ) : (
        <div className="flex gap-2 mb-4">
          <input
            className="input"
            placeholder="Place — e.g. PS9 pump"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
          <input
            className="input"
            placeholder={kind === "income" || kind === "loan_taken" ? "From whom" : "To whom"}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[13px] font-semibold text-sub uppercase tracking-wide">Category</span>
        {category === null && note.trim() && (
          <span className="text-[12px] text-tint font-medium flex items-center gap-1">
            <Icon name="check" size={12} /> auto: {categoryById(autoCat).label}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {pickerCats.map((c) => (
          <button
            key={c.id}
            className={`chip ${effectiveCat === c.id ? "on" : ""}`}
            onClick={() => setCategory(c.id === category ? null : c.id)}
          >
            <span className="chip-icon" style={{ color: c.color }}>{c.icon}</span>
            {c.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <button className="btn" disabled={!valid || saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
    </Sheet>
  );
}
