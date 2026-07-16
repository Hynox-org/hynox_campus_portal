"use client";

import React, { useEffect, useState } from "react";
import { Terminal } from "lucide-react";

interface DashboardLoaderProps {
  loading: boolean;
  message?: string;
}

export function DashboardLoader({
  loading,
  message = "Setting up your campus environment…",
}: DashboardLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  // Only ever show the full-screen takeover if we were actually loading when
  // this mounted. Data that's already cached (e.g. switching between sections
  // that remount this component) must never re-trigger the splash screen.
  const [mounted, setMounted] = useState(loading);
  const [exiting, setExiting] = useState(false);

  /* ── Loading turned on again after this had settled to hidden ── */
  useEffect(() => {
    if (loading && !mounted) {
      setMounted(true);
      setExiting(false);
      setMinTimeElapsed(false);
      setProgress(0);
    }
  }, [loading, mounted]);

  /* ── Minimum duration timer (3 seconds), scoped to each time it shows ── */
  useEffect(() => {
    if (!mounted || exiting) return;
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [mounted, exiting]);

  /* ── Monitor loading state & minimum duration to trigger fade out ── */
  useEffect(() => {
    if (mounted && !loading && minTimeElapsed) {
      setExiting(true);
      const timer = setTimeout(() => {
        setMounted(false);
      }, 400); // matches the transition opacity duration
      return () => clearTimeout(timer);
    }
  }, [loading, minTimeElapsed, mounted]);

  /* ── Progress bar increment ── */
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Speed up progress once actual data has loaded
        const increment = !loading && minTimeElapsed ? 5 : 0.65;
        return Math.min(p + increment, 100);
      });
    }, 30);
    return () => clearInterval(interval);
  }, [loading, minTimeElapsed, mounted]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F8FAFC]"
      role="status"
      aria-label="Loading campus portal"
      aria-live="polite"
      style={{
        transition: "opacity 400ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      <div
        className="flex flex-col items-center gap-7"
        style={{ animation: "hc-rise 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Spinning arc + icon */}
        <div className="relative w-[88px] h-[88px] flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 88 88"
            fill="none"
          >
            {/* Track circle */}
            <circle
              cx="44"
              cy="44"
              r="40"
              stroke="#E2E8F0"
              strokeWidth="2"
            />
            {/* Spinning arc */}
            <circle
              cx="44"
              cy="44"
              r="40"
              stroke="#2563EB"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="62 190"
              style={{
                transformOrigin: "center",
                animation: "hc-arc 1.5s ease-in-out infinite",
              }}
            />
          </svg>

          {/* Icon */}
          <div
            className="w-12 h-12 bg-white rounded-xl flex items-center justify-center"
            style={{
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            }}
          >
            <Terminal size={20} className="text-[#2563EB]" strokeWidth={2.5} />
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight leading-none">
            Hynox Campus
          </h2>
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#94A3B8]">
            Academic Engine v1.0
          </span>
          <p className="mt-1 text-sm text-[#475569] max-w-[240px] leading-snug">
            {message}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col items-end gap-1.5 w-52">
          <span className="text-[10px] font-semibold text-[#2563EB] tabular-nums">
            {Math.round(progress)}%
          </span>
          <div className="w-full h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] rounded-full"
              style={{
                width: `${progress}%`,
                transition: "width 0.3s ease-out",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hc-rise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hc-arc {
          0%   { transform: rotate(-90deg); stroke-dashoffset: 0; }
          50%  { transform: rotate(90deg);  stroke-dashoffset: -40; }
          100% { transform: rotate(270deg); stroke-dashoffset: -62; }
        }
      `}</style>
    </div>
  );
}
