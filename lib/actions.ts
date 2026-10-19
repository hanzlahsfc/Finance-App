"use client";

import { db } from "./db";
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

export async function updateProfile(id: string, patch: Partial<{ display_name: string; currency: string; savings_percent: number; avatar_url: string }>) {
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

export async function createGroup(userId: string, name: string, memberIds: string[]) {
  const group: Group = { id: uuid(), name: name.trim(), created_by: userId };
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
  splits: { user_id: string; owed_amount: number }[];
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
    settled_amount: s.user_id === input.paid_by ? s.owed_amount : 0,
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
