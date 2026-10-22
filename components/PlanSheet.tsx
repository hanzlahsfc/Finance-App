"use client";

import { Sheet } from "./Sheet";
import type { Plan } from "@/lib/types";

export function PlanSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  return (
    <Sheet title={plan.title} onClose={onClose}>
      <iframe
        src={plan.url}
        title={plan.title}
        className="w-full rounded-[14px] bg-white"
        style={{ height: "72vh", border: 0 }}
      />
      <a href={plan.url} target="_blank" rel="noreferrer" className="btn btn-secondary mt-3 block text-center">
        Open in browser
      </a>
    </Sheet>
  );
}
