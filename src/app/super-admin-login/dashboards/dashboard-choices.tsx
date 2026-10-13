"use client";

import { useRef, useState } from "react";
import { SHARED_DASHBOARDS } from "@/lib/shared-login";
import { chooseSharedDashboard } from "../actions";

export default function DashboardChoices({ availableRoles }: { availableRoles: string[] }) {
  const busy = useRef(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [error, setError] = useState("");

  return (
    <div className="my-8" aria-busy={pendingRole !== null}>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(SHARED_DASHBOARDS).filter(([role]) => availableRoles.includes(role)).map(([role, dashboard]) => (
          <form key={role} onSubmit={async event => {
            event.preventDefault();
            if (busy.current) return;
            busy.current = true;
            setPendingRole(role);
            setError("");
            const formData = new FormData();
            formData.set("role", role);
            try {
              const result = await chooseSharedDashboard(formData);
              // A full navigation applies the new role cookie and discards the previous dashboard cache.
              window.location.assign(result.path);
            } catch {
              busy.current = false;
              setPendingRole(null);
              setError("Unable to open this dashboard. Please try again.");
            }
          }}>
            <button type="submit" disabled={pendingRole !== null} className="w-full rounded-lg border border-white/15 bg-blue-500/10 p-5 text-left font-semibold hover:bg-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {pendingRole === role ? `Opening ${dashboard.label}…` : dashboard.label}
            </button>
          </form>
        ))}
      </div>
      {pendingRole && <p role="status" className="mt-3 text-sm text-slate-400">Opening your dashboard. Please wait…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
