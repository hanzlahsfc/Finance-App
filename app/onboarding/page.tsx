"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { upsertProfile } from "@/lib/actions";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "INR"];

export default function Onboarding() {
  const { session } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [savings, setSavings] = useState("20");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const usernameOk = /^[a-z0-9_]{3,20}$/.test(username);

  async function finish() {
    if (!session || !name.trim() || !usernameOk) return;
    setSaving(true);
    setErr("");
    try {
      await upsertProfile({
        id: session.user.id,
        username,
        display_name: name,
        currency,
        savings_percent: Math.min(90, Math.max(0, parseFloat(savings) || 0)),
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That username may be taken — try another.");
      setSaving(false);
    }
  }

  return (
    <div className="screen flex flex-col px-7 pt-20">
      <h1 className="large-title mb-2">Set up your profile</h1>
      <p className="text-sub text-[15px] mb-8">Friends find you by your username.</p>

      <label className="section-title">Display name</label>
      <input
        className="input mb-5"
        placeholder="e.g. Hanzlah"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="section-title">Username</label>
      <input
        className="input mb-1"
        placeholder="e.g. hanzlah"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
      />
      <p className={`text-[13px] mb-5 px-1 ${username && !usernameOk ? "text-red" : "text-sub2"}`}>
        3–20 chars, lowercase letters, numbers, underscores
      </p>

      <label className="section-title">Currency</label>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {CURRENCIES.map((c) => (
          <button key={c} className={`chip ${currency === c ? "on" : ""}`} onClick={() => setCurrency(c)}>
            {c}
          </button>
        ))}
      </div>

      <label className="section-title">Default % of pay set aside</label>
      <div className="flex items-center gap-3 mb-8">
        <input
          className="input"
          style={{ width: 110 }}
          inputMode="decimal"
          value={savings}
          onChange={(e) => setSavings(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <span className="text-sub text-[15px]">of each week&apos;s pay goes to savings</span>
      </div>

      {err && <p className="text-red text-[14px] mb-4">{err}</p>}
      <button className="btn" disabled={!name.trim() || !usernameOk || saving} onClick={finish}>
        {saving ? "Setting up…" : "Start using Hisab"}
      </button>
    </div>
  );
}
