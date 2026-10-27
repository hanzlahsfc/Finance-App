"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { startOfWeek, endOfWeek, toISODate, billPeriodStart } from "./utils";
import type { Profile, Transaction, Bill, BillPayment, Obligation, SavingsGoal, Plan, Trip } from "./types";

export function useTransactions(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const rows = await db().transactions.where("user_id").equals(userId).toArray();
      return rows.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    },
    [userId],
    [] as Transaction[]
  );
}

export function useWeekTransactions(userId?: string, ref?: Date) {
  const txns = useTransactions(userId);
  const r = ref ?? new Date();
  const s = startOfWeek(r).getTime();
  const e = endOfWeek(r).getTime();
  return txns.filter((t) => {
    const t0 = new Date(t.occurred_at).getTime();
    return t0 >= s && t0 < e;
  });
}

export function useIncome(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const rows = await db().income_entries.where("user_id").equals(userId).toArray();
      return rows.sort((a, b) => b.week_start.localeCompare(a.week_start));
    },
    [userId],
    []
  );
}

export function useBills(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      return db().bills.where("user_id").equals(userId).filter((b) => b.active).toArray();
    },
    [userId],
    [] as Bill[]
  );
}

export function useBillPayments(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      return db().bill_payments.where("user_id").equals(userId).toArray();
    },
    [userId],
    [] as BillPayment[]
  );
}

export function billPaidThisPeriod(bill: Bill, payments: BillPayment[], ref = new Date()): boolean {
  const period = billPeriodStart(bill, ref);
  return payments.some((p) => p.bill_id === bill.id && p.period_start === period);
}

export function useFriendships(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      return db()
        .friendships.filter((f) => f.user_id === userId || f.friend_id === userId)
        .toArray();
    },
    [userId],
    []
  );
}

export function useProfiles() {
  return useLiveQuery(async () => db().profiles.toArray(), [], [] as Profile[]);
}

export function useProfileMap(): Map<string, Profile> {
  const profiles = useProfiles();
  return new Map(profiles.map((p) => [p.id, p]));
}

export function useGroups(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const memberships = await db().group_members.where("user_id").equals(userId).toArray();
      const ids = memberships.map((m) => m.group_id);
      const groups = await db().groups.bulkGet(ids);
      return groups.filter(Boolean).sort(
        (a, b) => (b!.created_at ?? "").localeCompare(a!.created_at ?? "")
      ) as NonNullable<(typeof groups)[number]>[];
    },
    [userId],
    []
  );
}

export function useGroup(groupId?: string) {
  return useLiveQuery(
    async () => {
      if (!groupId) return null;
      const [group, members, activities, settlements] = await Promise.all([
        db().groups.get(groupId),
        db().group_members.where("group_id").equals(groupId).toArray(),
        db().activities.where("group_id").equals(groupId).toArray(),
        db().settlements.where("group_id").equals(groupId).toArray(),
      ]);
      const actIds = new Set(activities.map((a) => a.id));
      const splits = await db()
        .activity_splits.filter((s) => actIds.has(s.activity_id))
        .toArray();
      activities.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return { group: group ?? null, members, activities, splits, settlements };
    },
    [groupId],
    null
  );
}

export function useObligations(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const rows = await db().obligations.where("user_id").equals(userId).toArray();
      return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    },
    [userId],
    [] as Obligation[]
  );
}

export function useGoals(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const rows = await db().savings_goals.where("user_id").equals(userId).toArray();
      return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    },
    [userId],
    [] as SavingsGoal[]
  );
}

export function usePlans(userId?: string) {
  return useLiveQuery(
    async () => (userId ? db().plans.where("user_id").equals(userId).toArray() : []),
    [userId],
    [] as Plan[]
  );
}

export function useTrips(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      const mems = await db().trip_members.where("user_id").equals(userId).toArray();
      const trips = await db().trips.bulkGet(mems.map((m) => m.trip_id));
      return trips.filter(Boolean).sort(
        (a, b) => (b!.created_at ?? "").localeCompare(a!.created_at ?? "")
      ) as NonNullable<(typeof trips)[number]>[];
    },
    [userId],
    undefined
  );
}

export function useTrip(tripId?: string) {
  return useLiveQuery(
    async () => {
      if (!tripId) return null;
      const [trip, members, contributions] = await Promise.all([
        db().trips.get(tripId),
        db().trip_members.where("trip_id").equals(tripId).toArray(),
        db().trip_contributions.where("trip_id").equals(tripId).toArray(),
      ]);
      contributions.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
      return { trip: trip ?? null, members, contributions };
    },
    [tripId],
    null
  );
}

