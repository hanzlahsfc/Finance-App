"use client";

import type { ReactNode } from "react";
import { cn, initials, formatMoney } from "@/lib/utils";
import { Icon, ICON_NAMES, type IconName } from "./Icon";
import { useApp } from "@/lib/store";
import { toggleAmountsHidden } from "@/lib/privacy";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="section-title">{children}</h3>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function ListRow({
  icon,
  iconBg,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon?: IconName | ReactNode;
  iconBg?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const isIconName = typeof icon === "string" && ICON_NAMES.has(icon);
  return (
    <div
      className={cn("list-row", onClick && "cursor-pointer active:bg-card2")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {icon && (
        <span
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-[17px]"
          style={{ background: iconBg ?? "var(--color-card2)" }}
        >
          {isIconName ? <Icon name={icon as IconName} size={19} /> : icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-medium truncate">{title}</div>
        {subtitle && <div className="text-[13px] text-sub truncate">{subtitle}</div>}
      </div>
      {right}
      {onClick && !right && <Icon name="chevronRight" size={16} className="text-sub2 shrink-0" />}
    </div>
  );
}

const AVATAR_COLORS = ["#0a84ff", "#30d158", "#ff9f0a", "#ff453a", "#bf5af2", "#64d2ff", "#ff375f", "#5e5ce6"];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, id, size = 38, src }: { name: string; id: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: avatarColor(id),
      }}
    >
      {initials(name || "?")}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-card2 flex items-center justify-center mb-4">
        <Icon name={icon} size={30} className="text-sub" />
      </div>
      <p className="text-[17px] font-semibold">{title}</p>
      {hint && <p className="text-[14px] text-sub mt-1">{hint}</p>}
    </div>
  );
}

export function EyeToggle({ className }: { className?: string }) {
  const { amountsHidden } = useApp();
  return (
    <button
      onClick={toggleAmountsHidden}
      aria-label={amountsHidden ? "Show amounts" : "Hide amounts"}
      className={cn("p-1 text-sub2", className)}
    >
      <Icon name={amountsHidden ? "eyeOff" : "eye"} size={18} />
    </button>
  );
}

export function Money({ amount, currency, className, sign }: { amount: number; currency?: string; className?: string; sign?: "+" | "-" }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {sign}{formatMoney(amount, currency)}
    </span>
  );
}
