import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col items-center justify-center gap-3 text-[#C2C6D1]">
      <Loader2 size={24} className="animate-spin text-[#6E79F4]" />
      <span className="text-xs font-semibold uppercase tracking-wider">Loading challenge workspace...</span>
    </div>
  );
}
