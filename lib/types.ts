export type TxnKind = "expense" | "income" | "loan_given" | "loan_taken";
export type IncomeKind = "pay" | "bonus" | "other";
export type BillFrequency = "weekly" | "monthly" | "yearly" | "once";
export type FriendStatus = "pending" | "accepted";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  currency: string;
  savings_percent: number;
  created_at?: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at?: string;
}

export interface IncomeEntry {
  id: string;
  user_id: string;
  kind: IncomeKind;
  label: string;
  amount: number;
  week_start: string; // yyyy-mm-dd (Monday)
  received_at: string;
  created_at?: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  category: string;
  due_day: number | null;
  active: boolean;
  created_at?: string;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  user_id: string;
  amount: number;
  period_start: string;
  paid_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  kind: TxnKind;
  amount: number;
  category: string;
  note: string;
  place: string;        // optional: where it was made
  counterparty: string; // optional: paid to / received from
  occurred_at: string; // ISO
  created_at?: string;
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
  is_adhoc?: boolean;
  created_at?: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  added_by?: string | null;
  added_at?: string;
}

export interface Activity {
  id: string;
  group_id: string;
  created_by: string;
  paid_by: string;
  title: string;
  total_amount: number;
  occurred_at: string;
  created_at?: string;
}

export interface ActivitySplit {
  id: string;
  activity_id: string;
  user_id: string;
  owed_amount: number;
  settled_amount: number;
}

export type ObligationDirection = "i_owe" | "owed_to_me";
export type GoalKind = "need" | "want";

export interface Obligation {
  id: string;
  user_id: string;
  direction: ObligationDirection;
  kind: "money" | "item";
  counterparty: string;
  title: string;
  total_amount: number;
  settled_amount: number;
  status: "open" | "settled";
  due_date: string | null;
  created_at?: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  kind: GoalKind;
  title: string;
  target_amount: number;
  saved_amount: number;
  allocation_percent: number;
  status: "active" | "done";
  created_at?: string;
}

export interface Settlement {
  id: string;
  activity_id: string | null;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  note: string;
  created_by: string;
  created_at?: string;
}
