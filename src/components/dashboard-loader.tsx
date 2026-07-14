"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export function DashboardLoader({ message = "Setting up your environment..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] h-full w-full bg-[#F8FAFC]">
      <div className="relative flex flex-col items-center">
        {/* Outer subtle pulse */}
        <div className="absolute inset-0 bg-[#2563EB]/5 rounded-full blur-3xl w-48 h-48 animate-pulse -z-10" />
        
        {/* Spinner */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] mb-6">
          <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin" strokeWidth={2.5} />
        </div>
        
        {/* Text content */}
        <h2 className="text-xl font-bold text-[#0F172A] mb-2">{message}</h2>
        <p className="text-sm text-[#475569] max-w-sm text-center">
          We are loading your campus data. This process happens only once per session so you can experience a lightning-fast dashboard.
        </p>

        {/* Loading bar animation */}
        <div className="mt-8 w-64 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-[#2563EB] rounded-full animate-[progress_2s_ease-in-out_infinite]" />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 40%; transform: translateX(50%); }
          100% { width: 100%; transform: translateX(200%); }
        }
      `}} />
    </div>
  );
}
