"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { QuickAdd } from "./QuickAdd";
import { useApp } from "@/lib/store";
import { useUserViews } from "@/lib/hooks";
import { OBLIGATIONS_USERNAME } from "@/lib/utils";

type TabDef = { href: string; label: string; icon: "house" | "list" | "wallet" | "people" | "coins" | "chart" };

const TABS: TabDef[] = [
  { href: "/", label: "Home", icon: "house" },
  { href: "/transactions", label: "Activity", icon: "list" },
  { href: "/business", label: "Cemzlah", icon: "wallet" },
  { href: "/groups", label: "Friends", icon: "people" },
];

const MEMBER_TABS: Record<string, TabDef> = {
  home: { href: "/", label: "Home", icon: "house" },
  activity: { href: "/transactions", label: "Activity", icon: "list" },
  friends: { href: "/groups", label: "Friends", icon: "people" },
  trip: { href: "/trip", label: "Trip", icon: "wallet" },
  committee: { href: "/committee", label: "Committee", icon: "coins" },
};

const HIDE_ON = ["/login", "/onboarding", "/auth/callback"];

export function TabBar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const { session, profile } = useApp();

  const userView = useUserViews(session?.user.id);

  if (HIDE_ON.some((p) => pathname.startsWith(p)) || !session) return null;

  const isOwner = !!profile && (profile.username === OBLIGATIONS_USERNAME || !!profile.admin);

  // Members get tabs for whatever dashboards the admin granted.
  let tabs = TABS;
  let showAdd = true;
  if (!isOwner) {
    const views = userView?.views ?? ["trip"];
    const memberTabs = [
      ...(views.includes("balance") ? [MEMBER_TABS.home, MEMBER_TABS.activity, MEMBER_TABS.friends] : []),
      ...(views.includes("trip") ? [MEMBER_TABS.trip] : []),
      ...(views.includes("committee") ? [MEMBER_TABS.committee] : []),
    ];
    if (memberTabs.length < 2) return null; // single-purpose app
    showAdd = views.includes("balance");
    tabs = memberTabs;
  }

  return (
    <>
      <nav className="tabbar">
        <div className="tabbar-inner">
          {(showAdd ? tabs.slice(0, 2) : tabs).map((t) => (
            <Link key={t.href} href={t.href} className={`tabitem ${pathname === t.href || pathname.startsWith(t.href + "/") ? "on" : ""}`}>
              <Icon name={t.icon} size={24} strokeWidth={pathname === t.href || pathname.startsWith(t.href + "/") ? 2.2 : 1.7} />
              {t.label}
            </Link>
          ))}
          {showAdd && (
            <div className="tabitem" style={{ flex: "0 0 76px" }}>
              <button className="tab-add" onClick={() => setAddOpen(true)} aria-label="Add">
                <Icon name="plus" size={26} strokeWidth={2.4} color="#fff" />
              </button>
            </div>
          )}
          {showAdd && tabs.slice(2).map((t) => (
            <Link key={t.href} href={t.href} className={`tabitem ${pathname === t.href || pathname.startsWith(t.href + "/") ? "on" : ""}`}>
              <Icon name={t.icon} size={24} strokeWidth={pathname === t.href || pathname.startsWith(t.href + "/") ? 2.2 : 1.7} />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      {addOpen && <QuickAdd onClose={() => setAddOpen(false)} />}
    </>
  );
}
