import Dexie, { type Table } from "dexie";
import type {
  Profile,
  Friendship,
  IncomeEntry,
  Bill,
  BillPayment,
  Transaction,
  Group,
  GroupMember,
  Activity,
  ActivitySplit,
  Settlement,
  Obligation,
  SavingsGoal,
  Plan,
} from "./types";

export interface OutboxItem {
  seq?: number; // autoincrement
  op_id: string;
  table: string;
  action: "insert" | "update" | "delete" | "rpc";
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error?: string;
}

class HisabDB extends Dexie {
  profiles!: Table<Profile, string>;
  friendships!: Table<Friendship, string>;
  income_entries!: Table<IncomeEntry, string>;
  bills!: Table<Bill, string>;
  bill_payments!: Table<BillPayment, string>;
  transactions!: Table<Transaction, string>;
  groups!: Table<Group, string>;
  group_members!: Table<GroupMember, [string, string]>;
  activities!: Table<Activity, string>;
  activity_splits!: Table<ActivitySplit, string>;
  settlements!: Table<Settlement, string>;
  obligations!: Table<Obligation, string>;
  savings_goals!: Table<SavingsGoal, string>;
  plans!: Table<Plan, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("hisab");
    this.version(3).stores({
      profiles: "id, username",
      friendships: "id, user_id, friend_id, status",
      income_entries: "id, user_id, week_start",
      bills: "id, user_id, active",
      bill_payments: "id, bill_id, user_id, period_start",
      transactions: "id, user_id, occurred_at, category, kind",
      groups: "id",
      group_members: "[group_id+user_id], group_id, user_id",
      activities: "id, group_id, occurred_at",
      activity_splits: "id, activity_id, user_id",
      settlements: "id, group_id, activity_id",
      obligations: "id, user_id, direction, status",
      savings_goals: "id, user_id, kind, status",
      plans: "id, user_id, kind",
      outbox: "++seq, table",
      meta: "key",
    });
  }
}

let _db: HisabDB | null = null;
export function db(): HisabDB {
  if (!_db) _db = new HisabDB();
  return _db;
}
