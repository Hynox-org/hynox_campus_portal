"use client";

import React, { useEffect, useState } from "react";
import { Terminal, Menu, X, LucideIcon } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import { cx } from "@/components/ui/primitives";

/* ============================================================
   AppShell — the workspace chrome shared by every dashboard.
   Desktop:  fixed left sidebar (brand → nav → user) + content
             column with a sticky page header.
   Mobile:   sticky top bar with a hamburger that opens the
             same sidebar as a slide-in drawer.
   Navigation is fully controlled by the parent via `items`,
   `activeId` and `onSelect`, so existing state machines and
   URL sync keep working untouched.
   ============================================================ */

export interface ShellNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  /** Sub-items shown (indented) while this item is active */
  children?: Array<{
    id: string;
    label: string;
    badge?: React.ReactNode;
    href?: string;
  }>;
  href?: string;
}

interface AppShellProps {
  portalLabel: string; // e.g. "Student Hub" / "Campus Admin"
  items: ShellNavItem[];
  activeId: string;
  activeChildId?: string;
  onSelect: (id: string, childId?: string) => void;
  userName: string;
  userMeta?: string; // e.g. institution name
  /** Right side of the sticky page header (e.g. cohort switcher) */
  headerActions?: React.ReactNode;
  /** Title shown in the sticky page header */
  pageTitle: string;
  children: React.ReactNode;
}

export default function AppShell({
  portalLabel,
  items,
  activeId,
  activeChildId,
  onSelect,
  userName,
  userMeta,
  headerActions,
  pageTitle,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever navigation happens or on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 overflow-y-auto" aria-label="Primary">
      {items.map((item) => {
        const ItemIcon = item.icon;
        const active = item.id === activeId;
        return (
          <React.Fragment key={item.id}>
            <button
              onClick={() => {
                onSelect(item.id);
                setDrawerOpen(false);
              }}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-all duration-150 cursor-pointer group",
                active
                  ? "bg-[#6E79F4]/12 text-[#EDEFF5]"
                  : "text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#1A1C22]"
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <ItemIcon
                  size={15}
                  className={cx("shrink-0 transition-colors", active ? "text-[#6E79F4]" : "text-[#A3A9B6] group-hover:text-[#C2C6D1]")}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge != null && (
                <span className="bg-[#1A1C22] border border-[#2E313A] text-[#E2E4EB] text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>

            {item.children && item.children.length > 0 && (
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    className={cx(
                      "flex flex-col gap-0.5 ml-[26px] pl-2.5 border-l border-[#23252C] my-1 transition-all duration-300 ease-out",
                      active ? "opacity-100 translate-y-0 delay-75" : "opacity-0 -translate-y-1"
                    )}
                  >
                    {item.children.map((child) => {
                      const childActive = child.id === activeChildId;
                      return (
                        <button
                          key={child.id}
                          onClick={() => {
                            onSelect(item.id, child.id);
                            setDrawerOpen(false);
                          }}
                          className={cx(
                            "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-left transition-all duration-150 cursor-pointer",
                            childActive
                              ? "text-[#6E79F4] bg-[#6E79F4]/10"
                              : "text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#1A1C22]"
                          )}
                        >
                          <span className="truncate">{child.label}</span>
                          {child.badge != null && (
                            <span className="bg-[#1A1C22] border border-[#2E313A] text-[#E2E4EB] text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums">
                              {child.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <div className="flex flex-col h-full bg-[#0E0F13] border-r border-[#1F2128]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#1F2128] shrink-0">
        <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/25">
          <Terminal size={16} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[13px] tracking-tight text-[#EDEFF5] leading-tight">Hynox Campus</span>
          <span className="text-[9px] text-[#A3A9B6] font-bold tracking-[0.14em] uppercase">{portalLabel}</span>
        </div>
      </div>

      {nav}

      {/* User */}
      <div className="px-3 py-3 border-t border-[#1F2128] shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[#6E79F4]/15 border border-[#6E79F4]/25 text-[#6E79F4] flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#EDEFF5] truncate leading-tight">{userName}</p>
            {userMeta && <p className="text-[9px] text-[#A3A9B6] truncate">{userMeta}</p>}
          </div>
          <SignOutButton compact />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0C0F] text-[#EDEFF5] font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-40">{sidebarInner}</aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] animate-slideOver" style={{ animationName: "hc-drawerIn" }}>
            {sidebarInner}
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 -right-11 bg-[#131418] border border-[#23252C] text-[#C2C6D1] p-2 rounded-xl"
            >
              <X size={16} />
            </button>
          </aside>
          <style>{`@keyframes hc-drawerIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
        </div>
      )}

      {/* Content column */}
      <div className="lg:pl-60 flex flex-col min-h-screen">
        {/* Sticky page header */}
        <header className="sticky top-0 z-30 h-16 bg-[#0B0C0F]/85 backdrop-blur-xl border-b border-[#1F2128] flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden text-[#C2C6D1] hover:text-[#EDEFF5] p-2 -ml-2 rounded-lg hover:bg-[#1A1C22] transition-colors"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-bold tracking-tight truncate">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-2 min-w-0">{headerActions}</div>
        </header>

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
