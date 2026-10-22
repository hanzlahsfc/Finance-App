import { db } from "./db";
import type { Plan } from "./types";

/** Load a plan's HTML, cached in IndexedDB so it opens instantly offline. */
export async function loadPlanHtml(plan: Plan): Promise<string> {
  const hit = await db().plan_files.get(plan.id);
  if (hit && hit.url === plan.url) return hit.text;
  const r = await fetch(plan.url);
  if (!r.ok) throw new Error(String(r.status));
  const text = await r.text();
  await db().plan_files.put({ id: plan.id, url: plan.url, text, fetched_at: Date.now() });
  return text;
}

/** Background prefetch of every known plan file (called after sync, online only). */
export async function prefetchPlans(): Promise<void> {
  const plans = await db().plans.toArray();
  await Promise.all(
    plans.map(async (p) => {
      const hit = await db().plan_files.get(p.id);
      if (!hit || hit.url !== p.url) {
        try {
          await loadPlanHtml(p);
        } catch {}
      }
    })
  );
}
