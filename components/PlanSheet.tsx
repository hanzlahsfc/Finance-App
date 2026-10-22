"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { loadPlanHtml } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export function PlanSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let dead = false;
    loadPlanHtml(plan)
      .then((t) => {
        if (!dead) setHtml(t);
      })
      .catch(() => {
        if (!dead) setErr(true);
      });
    document.body.style.overflow = "hidden";
    return () => {
      dead = true;
      document.body.style.overflow = "";
    };
  }, [plan]);

  return (
    <div className="plan-overlay">
      <div className="plan-bar">
        <span className="plan-title">{plan.title}</span>
        <button onClick={onClose} aria-label="Close" className="plan-close">
          <Icon name="x" size={20} />
        </button>
      </div>
      {err ? (
        <div className="plan-msg">Couldn&apos;t load — check your connection</div>
      ) : html === null ? (
        <div className="plan-msg">Loading…</div>
      ) : (
        <iframe className="plan-frame" srcDoc={html} title={plan.title} sandbox="allow-scripts allow-same-origin" />
      )}
    </div>
  );
}
