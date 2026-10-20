"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { QuickAdd } from "./QuickAdd";
import { useApp } from "@/lib/store";

const TABS = [
  { href: "/", label: "Home", icon: "house" as const },
  { href: "/transactions", label: "Activity", icon: "list" as const },
  { href: "/obligations", label: "Obligations", icon: "coins" as const },
  { href: "/groups", label: "Friends", icon: "people" as const },
];

const HIDE_ON = ["/login", "/onboarding", "/auth/callback"];

export function TabBar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const { session } = useApp();

  if (HIDE_ON.some((p) => pathname.startsWith(p)) || !session) return null;

  return (
    <>
      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.slice(0, 2).map((t) => (
            <Link key={t.href} href={t.href} className={`tabitem ${pathname === t.href ? "on" : ""}`}>
              <Icon name={t.icon} size={24} strokeWidth={pathname === t.href ? 2.2 : 1.7} />
              {t.label}
            </Link>
          ))}
          <div className="tabitem" style={{ flex: "0 0 76px" }}>
            <button className="tab-add" onClick={() => setAddOpen(true)} aria-label="Add">
              <Icon name="plus" size={26} strokeWidth={2.4} color="#fff" />
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <Link key={t.href} href={t.href} className={`tabitem ${pathname === t.href ? "on" : ""}`}>
              <Icon name={t.icon} size={24} strokeWidth={pathname === t.href ? 2.2 : 1.7} />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      {addOpen && <QuickAdd onClose={() => setAddOpen(false)} />}
    </>
  );
}
