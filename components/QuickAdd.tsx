"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Segmented, Avatar } from "./ui";
import { Icon } from "./Icon";
import { useApp } from "@/lib/store";
import { useFriendships, useGroups, useProfileMap } from "@/lib/hooks";
import { db } from "@/lib/db";
import { addTransaction, createSplitWithFriends } from "@/lib/actions";
import { CATEGORIES, categorize, categoryById } from "@/lib/categories";
import { formatMoney } from "@/lib/utils";
import type { TxnKind, Group } from "@/lib/types";

const KIND_OPTIONS: { value: TxnKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "loan_given", label: "Lent" },
  { value: "loan_taken", label: "Borrowed" },
  { value: "set_aside", label: "Set aside" },
];

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { session, profile } = useApp();
  const uid = session?.user.id;
  const currency = profile?.currency ?? "PKR";
  const friendships = useFriendships(uid);
  const groups = useGroups(uid);
  const profileMap = useProfileMap();

  const [kind, setKind] = useState<TxnKind>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [place, setPlace] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [category, setCategory] = useState<string | null>(null); // null = auto

  // split state
  const [splitOn, setSplitOn] = useState(false);
  const [splitMode, setSplitMode] = useState<"friends" | "group">("friends");
  const [pickedFriends, setPickedFriends] = useState<Set<string>>(new Set());
  const [pickedGroup, setPickedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [owedAmounts, setOwedAmounts] = useState<Map<string, string>>(new Map());
  const [payer, setPayer] = useState<string>("me");
  const [paidSet, setPaidSet] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoCat = useMemo(() => categorize(note, kind), [note, kind]);
  const effectiveCat = kind === "set_aside" ? "savings" : category ?? autoCat;
  const parsed = parseFloat(amount.replace(/,/g, ""));

  const friends = useMemo(
    () =>
      friendships
        .filter((f) => f.status === "accepted")
        .map((f) => (f.user_id === uid ? f.friend_id : f.user_id)),
    [friendships, uid]
  );

  const splitTargets: string[] =
    splitMode === "friends"
      ? [...pickedFriends]
      : groupMembers.filter((m) => m !== uid);

  const othersTotal = splitTargets.reduce((s, id) => s + (parseFloat(owedAmounts.get(id) ?? "") || 0), 0);
  const myShare = (parsed || 0) - othersTotal;
  const hasSplitAmounts = splitTargets.some((id) => (parseFloat(owedAmounts.get(id) ?? "") || 0) > 0);
  const splitValid = !splitOn || (splitTargets.length > 0 && hasSplitAmounts && myShare >= 0);
  const valid = !isNaN(parsed) && parsed > 0 && splitValid;

  async function chooseGroup(g: Group) {
    setPickedGroup(g);
    const members = await db().group_members.where("group_id").equals(g.id).toArray();
    setGroupMembers(members.map((m) => m.user_id));
  }

  function toggleFriend(id: string) {
    const s = new Set(pickedFriends);
    if (s.has(id)) {
      s.delete(id);
      const m = new Map(owedAmounts);
      m.delete(id);
      setOwedAmounts(m);
    } else {
      s.add(id);
    }
    setPickedFriends(s);
  }

  async function save() {
    if (!valid || !uid) return;
    setSaving(true);
    setError("");
    try {
      const payerId = payer === "me" ? uid : payer;
      if (splitOn) {
        const splits = splitTargets
          .map((id) => ({
            user_id: id,
            owed_amount: parseFloat(owedAmounts.get(id) ?? "") || 0,
            settled: paidSet.has(id),
          }))
          .filter((s) => s.owed_amount > 0);
        await createSplitWithFriends({
          created_by: uid,
          paid_by: payerId,
          title: note || "Shared expense",
          total_amount: parsed,
          my_share: myShare,
          splits,
          group_id: splitMode === "group" ? pickedGroup?.id : undefined,
        });
      }
      await addTransaction({
        user_id: uid,
        kind,
        amount: splitOn ? myShare : parsed,
        note: splitOn ? `${note} (your share)` : note,
        category: effectiveCat,
        place,
        counterparty,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const pickerCats =
    kind === "income"
      ? CATEGORIES.filter((c) => c.id === "income" || c.id === "other")
      : CATEGORIES.filter((c) => !["income"].includes(c.id));

  const nameOf = (id: string) => profileMap.get(id)?.display_name ?? "…";

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
            placeholder={kind === "income" || kind === "loan_taken" ? "From whom" : "To whom / where"}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>
      )}

      {/* split with friends */}
      {kind === "expense" && (
        <div className="mb-4">
          <button
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-[14px] text-[15px] font-medium ${splitOn ? "bg-[rgba(0,200,83,0.15)] text-tint" : "bg-card2 text-label"}`}
            onClick={() => setSplitOn(!splitOn)}
          >
            <span className="flex items-center gap-2"><Icon name="people" size={18} /> Split with friends</span>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${splitOn ? "bg-tint" : "bg-card3"}`}>
              {splitOn && <Icon name="check" size={14} color="#fff" />}
            </span>
          </button>

          {splitOn && (
            <div className="mt-3">
              <Segmented
                options={[
                  { value: "friends", label: "Pick friends" },
                  { value: "group", label: "Pick group" },
                ]}
                value={splitMode}
                onChange={setSplitMode}
              />

              {/* who fronted the money */}
              {splitTargets.length > 0 && (
                <>
                  <label className="section-title mt-1">Paid by</label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar my-2">
                    <button
                      className={`pill shrink-0 ${payer === "me" ? "bg-tint text-white" : "bg-card2 text-sub"}`}
                      onClick={() => setPayer("me")}
                    >
                      Me
                    </button>
                    {splitTargets.map((id) => {
                      const p = profileMap.get(id);
                      return (
                        <button
                          key={id}
                          className={`pill shrink-0 flex items-center gap-1.5 ${payer === id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
                          onClick={() => setPayer(id)}
                        >
                          <Avatar name={p?.display_name ?? "?"} id={id} size={18} src={p?.avatar_url} />
                          {(p?.display_name ?? "…").split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {splitMode === "friends" ? (
                <>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar my-3">
                    {friends.length === 0 && (
                      <p className="text-sub2 text-[13px] py-2">No friends yet — add some from the Friends tab</p>
                    )}
                    {friends.map((fid) => {
                      const on = pickedFriends.has(fid);
                      const p = profileMap.get(fid);
                      return (
                        <button
                          key={fid}
                          className={`pill shrink-0 flex items-center gap-1.5 ${on ? "bg-tint text-white" : "bg-card2 text-sub"}`}
                          onClick={() => toggleFriend(fid)}
                        >
                          <Avatar name={p?.display_name ?? "?"} id={fid} size={18} src={p?.avatar_url} />
                          {(p?.display_name ?? "…").split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                  {splitTargets.map((fid) => (
                    <SplitAmountRow key={fid} id={fid} name={nameOf(fid)} avatar={profileMap.get(fid)?.avatar_url}
                      value={owedAmounts.get(fid) ?? ""}
                      onChange={(v) => setOwedAmounts(new Map(owedAmounts).set(fid, v))}
                      isPayer={payer === fid}
                      settled={paidSet.has(fid)}
                      onTogglePaid={() => {
                        const s = new Set(paidSet);
                        if (s.has(fid)) s.delete(fid); else s.add(fid);
                        setPaidSet(s);
                      }} />
                  ))}
                </>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar my-3">
                    {groups.length === 0 && (
                      <p className="text-sub2 text-[13px] py-2">No groups yet — or pick friends instead</p>
                    )}
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        className={`pill shrink-0 ${pickedGroup?.id === g.id ? "bg-tint text-white" : "bg-card2 text-sub"}`}
                        onClick={() => void chooseGroup(g)}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                  {splitTargets.map((mid) => (
                    <SplitAmountRow key={mid} id={mid} name={nameOf(mid)} avatar={profileMap.get(mid)?.avatar_url}
                      value={owedAmounts.get(mid) ?? ""}
                      onChange={(v) => setOwedAmounts(new Map(owedAmounts).set(mid, v))}
                      isPayer={payer === mid}
                      settled={paidSet.has(mid)}
                      onTogglePaid={() => {
                        const s = new Set(paidSet);
                        if (s.has(mid)) s.delete(mid); else s.add(mid);
                        setPaidSet(s);
                      }} />
                  ))}
                </>
              )}

              {splitTargets.length > 0 && (
                <div className="flex justify-between items-center px-2 py-2.5 mt-1 rounded-xl bg-card2">
                  <span className="text-[14px] text-sub">
                    Your share{payer !== "me" ? ` (owed to ${nameOf(payer).split(" ")[0]})` : ""}
                  </span>
                  <span className={`text-[15px] font-bold tabular-nums ${myShare < 0 ? "text-red" : "text-green"}`}>
                    {formatMoney(myShare, currency, true)}
                  </span>
                </div>
              )}
              {splitOn && myShare < 0 && (
                <p className="text-red text-[12px] px-1 mt-1">Friends&apos; amounts exceed the total</p>
              )}
            </div>
          )}
        </div>
      )}

      {kind === "set_aside" ? (
        <div className="card card-pad flex items-center gap-3 mb-6">
          <span className="w-9 h-9 rounded-[10px] bg-[rgba(94,229,200,0.15)] flex items-center justify-center text-teal text-[17px]">🏦</span>
          <p className="text-sub text-[14px] flex-1">Goes straight into your <span className="text-label font-medium">savings pool</span> — move it to goals or debts in Obligations</p>
        </div>
      ) : (
        <>
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
        </>
      )}

      {error && <p className="text-red text-[13px] text-center mb-2">{error}</p>}
      <button className="btn" disabled={!valid || saving} onClick={save}>
        {saving ? "Saving…" : splitOn ? `Save split · your share ${formatMoney(myShare, currency, true)}` : kind === "set_aside" ? "Set aside" : "Save"}
      </button>
    </Sheet>
  );
}

function SplitAmountRow({
  id, name, avatar, value, onChange, isPayer, settled, onTogglePaid,
}: {
  id: string; name: string; avatar?: string | null; value: string;
  onChange: (v: string) => void;
  isPayer: boolean; settled: boolean; onTogglePaid: () => void;
}) {
  return (
    <div className="list-row !px-2">
      <Avatar name={name} id={id} size={32} src={avatar} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium truncate">{name}</div>
        {isPayer && <div className="text-[11px] text-tint">paid the bill</div>}
      </div>
      {!isPayer && (
        <button
          className={`pill shrink-0 ${settled ? "bg-[rgba(48,209,88,0.15)] text-green" : "bg-card2 text-sub2"}`}
          onClick={onTogglePaid}
          title="Already paid their share"
        >
          {settled ? <><Icon name="check" size={11} /> paid</> : "owes"}
        </button>
      )}
      <div className="flex items-center gap-1">
        <span className="text-sub text-[13px]">Rs</span>
        <input
          className="input !py-2 text-right tabular-nums"
          style={{ width: 96 }}
          placeholder="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </div>
    </div>
  );
}
