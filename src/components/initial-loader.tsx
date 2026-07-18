"use client";

import React, { useEffect, useState } from "react";
import { Terminal, BookOpen, Users, Database, Layers, CheckCircle2 } from "lucide-react";

interface LoadStep {
  icon: React.ReactNode;
  label: string;
  detail: string;
  duration: number; // ms after mount when this step becomes active
}

const LOAD_STEPS: LoadStep[] = [
  {
    icon: <Database size={13} />,
    label: "Connecting to Campus",
    detail: "Establishing secure session...",
    duration: 0,
  },
  {
    icon: <Users size={13} />,
    label: "Loading Profile",
    detail: "Fetching user & role data...",
    duration: 700,
  },
  {
    icon: <BookOpen size={13} />,
    label: "Syncing Academics",
    detail: "Caching courses & assignments...",
    duration: 1400,
  },
  {
    icon: <Layers size={13} />,
    label: "Preparing Dashboard",
    detail: "Hydrating session cache...",
    duration: 2100,
  },
];

interface InitialLoaderProps {
  /** Set to false when data is ready — triggers the fade-out exit animation */
  visible: boolean;
  /** Optional custom message shown below the wordmark */
  message?: string;
}

export function InitialLoader({
  visible,
  message = "Setting up your campus environment…",
}: InitialLoaderProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  /* ── Step sequencer ── */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    LOAD_STEPS.forEach((step, idx) => {
      timers.push(
        setTimeout(() => {
          setActiveStep(idx);
          if (idx > 0) {
            setCompletedSteps((prev) => [...prev, idx - 1]);
          }
        }, step.duration)
      );
    });

    // Mark last step complete
    timers.push(
      setTimeout(() => {
        setCompletedSteps([0, 1, 2, 3]);
      }, 2900)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  /* ── Smooth progress bar ── */
  useEffect(() => {
    const target = visible ? 92 : 100;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= target) {
          clearInterval(interval);
          return target;
        }
        const increment = target === 100 ? 4 : 0.6;
        return Math.min(p + increment, target);
      });
    }, 30);
    return () => clearInterval(interval);
  }, [visible]);

  /* ── Exit animation trigger ── */
  useEffect(() => {
    if (!visible) {
      setExiting(true);
    }
  }, [visible]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0C0F] transition-all duration-700 ease-in-out"
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? "scale(1.04)" : "scale(1)",
        pointerEvents: exiting ? "none" : "auto",
      }}
      aria-live="polite"
      aria-label="Loading campus portal"
      role="status"
    >
      {/* ── Ambient background orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)",
            animation: "orbDrift1 8s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[480px] h-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)",
            animation: "orbDrift2 10s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)",
            animation: "orbDrift3 6s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* ── Subtle dot-grid pattern ── */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #EDEFF5 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Main content card ── */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{ animation: "fadeUpIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        {/* ── Logo mark with orbital rings ── */}
        <div className="relative mb-10 flex items-center justify-center">
          {/* Outer orbital ring */}
          <div
            className="absolute w-[130px] h-[130px] rounded-full"
            style={{
              border: "1px solid rgba(37,99,235,0.12)",
              animation: "spinSlow 10s linear infinite",
            }}
          >
            <div
              className="absolute top-0 left-1/2 w-2 h-2 rounded-full"
              style={{
                background: "rgba(37,99,235,0.5)",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>

          {/* Inner orbital ring */}
          <div
            className="absolute w-[96px] h-[96px] rounded-full"
            style={{
              border: "1px solid rgba(6,182,212,0.18)",
              animation: "spinSlow 7s linear infinite reverse",
            }}
          >
            <div
              className="absolute bottom-0 left-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: "rgba(6,182,212,0.7)",
                transform: "translate(-50%, 50%)",
              }}
            />
          </div>

          {/* Glow halo */}
          <div
            className="absolute w-[72px] h-[72px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)",
              animation: "haloPulse 2.5s ease-in-out infinite",
            }}
          />

          {/* Center icon */}
          <div
            className="relative w-[58px] h-[58px] flex items-center justify-center rounded-2xl bg-[#131418]"
            style={{
              border: "1px solid #23252C",
              boxShadow:
                "0 8px 32px rgba(37,99,235,0.12), 0 0 0 1px rgba(37,99,235,0.06)",
            }}
          >
            <Terminal size={24} className="text-[#6E79F4]" strokeWidth={2.5} />
          </div>
        </div>

        {/* ── Wordmark ── */}
        <div className="flex flex-col items-center mb-2 select-none">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#EDEFF5] leading-none">
            Hynox Campus
          </h1>
          <span
            className="mt-1 text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: "rgba(37,99,235,0.6)" }}
          >
            Academic Engine v1.0
          </span>
        </div>

        {/* ── Tagline ── */}
        <p className="mt-3 text-sm text-[#C2C6D1] text-center max-w-[300px] leading-relaxed">
          {message}
        </p>

        {/* ── Status steps ── */}
        <div className="mt-8 w-[320px] flex flex-col gap-2">
          {LOAD_STEPS.map((step, idx) => {
            const isDone = completedSteps.includes(idx);
            const isActive = activeStep === idx && !isDone;
            const isPending = !isDone && !isActive;

            return (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: isDone
                    ? "rgba(22,163,74,0.05)"
                    : isActive
                    ? "rgba(37,99,235,0.05)"
                    : "transparent",
                  border: isDone
                    ? "1px solid rgba(22,163,74,0.12)"
                    : isActive
                    ? "1px solid rgba(37,99,235,0.10)"
                    : "1px solid transparent",
                  opacity: isPending ? 0.32 : 1,
                  transform: isActive ? "translateX(4px)" : "translateX(0px)",
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Icon or checkmark */}
                <div
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-300"
                  style={{
                    background: isDone
                      ? "rgba(22,163,74,0.10)"
                      : isActive
                      ? "rgba(37,99,235,0.10)"
                      : "rgba(71,85,105,0.08)",
                    color: isDone
                      ? "#2FBF71"
                      : isActive
                      ? "#6E79F4"
                      : "#737A88",
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        animation: isActive
                          ? "stepIconPulse 1s ease-in-out infinite"
                          : "none",
                      }}
                    >
                      {step.icon}
                    </span>
                  )}
                </div>

                {/* Labels */}
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-xs font-semibold leading-tight"
                    style={{
                      color: isDone
                        ? "#2FBF71"
                        : isActive
                        ? "#EDEFF5"
                        : "#737A88",
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    className="text-[10px] leading-tight mt-0.5"
                    style={{
                      color: isDone
                        ? "#86EFAC"
                        : isActive
                        ? "#9BA1AE"
                        : "#A6ACBB",
                    }}
                  >
                    {isDone ? "Complete" : step.detail}
                  </span>
                </div>

                {/* Active bouncing dots */}
                {isActive && (
                  <div className="ml-auto flex-shrink-0 flex gap-[3px] items-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-[#6E79F4]"
                        style={{
                          animation: `dotBounce 0.8s ease-in-out infinite`,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Progress bar ── */}
        <div className="mt-8 w-[320px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-medium text-[#A3A9B6] tracking-wide uppercase">
              Initializing
            </span>
            <span className="text-[10px] font-bold text-[#6E79F4] tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1 w-full bg-[#23252C] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, #6E79F4 0%, #22D3EE 100%)",
                boxShadow: "0 0 10px rgba(37,99,235,0.4)",
              }}
            />
          </div>
        </div>

        {/* ── Footer note ── */}
        <p className="mt-6 text-[10px] text-[#C9CDD8] text-center select-none">
          This happens once per session for a faster experience
        </p>
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes orbDrift1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          100% { transform: translate(30px, 20px) scale(1.05); }
        }
        @keyframes orbDrift2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          100% { transform: translate(-20px, -30px) scale(1.08); }
        }
        @keyframes orbDrift3 {
          0%   { transform: translate(-50%, -50%) scale(0.95); }
          100% { transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes haloPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.18); }
        }
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scaleY(1);   opacity: 0.45; }
          40%            { transform: scaleY(1.65); opacity: 1; }
        }
        @keyframes stepIconPulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
