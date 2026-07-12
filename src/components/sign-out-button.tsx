"use client";

import { signOutAction } from "@/app/actions/auth-actions";
import { LogOut } from "lucide-react";
import { useTransition } from "react";

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await signOutAction();
        });
      }}
      disabled={isPending}
      className="flex items-center gap-1.5 bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 px-3 py-1.5 rounded-lg hover:bg-[#DC2626] hover:text-white transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
      title="Sign Out"
    >
      <LogOut size={13} />
      <span className="hidden sm:inline">
        {isPending ? "Signing Out..." : "Sign Out"}
      </span>
    </button>
  );
}
