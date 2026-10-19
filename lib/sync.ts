"use client";

import { db, type OutboxItem } from "./db";
import { supabase } from "./supabase";

// Tables we mirror locally for offline reads.
const MIRROR_TABLES = [
  "profiles",
  "friendships",
  "income_entries",
  "bills",
  "bill_payments",
  "transactions",
  "groups",
  "group_members",
  "activities",
  "activity_splits",
  "settlements",
] as const;

type MirrorTable = (typeof MIRROR_TABLES)[number];

export type SyncStatus = "offline" | "syncing" | "synced" | "error";

type Listener = () => void;
let status: SyncStatus = typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced";
let pendingCount = 0;
let snapshot = { status, pending: pendingCount };
const listeners = new Set<Listener>();
let currentUserId: string | null = null;
let flushing = false;
let initialized = false;
let realtimeChannel: ReturnType<ReturnType<typeof supabase>["channel"]> | null = null;

function emit() {
  snapshot = { status, pending: pendingCount };
  for (const l of listeners) l();
}
export function subscribeSync(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getSyncState(): { status: SyncStatus; pending: number } {
  return snapshot;
}

async function refreshPendingCount() {
  pendingCount = await db().outbox.count();
  emit();
}

// ---------- local write helpers ----------

/** Optimistically apply a mutation locally and queue it for the server. */
export async function enqueue(
  table: MirrorTable,
  action: OutboxItem["action"],
  payload: Record<string, unknown>
) {
  await applyLocal(table, action, payload);
  await db().outbox.add({
    op_id: crypto.randomUUID(),
    table,
    action,
    payload,
    created_at: Date.now(),
    attempts: 0,
  });
  await refreshPendingCount();
  void flush();
}

export async function applyLocal(
  table: MirrorTable,
  action: OutboxItem["action"],
  payload: Record<string, unknown>
) {
  const t = db().table(table) as {
    put: (v: unknown) => Promise<unknown>;
    delete: (k: unknown) => Promise<void>;
    update: (k: unknown, c: unknown) => Promise<unknown>;
  };
  if (action === "insert" || action === "rpc") {
    await t.put(payload.localRow ?? payload);
  } else if (action === "update") {
    await t.put(payload.localRow ?? payload);
  } else if (action === "delete") {
    const key = table === "group_members"
      ? [payload.group_id, payload.user_id]
      : payload.id;
    await t.delete(key);
  }
}

// ---------- push ----------

async function applyRemote(item: OutboxItem): Promise<void> {
  const sb = supabase();
  const { table, action, payload } = item;
  const clean = { ...payload };
  delete clean.localRow;
  delete clean.localPatch;

  if (action === "rpc") {
    const fn = payload.fn as string;
    const args = (payload.args as Record<string, unknown>) ?? {};
    const { error } = await sb.rpc(fn, args);
    if (error) throw error;
    return;
  }
  if (action === "insert") {
    const { error } = await sb.from(table).upsert(clean);
    if (error) throw error;
    return;
  }
  if (action === "update") {
    const { id, ...rest } = clean;
    const patch = (payload.localPatch as Record<string, unknown>) ?? rest;
    if (table === "group_members") {
      const { error } = await sb.from(table).update(patch)
        .eq("group_id", clean.group_id).eq("user_id", clean.user_id);
      if (error) throw error;
    } else {
      const { error } = await sb.from(table).update(patch).eq("id", id);
      if (error) throw error;
    }
    return;
  }
  if (action === "delete") {
    if (table === "group_members") {
      const { error } = await sb.from(table).delete()
        .eq("group_id", clean.group_id).eq("user_id", clean.user_id);
      if (error) throw error;
    } else {
      const { error } = await sb.from(table).delete().eq("id", clean.id);
      if (error) throw error;
    }
  }
}

export async function flush(): Promise<void> {
  if (flushing || !navigator.onLine || !currentUserId) return;
  flushing = true;
  try {
    const items = await db().outbox.orderBy("seq").toArray();
    if (items.length) {
      status = "syncing";
      emit();
    }
    for (const item of items) {
      try {
        await applyRemote(item);
        await db().outbox.delete(item.seq!);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "sync failed";
        // Permanent-looking errors (RLS/constraint) get dropped after retries
        // so one bad row can't jam the queue forever.
        const attempts = item.attempts + 1;
        if (attempts >= 5) {
          await db().outbox.delete(item.seq!);
        } else {
          await db().outbox.update(item.seq!, { attempts, last_error: msg });
        }
        status = "error";
        emit();
        break;
      }
    }
  } finally {
    flushing = false;
    await refreshPendingCount();
    if (status !== "error") {
      status = navigator.onLine ? "synced" : "offline";
      emit();
    }
  }
}

// ---------- pull ----------

/** Fetch everything visible to the user and mirror it into IndexedDB. */
export async function pullAll(): Promise<void> {
  const sb = supabase();
  const uid = currentUserId;
  if (!uid || !navigator.onLine) return;
  status = "syncing";
  emit();
  try {
    // Personal tables
    const [profilesRes, friendsRes, incomeRes, billsRes, billPayRes, txnRes, gmRes, groupsRes] =
      await Promise.all([
        sb.from("profiles").select("*"),
        sb.from("friendships").select("*"),
        sb.from("income_entries").select("*"),
        sb.from("bills").select("*"),
        sb.from("bill_payments").select("*"),
        sb.from("transactions").select("*").order("occurred_at", { ascending: false }).limit(2000),
        sb.from("group_members").select("*").eq("user_id", uid),
        sb.from("groups").select("*"),
      ]);
    for (const r of [profilesRes, friendsRes, incomeRes, billsRes, billPayRes, txnRes, gmRes, groupsRes]) {
      if (r.error) throw r.error;
    }

    const myGroupIds = (gmRes.data ?? []).map((g: { group_id: string }) => g.group_id);

    let activities: unknown[] = [];
    let splits: unknown[] = [];
    let settlements: unknown[] = [];
    let allMembers: unknown[] = [];
    if (myGroupIds.length) {
      const [a, s, st, m] = await Promise.all([
        sb.from("activities").select("*").in("group_id", myGroupIds),
        sb.from("activity_splits").select("*"),
        sb.from("settlements").select("*").in("group_id", myGroupIds),
        sb.from("group_members").select("*").in("group_id", myGroupIds),
      ]);
      if (a.error) throw a.error;
      if (s.error) throw s.error;
      if (st.error) throw st.error;
      if (m.error) throw m.error;
      activities = a.data ?? [];
      splits = (s.data ?? []).filter((sp: { activity_id: string }) =>
        activities.some((ac) => (ac as { id: string }).id === sp.activity_id)
      );
      settlements = st.data ?? [];
      allMembers = m.data ?? [];
    }

    const rows: Record<MirrorTable, unknown[]> = {
      profiles: profilesRes.data ?? [],
      friendships: friendsRes.data ?? [],
      income_entries: incomeRes.data ?? [],
      bills: billsRes.data ?? [],
      bill_payments: billPayRes.data ?? [],
      transactions: txnRes.data ?? [],
      groups: groupsRes.data ?? [],
      group_members: allMembers,
      activities,
      activity_splits: splits,
      settlements,
    };

    await db().transaction(
      "rw",
      [...MIRROR_TABLES.map((t) => db().table(t)), db().outbox],
      async () => {
        for (const table of MIRROR_TABLES) {
          const remote = rows[table] as { id?: string; group_id?: string; user_id?: string }[];
          const t = db().table(table);
          await t.clear();
          if (remote.length) await t.bulkPut(remote as never[]);
        }
        // restore locally-pending writes the server doesn't know about yet
        const outbox = await db().outbox.toArray();
        for (const o of outbox) {
          if (o.action === "insert" || o.action === "update" || o.action === "rpc") {
            const local = o.payload.localRow;
            if (local) await db().table(o.table).put(local as never);
          }
        }
      }
    );

    status = "synced";
    emit();
  } catch {
    status = navigator.onLine ? "error" : "offline";
    emit();
  }
}

// ---------- realtime for shared tables ----------

function subscribeRealtime() {
  if (realtimeChannel) return;
  const sb = supabase();
  realtimeChannel = sb
    .channel("hisab-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, (e) => applyRealtime("activities", e))
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_splits" }, (e) => applyRealtime("activity_splits", e))
    .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, (e) => applyRealtime("settlements", e))
    .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, (e) => applyRealtime("group_members", e))
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, (e) => applyRealtime("friendships", e))
    .subscribe();
}

async function applyRealtime(
  table: MirrorTable,
  e: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
) {
  const t = db().table(table);
  if (e.eventType === "DELETE") {
    const old = e.old as { id?: string; group_id?: string; user_id?: string };
    if (table === "group_members" && old.group_id && old.user_id) {
      await t.delete([old.group_id, old.user_id]);
    } else if (old.id) {
      await t.delete(old.id);
    }
  } else if (e.new && Object.keys(e.new).length) {
    await t.put(e.new as never);
  }
}

// ---------- lifecycle ----------

export async function initSync(userId: string): Promise<void> {
  currentUserId = userId;
  if (!initialized) {
    initialized = true;
    window.addEventListener("online", () => {
      status = "syncing";
      emit();
      void flush().then(() => pullAll());
    });
    window.addEventListener("offline", () => {
      status = "offline";
      emit();
    });
    setInterval(() => {
      if (navigator.onLine) void flush();
    }, 30_000);
  }
  await refreshPendingCount();
  if (navigator.onLine) {
    await flush();
    await pullAll();
    subscribeRealtime();
  } else {
    status = "offline";
    emit();
  }
}

export async function teardownSync(): Promise<void> {
  currentUserId = null;
  if (realtimeChannel) {
    void supabase().removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
