"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";

type ToastKind = "success" | "error";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  showSuccess: (message: string, durationMs?: number) => void;
  showError: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, durationMs = 3000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  const showSuccess = useCallback((message: string, durationMs?: number) => push("success", message, durationMs), [push]);
  const showError = useCallback((message: string, durationMs?: number) => push("error", message, durationMs), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border p-3 text-xs shadow-lg backdrop-blur-sm transition-all duration-200 ${
              t.kind === "success"
                ? "bg-[#2FBF71]/95 border-[#2FBF71] text-white"
                : "bg-[#F0555D]/95 border-[#F0555D] text-white"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-80 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
