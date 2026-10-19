import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { uuid, weekKey } from "./utils";
import type { Profile } from "./types";

export const DEMO_UID = "demo-user";

export const DEMO_SESSION = {
  user: { id: DEMO_UID, email: "demo@hisab.app" },
  access_token: "demo",
} as unknown as Session;

/** Seed local demo data once so the app is explorable without Supabase. */
export async function ensureDemoData(): Promise<void> {
  const me = await db().profiles.get(DEMO_UID);
  if (me) return; // already seeded

  const people: Profile[] = [
    { id: DEMO_UID, username: "you", display_name: "You", avatar_url: null, currency: "PKR", savings_percent: 20 },
    { id: "demo-umar", username: "umar", display_name: "Umar", avatar_url: null, currency: "PKR", savings_percent: 20 },
    { id: "demo-sim", username: "sim", display_name: "Sim", avatar_url: null, currency: "PKR", savings_percent: 20 },
  ];
  await db().profiles.bulkPut(people);

  await db().friendships.bulkPut([
    { id: uuid(), user_id: DEMO_UID, friend_id: "demo-umar", status: "accepted" },
    { id: uuid(), user_id: DEMO_UID, friend_id: "demo-sim", status: "accepted" },
  ]);

  const groupId = uuid();
  await db().groups.put({ id: groupId, name: "Biryani nights", created_by: DEMO_UID, created_at: new Date().toISOString() });
  await db().group_members.bulkPut([
    { group_id: groupId, user_id: DEMO_UID, added_by: DEMO_UID },
    { group_id: groupId, user_id: "demo-umar", added_by: DEMO_UID },
    { group_id: groupId, user_id: "demo-sim", added_by: DEMO_UID },
  ]);

  // sample shared activity: you paid 300, each owes 100, Umar settled 50
  const actId = uuid();
  await db().activities.put({
    id: actId, group_id: groupId, created_by: DEMO_UID, paid_by: DEMO_UID,
    title: "Biryani", total_amount: 300, occurred_at: new Date().toISOString(),
  });
  await db().activity_splits.bulkPut([
    { id: uuid(), activity_id: actId, user_id: DEMO_UID, owed_amount: 100, settled_amount: 100 },
    { id: uuid(), activity_id: actId, user_id: "demo-umar", owed_amount: 100, settled_amount: 50 },
    { id: uuid(), activity_id: actId, user_id: "demo-sim", owed_amount: 100, settled_amount: 0 },
  ]);
  await db().settlements.put({
    id: uuid(), activity_id: actId, group_id: groupId,
    from_user: "demo-umar", to_user: DEMO_UID, amount: 50,
    note: "", created_by: "demo-umar", created_at: new Date().toISOString(),
  });

  // a couple of personal transactions + this week's pay
  const now = new Date();
  await db().transactions.bulkPut([
    { id: uuid(), user_id: DEMO_UID, kind: "expense", amount: 2500, category: "transport", note: "Petrol", place: "PS9 pump", counterparty: "", occurred_at: new Date(now.getTime() - 86400000).toISOString() },
    { id: uuid(), user_id: DEMO_UID, kind: "expense", amount: 950, category: "food", note: "Chai + samosa", place: "Cafe", counterparty: "", occurred_at: now.toISOString() },
  ]);
  await db().income_entries.put({
    id: uuid(), user_id: DEMO_UID, kind: "pay", label: "Weekly pay",
    amount: 25000, week_start: weekKey(now), received_at: now.toISOString().slice(0, 10),
  });
  await db().bills.put({
    id: uuid(), user_id: DEMO_UID, name: "Internet", amount: 3500,
    frequency: "monthly", category: "bills", due_day: 5, active: true,
  });
}
