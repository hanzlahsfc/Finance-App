"use client";

import { db } from "./db";
import { supabase } from "./supabase";
import { enqueue, flush } from "./sync";
import { categorize } from "./categories";
import { uuid, weekKey, billPeriodStart } from "./utils";
import type {
  TxnKind,
  IncomeKind,
  BillFrequency,
  Transaction,
  IncomeEntry,
  Bill,
  BillPayment,
  Activity,
  ActivitySplit,
  Group,
  Obligation,
  SavingsGoal,
} from "./types";

// ---------- transactions ----------

export async function addTransaction(input: {
  user_id: string;
  kind: TxnKind;
  amount: number;
  note: string;
  category?: string;
  place?: string;
  counterparty?: string;
  occurred_at?: string;
}): Promise<string> {
  const row: Transaction = {
    id: uuid(),
    user_id: input.user_id,
    kind: input.kind,
    amount: input.amount,
    category: input.category && input.category !== "auto" ? input.category : categorize(input.note, input.kind),
    note: input.note.trim(),
    place: input.place?.trim() ?? "",
    counterparty: input.counterparty?.trim() ?? "",
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  };
  await enqueue("transactions", "insert", { ...row, localRow: row });
  return row.id;
}

export async function deleteTransaction(id: string) {
  await enqueue("transactions", "delete", { id });
}

// ---------- income ----------

export async function addIncome(input: {
  user_id: string;
  kind: IncomeKind;
  amount: number;
  label?: string;
  date?: Date;
}): Promise<string> {
  const d = input.date ?? new Date();
  const row: IncomeEntry = {
    id: uuid(),
    user_id: input.user_id,
    kind: input.kind,
    label: input.label?.trim() ?? "",
    amount: input.amount,
    week_start: weekKey(d),
    received_at: d.toISOString().slice(0, 10),
  };
  await enqueue("income_entries", "insert", { ...row, localRow: row });
  return row.id;
}

export async function deleteIncome(id: string) {
  await enqueue("income_entries", "delete", { id });
}

// ---------- bills ----------

export async function addBill(input: {
  user_id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  category?: string;
  due_day?: number | null;
}): Promise<string> {
  const row: Bill = {
    id: uuid(),
    user_id: input.user_id,
    name: input.name.trim(),
    amount: input.amount,
    frequency: input.frequency,
    category: input.category ?? "bills",
    due_day: input.due_day ?? null,
    active: true,
  };
  await enqueue("bills", "insert", { ...row, localRow: row });
  return row.id;
}

export async function updateBill(bill: Bill, patch: Partial<Bill>) {
  const merged = { ...bill, ...patch };
  await enqueue("bills", "update", { ...merged, localRow: merged, localPatch: patch });
}

export async function deleteBill(id: string) {
  await enqueue("bills", "delete", { id });
}

export async function markBillPaid(bill: Bill, userId: string, amount?: number) {
  const row: BillPayment = {
    id: uuid(),
    bill_id: bill.id,
    user_id: userId,
    amount: amount ?? bill.amount,
    period_start: billPeriodStart(bill, new Date()),
    paid_at: new Date().toISOString(),
  };
  await enqueue("bill_payments", "insert", { ...row, localRow: row });
}

export async function unmarkBillPaid(bill: Bill) {
  const period = billPeriodStart(bill, new Date());
  const existing = await db()
    .bill_payments.where("bill_id")
    .equals(bill.id)
    .filter((p) => p.period_start === period)
    .first();
  if (existing) await enqueue("bill_payments", "delete", { id: existing.id });
}

// ---------- profile ----------

export async function upsertProfile(p: {
  id: string;
  username: string;
  display_name: string;
  currency?: string;
  savings_percent?: number;
}) {
  const row = {
    id: p.id,
    username: p.username.toLowerCase().trim(),
    display_name: p.display_name.trim(),
    avatar_url: null,
    currency: p.currency ?? "PKR",
    savings_percent: p.savings_percent ?? 20,
  };
  await enqueue("profiles", "insert", { ...row, localRow: row });
}

export async function updateProfile(id: string, patch: Partial<{ display_name: string; currency: string; savings_percent: number; avatar_url: string; email: string; show_email: boolean }>) {
  const cur = await db().profiles.get(id);
  if (!cur) return;
  const merged = { ...cur, ...patch };
  await enqueue("profiles", "update", { ...merged, localRow: merged, localPatch: patch });
}

// ---------- friends ----------

export async function sendFriendRequest(userId: string, friendId: string) {
  const row = { id: uuid(), user_id: userId, friend_id: friendId, status: "pending" };
  await enqueue("friendships", "insert", { ...row, localRow: row });
}

export async function acceptFriendRequest(friendshipId: string) {
  const cur = await db().friendships.get(friendshipId);
  if (!cur) return;
  const merged = { ...cur, status: "accepted" };
  await enqueue("friendships", "update", { id: friendshipId, localRow: merged, localPatch: { status: "accepted" } });
}

