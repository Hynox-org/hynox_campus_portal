"use client";

import { Ban, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";

export default function InvitationStatusBadge({ status, expiresAt }: { status: string; expiresAt: string }) {
  const pending = ["created", "sent", "pending"].includes(status);
  const expiry = Date.parse(expiresAt);
  const [checkedAt] = useState(() => Date.now());
  const state = pending && (!Number.isFinite(expiry) || expiry <= checkedAt) ? "expired" : status;
  const labels: Record<string, string> = {
    accepted: "Accepted", expired: "Expired", failed: "Mail Failed", revoked: "Revoked",
    created: "Mail Pending", sent: "Mail Sent", pending: "Pending",
  };
  const color = state === "accepted" ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
    : state === "failed" || state === "expired" ? "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
    : state === "revoked" ? "bg-[#4A5060]/10 text-[#C2C6D1] border-[#3A3F4B]/20"
    : "bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20";
  const Icon = state === "accepted" ? CheckCircle : state === "revoked" ? Ban
    : state === "failed" || state === "expired" ? XCircle : Clock;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${color}`}><Icon size={10} />{labels[state] || "Unknown"}</span>;
}
