"use client";

import { signOutAction } from "@/app/actions/auth-actions";
import { LogOut, Loader2 } from "lucide-react";
import { useTransition } from "react";

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (compact) {
    return (
      <button
        onClick={() => startTransition(async () => { await signOutAction(); })}
        disabled={isPending}
        className="p-2 rounded-lg text-[#A3A9B6] hover:text-[#F0555D] hover:bg-[#F0555D]/10 transition-all disabled:opacity-50 cursor-pointer shrink-0"
        title="Sign Out"
        aria-label="Sign Out"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await signOutAction();
        });
      }}
      disabled={isPending}
      className="flex items-center gap-1.5 bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20 px-3 py-1.5 rounded-lg hover:bg-[#F0555D] hover:text-white transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
      title="Sign Out"
    >
      <LogOut size={13} />
      <span className="hidden sm:inline">
        {isPending ? "Signing Out..." : "Sign Out"}
      </span>
    </button>
  );
}
