export function uuid(): string {
  return crypto.randomUUID();
}

export function formatMoney(amount: number, currency = "PKR"): string {
  const n = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
  return `${currency === "PKR" ? "Rs" : currency} ${formatted}`;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---- dates / weeks (weeks start Monday) ----
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

export function weekKey(d: Date): string {
  return toISODate(startOfWeek(d));
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function weekRangeLabel(weekStartIso: string): string {
  const s = new Date(weekStartIso + "T00:00:00");
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(s)} – ${fmt(e)}`;
}

// Period a bill falls due in: weekly → week_start, monthly → first of month, etc.
export function billPeriodStart(b: { frequency: string; due_day: number | null }, ref: Date): string {
  const d = new Date(ref);
  switch (b.frequency) {
    case "weekly":
      return toISODate(startOfWeek(d));
    case "monthly":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    case "yearly":
      return `${d.getFullYear()}-01-01`;
    default:
      return toISODate(d);
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
