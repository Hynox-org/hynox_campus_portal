"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SHARED_ROLE_COOKIE } from "@/lib/shared-login";

const subscribe = () => () => {};
export default function SharedDashboardSwitch() {
  const pathname = usePathname();
  const active = useSyncExternalStore(subscribe,
    () => document.cookie.split("; ").some(c => c.startsWith(`${SHARED_ROLE_COOKIE}=`)),
    () => false);
  if (!active || pathname.startsWith("/super-admin-login") || pathname === "/login") return null;
  // Full navigation clears dashboard caches when changing roles.
  return <a href="/super-admin-login/dashboards" className="fixed bottom-5 left-5 z-50 rounded-lg border border-blue-400/30 bg-[#131418] px-4 py-3 text-sm font-semibold text-blue-300 shadow-lg hover:bg-blue-950">Switch Dashboard</a>;
}
