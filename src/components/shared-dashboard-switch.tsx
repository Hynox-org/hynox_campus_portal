"use client";

import { useState, useSyncExternalStore } from "react";
import { SHARED_ROLE_COOKIE } from "@/lib/shared-login";

const subscribe = () => () => {};
export default function SharedDashboardSwitch({ userName, userMeta }: { userName: string; userMeta?: string }) {
  const [pending, setPending] = useState(false);
  const active = useSyncExternalStore(subscribe,
    () => document.cookie.split("; ").some(c => c.startsWith(`${SHARED_ROLE_COOKIE}=`)),
    () => false);
  const className = "block text-[11px] font-bold text-[#EDEFF5] truncate leading-tight";
  if (!active) return <>
    <p className={className}>{userName}</p>
    {userMeta && <p className="text-[9px] text-[#A3A9B6] truncate">{userMeta}</p>}
  </>;
  // Full navigation clears dashboard caches when changing roles.
  return <a href="/super-admin-login/dashboards" aria-disabled={pending} aria-busy={pending} onClick={event => {
    if (pending) event.preventDefault();
    else if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) setPending(true);
  }} className={`${className} rounded hover:text-[#6E79F4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E79F4]`}>
    {pending ? "Switching…" : "Switch Dashboard"}
  </a>;
}