export async function removeFriendship(friendshipId: string) {
  await enqueue("friendships", "delete", { id: friendshipId });
}

// ---------- groups ----------

export async function createGroup(userId: string, name: string, memberIds: string[], adhoc = false) {
  const group: Group = { id: uuid(), name: name.trim(), created_by: userId, is_adhoc: adhoc };
  const members = [userId, ...memberIds.filter((m) => m !== userId)].map((uid) => ({
    group_id: group.id,
    user_id: uid,
    added_by: userId,
  }));
  await db().groups.put(group);
  await db().group_members.bulkPut(members);
  await enqueue("groups", "insert", { ...group, localRow: group });
  // members are queued separately so group exists first — keep order via outbox seq
  for (const m of members) {
    await db().outbox.add({
      op_id: uuid(), table: "group_members", action: "insert",
      payload: { ...m, localRow: m }, created_at: Date.now(), attempts: 0,
    });
  }
  void flush();
  return group.id;
}

export async function addGroupMember(groupId: string, userId: string, addedBy: string) {
  const row = { group_id: groupId, user_id: userId, added_by: addedBy };
  await enqueue("group_members", "insert", { ...row, localRow: row });
}

export async function removeGroupMember(groupId: string, userId: string) {
  await enqueue("group_members", "delete", { group_id: groupId, user_id: userId });
}

export async function renameGroup(groupId: string, name: string) {
  const cur = await db().groups.get(groupId);
  if (!cur) return;
  const merged = { ...cur, name: name.trim() };
  await enqueue("groups", "update", { id: groupId, localRow: merged, localPatch: { name: merged.name } });
}

// ---------- activities & splits ----------

export async function createActivity(input: {
  group_id: string;
  created_by: string;
  paid_by: string;
  title: string;
  total_amount: number;
  splits: { user_id: string; owed_amount: number; settled?: boolean }[];
  occurred_at?: string;
}) {
  const activity: Activity = {
    id: uuid(),
    group_id: input.group_id,
    created_by: input.created_by,
    paid_by: input.paid_by,
    title: input.title.trim(),
    total_amount: input.total_amount,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  };
  const splits: ActivitySplit[] = input.splits.map((s) => ({
    id: uuid(),
    activity_id: activity.id,
    user_id: s.user_id,
    owed_amount: s.owed_amount,
    settled_amount: s.user_id === input.paid_by || s.settled ? s.owed_amount : 0,
  }));
  await db().activities.put(activity);
  await db().activity_splits.bulkPut(splits);
  await enqueue("activities", "insert", { ...activity, localRow: activity });
  for (const s of splits) {
    await db().outbox.add({
      op_id: uuid(), table: "activity_splits", action: "insert",
      payload: { ...s, localRow: s }, created_at: Date.now(), attempts: 0,
    });
  }
  void flush();
  return activity.id;
}

export async function deleteActivity(activityId: string) {
  // cascades server-side; locally remove children too
  await db().activity_splits.where("activity_id").equals(activityId).delete();
  await db().settlements.where("activity_id").equals(activityId).delete();
  await enqueue("activities", "delete", { id: activityId });
}

export async function transferActivityAdmin(activity: Activity, newAdminId: string) {
  const merged = { ...activity, created_by: newAdminId };
  await enqueue("activities", "update", { id: activity.id, localRow: merged, localPatch: { created_by: newAdminId } });
}

/**
 * QuickAdd "split with friends": creates the activity in an existing group,
 * or in an auto-created ad-hoc group when friends are picked directly.
 */
export async function createSplitWithFriends(input: {
  created_by: string;
  paid_by?: string;
  title: string;
  total_amount: number;
  my_share: number;
  splits: { user_id: string; owed_amount: number; settled?: boolean }[];
  group_id?: string;
}) {
  const paidBy = input.paid_by ?? input.created_by;
  let groupId = input.group_id;
  if (!groupId) {
    groupId = await createGroup(input.created_by, input.title, input.splits.map((s) => s.user_id), true);
  }
  await createActivity({
    group_id: groupId,
    created_by: input.created_by,
    paid_by: paidBy,
    title: input.title,
    total_amount: input.total_amount,
    splits: [...input.splits, { user_id: input.created_by, owed_amount: input.my_share }],
  });
  return groupId;
}

// ---------- obligations ----------

export async function addObligation(input: {
  user_id: string;
  direction: "i_owe" | "owed_to_me";
  kind: "money" | "item";
  counterparty: string;
  title: string;
  total_amount: number;
  weekly_amount?: number;
  due_date?: string | null;
}) {
  const row: Obligation = {
    id: uuid(),
    user_id: input.user_id,
    direction: input.direction,
    kind: input.kind,
    counterparty: input.counterparty.trim(),
    title: input.title.trim(),
    total_amount: input.total_amount,
    settled_amount: 0,
    reserved_amount: 0,
    weekly_amount: input.weekly_amount ?? 0,
    status: "open",
    due_date: input.due_date ?? null,
  };
  await enqueue("obligations", "insert", { ...row, localRow: row });
  return row.id;
}

