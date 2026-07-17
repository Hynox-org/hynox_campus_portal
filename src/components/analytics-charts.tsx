"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Shared, dependency-free chart primitives styled to match the app's design
// system (CSS vars from globals.css: --primary, --success, --warning, --error,
// --accent, --text-secondary, --border-muted). No external charting library.
// ---------------------------------------------------------------------------

export interface HBarDatum {
  id: string;
  label: string;
  sublabel?: string;
  value: number; // 0-100
  color?: string;
}

/** Horizontal percentage bars — reflows naturally on narrow screens. */
export function HBarChart({
  data,
  emptyLabel = "No data available yet.",
  valueSuffix = "%",
}: {
  data: HBarDatum[];
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.id} className="space-y-1">
          <div className="flex justify-between items-baseline gap-2 text-xs">
            <span className="font-bold text-[#0F172A] truncate">{d.label}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              {d.sublabel && <span className="text-[9px] text-[#475569] font-medium">{d.sublabel}</span>}
              <span className="font-black" style={{ color: d.color || "var(--primary)" }}>
                {Math.round(d.value)}
                {valueSuffix}
              </span>
            </span>
          </div>
          <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, d.value))}%`,
                backgroundColor: d.color || "var(--primary)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface VBarDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
}

/** Vertical column chart. Scrolls horizontally on very small screens instead of squashing labels. */
export function VBarChart({
  data,
  emptyLabel = "No data available yet.",
  formatValue = (v: number) => `${v}`,
}: {
  data: VBarDatum[];
  emptyLabel?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-end gap-4 sm:gap-6 h-44 min-w-max px-2">
        {data.map((d) => {
          const heightPct = Math.max(3, Math.round((d.value / max) * 100));
          return (
            <div key={d.id} className="flex flex-col items-center gap-2 w-14 shrink-0">
              <span className="text-[10px] font-black text-[#0F172A]">{formatValue(d.value)}</span>
              <div className="w-full h-32 flex items-end bg-slate-50 rounded-lg overflow-hidden border border-[#E2E8F0]">
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: d.color || "var(--primary)",
                  }}
                />
              </div>
              <span className="text-[9px] font-bold text-[#475569] text-center leading-tight break-words max-w-[3.5rem]">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface DonutDatum {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** Donut chart with a centered total and a legend. */
export function DonutChart({
  data,
  centerLabel,
  size = 140,
  strokeWidth = 20,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            data.map((d) => {
              const pct = d.value / total;
              const dash = pct * circumference;
              const gap = circumference - dash;
              const offset = -cumulative * circumference;
              cumulative += pct;
              if (d.value <= 0) return null;
              return (
                <circle
                  key={d.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-[#0F172A]">{total}</span>
          {centerLabel && <span className="text-[9px] font-bold text-[#475569] uppercase tracking-wide">{centerLabel}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto">
        {data.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="font-semibold text-[#0F172A]">{d.label}</span>
            </div>
            <span className="font-black text-[#475569]">
              {d.value} {total > 0 && <span className="text-[9px] font-medium">({Math.round((d.value / total) * 100)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sublabel,
  color = "var(--primary)",
  progressPct,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  progressPct?: number;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-2xl shadow-sm min-w-0">
      <span className="text-[9px] sm:text-[10px] font-bold text-[#475569] uppercase block tracking-wider truncate">{label}</span>
      <div className="text-xl sm:text-2xl font-black mt-1 truncate" style={{ color }}>
        {value}
      </div>
      {typeof progressPct === "number" ? (
        <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, backgroundColor: color }} />
        </div>
      ) : (
        sublabel && <div className="text-[9px] text-[#475569] mt-2">{sublabel}</div>
      )}
    </div>
  );
}
