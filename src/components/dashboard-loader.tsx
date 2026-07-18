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
      }, 600); // matches the exit transition duration
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#0B0C0F]"
      role="status"
      aria-label="Loading campus portal"
      aria-live="polite"
      style={{
        transition:
          "opacity 600ms cubic-bezier(0.4, 0, 0.2, 1), transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "scale(1.03)" : "scale(1)",
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {/* ── Ambient aurora glow ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 w-[640px] h-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(110,121,244,0.10) 0%, rgba(34,211,238,0.04) 45%, transparent 70%)",
            animation: "hc-breathe 5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, rgba(110,121,244,0.05) 25%, transparent 50%, rgba(34,211,238,0.04) 75%, transparent 100%)",
            animation: "hc-rotate 24s linear infinite",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo mark with conic halo */}
        <div
          className="relative w-[104px] h-[104px] flex items-center justify-center"
          style={{ animation: "hc-enter 0.9s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Rotating conic-gradient ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, #6E79F4 18%, #22D3EE 32%, transparent 45%)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
              animation: "hc-rotate 2.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite",
            }}
          />
          {/* Faint static track */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(35,37,44,0.9)" }}
          />
          {/* Soft glow following the ring */}
          <div
            className="absolute inset-[-14px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(110,121,244,0.16) 0%, transparent 65%)",
              animation: "hc-breathe 2.4s ease-in-out infinite",
            }}
          />
          {/* Icon tile */}
          <div
            className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center bg-[#131418]"
            style={{
              border: "1px solid #23252C",
              boxShadow:
                "0 12px 40px rgba(110,121,244,0.14), inset 0 1px 0 rgba(237,239,245,0.04)",
              animation: "hc-float 4s ease-in-out infinite",
            }}
          >
            <Terminal size={22} className="text-[#6E79F4]" strokeWidth={2.5} />
          </div>
        </div>

        {/* Wordmark with shimmer */}
        <div
          className="mt-8 flex flex-col items-center gap-1.5 text-center select-none"
          style={{
            animation: "hc-enter 0.9s cubic-bezier(0.16,1,0.3,1) 0.12s both",
          }}
        >
          <h2
            className="text-lg font-bold tracking-tight leading-none"
            style={{
              background:
                "linear-gradient(100deg, #EDEFF5 40%, #6E79F4 50%, #22D3EE 55%, #EDEFF5 65%)",
              backgroundSize: "250% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              animation: "hc-shimmer 3.2s ease-in-out infinite",
            }}
          >
            Hynox Campus
          </h2>
          <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#737A88]">
            Academic Engine v1.0
          </span>
          <p className="mt-1.5 text-sm text-[#C2C6D1] max-w-[260px] leading-snug">
            {message}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="mt-8 flex flex-col gap-2 w-56"
          style={{
            animation: "hc-enter 0.9s cubic-bezier(0.16,1,0.3,1) 0.24s both",
          }}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#737A88]">
              Loading
            </span>
            <span className="text-[10px] font-semibold text-[#6E79F4] tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative w-full h-[3px] bg-[#23252C] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #6E79F4, #22D3EE)",
                boxShadow: "0 0 12px rgba(110,121,244,0.5)",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            {/* Light sweep across the filled bar */}
            <div
              className="absolute inset-y-0 w-16 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(237,239,245,0.35), transparent)",
                animation: "hc-sweep 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hc-enter {
          from { opacity: 0; transform: translateY(16px) scale(0.98); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes hc-rotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hc-breathe {
          0%, 100% { opacity: 0.55; transform: scale(0.96); }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        @keyframes hc-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes hc-shimmer {
          0%   { background-position: 120% 0; }
          100% { background-position: -130% 0; }
        }
        @keyframes hc-sweep {
          0%   { left: -25%; opacity: 0; }
          30%  { opacity: 1; }
          100% { left: 105%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
