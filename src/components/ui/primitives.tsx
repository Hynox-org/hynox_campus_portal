"use client";

import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

/* ============================================================
   Hynox "Nocturne" design-system primitives.
   Every dashboard surface should compose these instead of
   hand-rolling cards/buttons, so the app stays consistent.
   ============================================================ */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Card ---------- */
export function Card({
  className,
  interactive = false,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "bg-[#131418] border border-[#23252C] rounded-2xl shadow-card",
        interactive && "hover-lift cursor-pointer",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------- Section header ---------- */
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col sm:flex-row sm:items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/20 shrink-0">
            <Icon size={16} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#EDEFF5] tracking-tight truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#C2C6D1] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "brand" | "success" | "warning" | "error";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-[#EDEFF5]",
    brand: "text-[#6E79F4]",
    success: "text-[#2FBF71]",
    warning: "text-[#F5B04A]",
    error: "text-[#F0555D]",
  };
  return (
    <Card className={cx("p-4 sm:p-5 flex flex-col gap-2 animate-riseIn", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3A9B6]">{label}</span>
        {Icon && <Icon size={15} className="text-[#A3A9B6]" />}
      </div>
      <span className={cx("text-2xl font-bold tabular-nums tracking-tight", tones[tone])}>{value}</span>
      {hint && <span className="text-[10px] text-[#C2C6D1]">{hint}</span>}
    </Card>
  );
}

/* ---------- Badge ---------- */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "success" | "warning" | "error" | "accent";
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[#1A1C22] text-[#E2E4EB] border-[#2E313A]",
    brand: "bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/25",
    success: "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/25",
    warning: "bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/25",
    error: "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/25",
    accent: "bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/25",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Button ---------- */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-[#6E79F4] hover:bg-[#5A66F0] text-white shadow-sm",
    secondary: "bg-[#1A1C22] hover:bg-[#1F2128] text-[#EDEFF5] border border-[#2E313A]",
    ghost: "text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#1A1C22]",
    danger: "bg-[#F0555D] hover:bg-[#F0555D]/85 text-white shadow-sm",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-[11px] rounded-lg",
    md: "px-4 py-2.5 text-xs rounded-xl",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({
  value,
  tone = "brand",
  className,
}: {
  value: number; // 0..100
  tone?: "brand" | "success" | "warning" | "error" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-[#6E79F4]",
    success: "bg-[#2FBF71]",
    warning: "bg-[#F5B04A]",
    error: "bg-[#F0555D]",
    accent: "bg-[#22D3EE]",
  };
  return (
    <div className={cx("w-full h-1.5 bg-[#23252C] rounded-full overflow-hidden", className)}>
      <div
        className={cx("h-full rounded-full transition-[width] duration-500 ease-out", tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx("h-3", i % 2 ? "w-2/3" : "w-full")} />
      ))}
    </Card>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center text-center py-14 px-6 animate-fadeIn", className)}>
      <div className="w-14 h-14 rounded-2xl bg-[#1A1C22] border border-[#2E313A] flex items-center justify-center text-[#A3A9B6] mb-4">
        <Icon size={22} />
      </div>
      <h4 className="text-sm font-bold text-[#EDEFF5]">{title}</h4>
      {description && <p className="text-xs text-[#C2C6D1] mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
