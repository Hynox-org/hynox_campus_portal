"use client";

import React, { useRef, useState, useSyncExternalStore } from "react";
import { signInWithGoogle } from "@/app/actions/auth-actions";
import { Terminal, ShieldCheck, AlertCircle } from "lucide-react";
import ParticleField from "@/components/particle-field";

const subscribeToNavigation = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
const callbackErrors: Record<string, string> = {
  AccountMismatch: "This account cannot be linked. Please contact your campus administrator.",
  AccountUnavailable: "This account is unavailable. Please contact your campus administrator.",
  OAuthExchangeFailed: "Google authentication failed. Please try again.",
};
const GoogleIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );


export default function LoginPage() {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const search = useSyncExternalStore(subscribeToNavigation, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  const displayError = errorMessage || (!loading ? callbackErrors[params.get("error") || ""] : "");
  const successMessage = params.get("message") === "AlreadyActivated"
    ? "Your account is already activated. Please sign in with Google directly." : "";

  const handleGoogleSignIn = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await signInWithGoogle("/");
      if (res?.error) {
        setErrorMessage(res.error);
        busy.current = false; setLoading(false);
      } else if (res?.url) {
        window.location.href = res.url;
      } else {
        setErrorMessage("Failed to get Google Sign-In redirect URL.");
        busy.current = false; setLoading(false);
      }
    } catch {
      setErrorMessage("Unable to start Google sign-in. Please try again.");
      busy.current = false; setLoading(false);
    }
  };


  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 text-slate-100 overflow-hidden bg-[#050810]">
      <ParticleField />

      <div className="relative z-10 max-w-md w-full bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl p-8 shadow-2xl shadow-black/50">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-400/20 mb-3">
            <Terminal size={22} className="stroke-[2.5]" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white">Hynox Campus</h2>
          <p className="text-xs text-slate-400 mt-1">Platform Authentication Portal</p>
        </div>

        {/* Alert Messages */}
        {displayError && (
          <div role="alert" className="mb-4 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {successMessage && (
          <div role="status" className="mb-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Content */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-busy={loading}
            className="w-full bg-white hover:bg-slate-200 border border-white/10 text-slate-900 text-xs font-semibold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 duration-200 cursor-pointer"
          >
            <GoogleIcon />
            {loading ? "Initializing..." : "Sign In with Google"}
          </button>

          <p className="text-[10px] text-center text-slate-500">
            OAuth authentication automatically signs you in or sets up your campus profile.
          </p>
        </div>

      </div>
    </div>
  );
}
