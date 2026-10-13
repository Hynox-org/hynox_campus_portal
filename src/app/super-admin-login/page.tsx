"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import ParticleField from "@/components/particle-field";
import { sharedSignIn } from "./actions";

export default function SharedLoginPage() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050810] text-slate-100 flex items-center justify-center p-6">
      <ParticleField />
      <section className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold">Hynox Campus</h1>
        <p className="mt-2 mb-8 text-sm text-slate-400">Super Admin Login</p>
        <form className="space-y-5" aria-busy={pending} onSubmit={async event => {
          event.preventDefault();
          if (busy.current) return;
          const formData = new FormData(event.currentTarget);
          busy.current = true;
          setPending(true);
          setError("");
          try {
            const result = await sharedSignIn(formData);
            if (result.error) {
              setError(result.error);
            } else {
              window.location.assign("/super-admin-login/dashboards");
              return;
            }
          } catch {
            setError("Unable to sign in. Please try again.");
          }
          busy.current = false;
          setPending(false);
        }}>
          <label className="block text-sm">Email
            <input type="email" name="email" autoComplete="username" required disabled={pending} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 outline-none focus:border-blue-400 disabled:opacity-50" />
          </label>
          <label className="block text-sm">Password
            <input type="password" name="password" autoComplete="current-password" required disabled={pending} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 outline-none focus:border-blue-400 disabled:opacity-50" />
          </label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-wait cursor-pointer">
            {pending && <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            {pending ? "Signing in…" : "Sign In"}
          </button>
          {pending && <p role="status" className="text-sm text-slate-400">Signing you in. Please wait…</p>}
        </form>
      </section>
    </main>
  );
}