/** Per-friend shared-event stats: event count and balances across all groups. */
export function useFriendStats(userId?: string) {
  return useLiveQuery(
    async () => {
      const map = new Map<string, { events: number; theyOwe: number; iOwe: number }>();
      if (!userId) return map;
      const memberships = await db().group_members.where("user_id").equals(userId).toArray();
      const groupIds = memberships.map((m) => m.group_id);
      if (!groupIds.length) return map;
      const acts = await db().activities.where("group_id").anyOf(groupIds).toArray();
      const actIds = new Set(acts.map((a) => a.id));
      const splits = (await db().activity_splits.toArray()).filter((s) => actIds.has(s.activity_id));
      const byAct = new Map<string, typeof splits>();
      for (const s of splits) {
        const arr = byAct.get(s.activity_id) ?? [];
        arr.push(s);
        byAct.set(s.activity_id, arr);
      }
      const bump = (fid: string) => {
        if (!map.has(fid)) map.set(fid, { events: 0, theyOwe: 0, iOwe: 0 });
        return map.get(fid)!;
      };
      for (const a of acts) {
        const ss = byAct.get(a.id) ?? [];
        if (a.paid_by === userId) {
          for (const s of ss) {
            if (s.user_id === userId) continue;
            const m = bump(s.user_id);
            m.events++;
            m.theyOwe += Math.max(0, s.owed_amount - s.settled_amount);
          }
        } else {
          const mine = ss.find((s) => s.user_id === userId);
          if (mine) {
            const m = bump(a.paid_by);
            m.events++;
            m.iOwe += Math.max(0, mine.owed_amount - mine.settled_amount);
          }
        }
      }
      return map;
    },
    [userId],
    new Map<string, { events: number; theyOwe: number; iOwe: number }>()
  );
}

/** Set-aside pool: total saved vs. what's earmarked into goals and debts. */
export function useSavingsPool(userId?: string, savingsPercent = 20) {
  const income = useIncome(userId);
  const txns = useTransactions(userId);
  const obligations = useObligations(userId);
  const goals = useGoals(userId);
  const manual = txns.filter((t) => t.kind === "set_aside").reduce((s, t) => s + t.amount, 0);
  const setAsideTotal = (income.reduce((s, i) => s + i.amount, 0) * savingsPercent) / 100 + manual;
  const inGoals = goals.reduce((s, g) => s + g.saved_amount, 0);
  const inDebts = obligations.filter((o) => o.status === "open").reduce((s, o) => s + o.reserved_amount, 0);
  const weeklyPlan =
    goals.filter((g) => g.status === "active").reduce((s, g) => s + g.weekly_amount, 0) +
    obligations.filter((o) => o.status === "open").reduce((s, o) => s + o.weekly_amount, 0);
  const free = Math.max(0, setAsideTotal - inGoals - inDebts);
  return { setAsideTotal, inGoals, inDebts, free, weeklyPlan };
}

/** Total friends still owe me across all groups (splits on activities I paid). */
export function useOwedToMe(userId?: string): { owed: number; iOwe: number } {
  return useLiveQuery(
    async () => {
      if (!userId) return { owed: 0, iOwe: 0 };
      const activities = await db().activities.toArray();
      const splits = await db().activity_splits.toArray();
      const paidByMe = new Set(activities.filter((a) => a.paid_by === userId).map((a) => a.id));
      let owed = 0;
      let iOwe = 0;
      for (const s of splits) {
        const rem = s.owed_amount - s.settled_amount;
        if (rem <= 0) continue;
        if (s.user_id === userId) {
          const act = activities.find((a) => a.id === s.activity_id);
          if (act && act.paid_by !== userId) iOwe += rem;
        } else if (paidByMe.has(s.activity_id)) {
          owed += rem;
        }
      }
      return { owed, iOwe };
    },
    [userId],
    { owed: 0, iOwe: 0 }
  ) ?? { owed: 0, iOwe: 0 };
}

export function todaySpend(txns: Transaction[]): number {
  const today = toISODate(new Date());
  return txns
    .filter((t) => t.kind !== "income" && t.occurred_at.slice(0, 10) === today)
    .reduce((s, t) => s + t.amount, 0);
}