export async function updateObligation(o: Obligation, patch: Partial<Obligation>) {
  const merged = { ...o, ...patch };
  await enqueue("obligations", "update", { id: o.id, localRow: merged, localPatch: patch });
}

/** Earmark set-aside money toward a debt (doesn't pay it yet). */
export async function reserveForObligation(o: Obligation, amount: number) {
  const max = o.total_amount - o.settled_amount;
  await updateObligation(o, {
    reserved_amount: Math.min(o.reserved_amount + amount, max),
  });
}

export async function payObligation(o: Obligation, amount: number) {
  const settled = Math.min(o.total_amount, o.settled_amount + amount);
  const merged: Obligation = {
    ...o,
    settled_amount: settled,
    reserved_amount: Math.max(0, o.reserved_amount - amount),
    status: settled >= o.total_amount ? "settled" : "open",
  };
  await enqueue("obligations", "update", {
    id: o.id,
    localRow: merged,
    localPatch: {
      settled_amount: merged.settled_amount,
      reserved_amount: merged.reserved_amount,
      status: merged.status,
    },
  });
  // mirror the payment as a transaction so weekly reports stay true
  await addTransaction({
    user_id: o.user_id,
    kind: o.direction === "i_owe" ? "expense" : "income",
    amount,
    note: `${o.direction === "i_owe" ? "Paid" : "Received from"} ${o.counterparty}${o.title ? ` — ${o.title}` : ""}`,
    counterparty: o.counterparty,
    category: "obligations",
  });
}

export async function deleteObligation(id: string) {
  await enqueue("obligations", "delete", { id });
}

// ---------- savings goals ----------

export async function addGoal(input: {
  user_id: string;
  kind: "need" | "want";
  title: string;
  target_amount: number;
  weekly_amount: number;
  priority: "high" | "normal" | "low";
}) {
  const row: SavingsGoal = {
    id: uuid(),
    user_id: input.user_id,
    kind: input.kind,
    title: input.title.trim(),
    target_amount: input.target_amount,
    saved_amount: 0,
    weekly_amount: input.weekly_amount,
    priority: input.priority,
    status: "active",
  };
  await enqueue("savings_goals", "insert", { ...row, localRow: row });
  return row.id;
}

export async function contributeToGoal(g: SavingsGoal, amount: number) {
  const saved = Math.min(g.target_amount, g.saved_amount + amount);
  const merged: SavingsGoal = { ...g, saved_amount: saved, status: saved >= g.target_amount ? "done" : "active" };
  await enqueue("savings_goals", "update", {
    id: g.id,
    localRow: merged,
    localPatch: { saved_amount: merged.saved_amount, status: merged.status },
  });
}

export async function updateGoal(g: SavingsGoal, patch: Partial<SavingsGoal>) {
  const merged = { ...g, ...patch };
  await enqueue("savings_goals", "update", { id: g.id, localRow: merged, localPatch: patch });
}

export async function deleteGoal(id: string) {
  await enqueue("savings_goals", "delete", { id });
}

/** Resize a photo client-side and push it to the avatars bucket. */
export async function uploadAvatar(uid: string, file: File): Promise<void> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85)
  );

  const path = `${uid}/avatar.jpg`;
  const { error } = await supabase().storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase().storage.from("avatars").getPublicUrl(path);
  await updateProfile(uid, { avatar_url: `${data.publicUrl}?t=${Date.now()}` });
}

/** Record a payment toward a split. Optimistically updates local split + adds settlement. */
export async function recordPayment(input: {
  activity: Activity;
  from_user: string;
  amount: number;
  note?: string;
  recorded_by: string;
}) {
  const { activity, from_user, amount, note, recorded_by } = input;
  const split = await db()
    .activity_splits.where("activity_id").equals(activity.id)
    .filter((s) => s.user_id === from_user)
    .first();
  if (!split) throw new Error("no split");
  const updated = { ...split, settled_amount: Math.min(split.owed_amount, split.settled_amount + amount) };
  const settlement = {
    id: uuid(),
    activity_id: activity.id,
    group_id: activity.group_id,
    from_user,
    to_user: activity.paid_by,
    amount,
    note: note?.trim() ?? "",
    created_by: recorded_by,
    created_at: new Date().toISOString(),
  };
  await db().activity_splits.put(updated);
  await db().settlements.put(settlement);
  await enqueue("settlements", "rpc", {
    fn: "record_payment",
    args: { p_activity_id: activity.id, p_from_user: from_user, p_amount: amount, p_note: settlement.note },
    localRow: settlement,
  });
}
