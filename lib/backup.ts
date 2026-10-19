"use client";

import { db } from "./db";
import { flush } from "./sync";
import { uuid } from "./utils";

const TABLES = [
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

// Tables owned by the signed-in user — user_id gets remapped on import so a
// backup restores cleanly onto the same account on any device.
const PERSONAL = new Set(["profiles", "income_entries", "bills", "bill_payments", "transactions"]);

interface BackupFile {
  app: "hisab";
  version: number;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function exportData(): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    tables[t] = await db().table(t).toArray();
  }
  const payload: BackupFile = {
    app: "hisab",
    version: 1,
    exported_at: new Date().toISOString(),
    tables: tables as BackupFile["tables"],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hisab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function remapRow(table: string, row: Record<string, unknown>, uid: string) {
  const r = { ...row };
  if (!PERSONAL.has(table)) return r;
  if (table === "profiles") r.id = uid;
  else r.user_id = uid;
  return r;
}

/** Restore a backup file: loads rows locally, then queues them all to sync. */
export async function importData(file: File, uid: string): Promise<number> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (!parsed || parsed.app !== "hisab" || typeof parsed.tables !== "object" || !parsed.tables) {
    throw new Error("Not a Hisab backup file");
  }

  const remapped: Record<string, Record<string, unknown>[]> = {};
  let count = 0;
  for (const t of TABLES) {
    const rows = parsed.tables[t];
    if (!Array.isArray(rows)) continue;
    remapped[t] = rows.map((r) => remapRow(t, r, uid));
    count += remapped[t].length;
  }

  await db().transaction(
    "rw",
    TABLES.map((t) => db().table(t)),
    async () => {
      for (const t of TABLES) {
        const rows = remapped[t];
        if (rows?.length) await db().table(t).bulkPut(rows as never[]);
      }
    }
  );

  // Queue upserts so the restored data reaches the server when online.
  const now = Date.now();
  const ops = [];
  for (const t of TABLES) {
    for (const row of remapped[t] ?? []) {
      ops.push({
        op_id: uuid(),
        table: t,
        action: "insert" as const,
        payload: { ...row, localRow: row },
        created_at: now,
        attempts: 0,
      });
    }
  }
  if (ops.length) await db().outbox.bulkAdd(ops);
  void flush();
  return count;
}
