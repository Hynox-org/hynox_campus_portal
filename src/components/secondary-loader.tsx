"use client";

import React from "react";

interface SecondaryLoaderProps {
  variant?: "spinner" | "skeleton" | "skeleton-grid";
  message?: string;
  className?: string;
}

export function SecondaryLoader({
  variant = "spinner",
  message = "Loading content...",
  className = "",
}: SecondaryLoaderProps) {
  if (variant === "skeleton") {
    return (
      <div className={`w-full space-y-4 p-5 bg-[#131418] border border-[#23252C] rounded-2xl ${className}`}>
        {/* Shimmer Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#1A1C22] rounded-xl animate-pulse relative overflow-hidden hc-shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-[#1F2128] rounded-md w-1/4 animate-pulse relative overflow-hidden hc-shimmer" />
            <div className="h-3 bg-[#1A1C22] rounded-md w-1/3 animate-pulse relative overflow-hidden hc-shimmer" />
          </div>
        </div>

        {/* Shimmer Rows */}
        <div className="space-y-3 pt-2">
          <div className="h-3.5 bg-[#1A1C22] rounded-md w-full animate-pulse relative overflow-hidden hc-shimmer" />
          <div className="h-3.5 bg-[#1A1C22] rounded-md w-[92%] animate-pulse relative overflow-hidden hc-shimmer" />
          <div className="h-3.5 bg-[#1A1C22] rounded-md w-[85%] animate-pulse relative overflow-hidden hc-shimmer" />
        </div>

        <style>{`
          .hc-shimmer::after {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.6) 20%,
              rgba(255, 255, 255, 0.8) 60%,
              rgba(255, 255, 255, 0) 100%
            );
            animation: hc-shimmer-anim 1.6s infinite;
          }
          @keyframes hc-shimmer-anim {
            100% {
              transform: translateX(100%);
            }
          }
          .bg-[#1F2128] {
            background-color: #EEF2F6;
          }
        `}</style>
      </div>
    );
  }

  if (variant === "skeleton-grid") {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 w-full ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 bg-[#131418] border border-[#23252C] rounded-2xl space-y-4">
            <div className="w-8 h-8 bg-[#1A1C22] rounded-lg animate-pulse relative overflow-hidden hc-shimmer" />
            <div className="space-y-2">
              <div className="h-3.5 bg-[#1F2128] rounded-md w-1/2 animate-pulse relative overflow-hidden hc-shimmer" />
              <div className="h-3 bg-[#1A1C22] rounded-md w-3/4 animate-pulse relative overflow-hidden hc-shimmer" />
            </div>
            <div className="h-[2px] bg-[#1A1C22] w-full pt-1" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-3 bg-[#1A1C22] rounded-md w-1/4 animate-pulse relative overflow-hidden hc-shimmer" />
              <div className="w-14 h-6 bg-[#1A1C22] rounded-lg animate-pulse relative overflow-hidden hc-shimmer" />
            </div>
          </div>
        ))}
        <style>{`
          .hc-shimmer::after {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.6) 20%,
              rgba(255, 255, 255, 0.8) 60%,
              rgba(255, 255, 255, 0) 100%
            );
            animation: hc-shimmer-anim 1.6s infinite;
          }
          @keyframes hc-shimmer-anim {
            100% {
              transform: translateX(100%);
            }
          }
          .bg-[#1F2128] {
            background-color: #EEF2F6;
          }
        `}</style>
      </div>
    );
  }

  // Spinner variant (default)
  return (
    <div className={`flex flex-col items-center justify-center p-8 bg-[#131418] border border-[#23252C] rounded-2xl min-h-[220px] ${className}`}>
      <div className="relative w-12 h-12 flex items-center justify-center mb-4">
        {/* Outer pulse */}
        <div className="absolute inset-0 bg-[#6E79F4]/5 rounded-full animate-ping opacity-60" />
        
        {/* Spinner ring */}
        <svg className="w-10 h-10 animate-spin text-[#6E79F4]" viewBox="0 0 36 36">
          <circle
            className="opacity-15"
            cx="18"
            cy="18"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="30 70"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-[#EDEFF5] tracking-tight">{message}</p>
        <span className="text-[10px] text-[#A3A9B6] font-medium tracking-wider uppercase mt-1 block">
          Loading Data Block
        </span>
      </div>
    </div>
  );
}
