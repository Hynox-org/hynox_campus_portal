"use client";

import { useState } from "react";
import { sharedSignIn } from "./actions";

export default function SharedLoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <h1 className="text-xl font-bold">Hynox Campus</h1>
        <p className="mt-2 mb-8 text-sm text-slate-400">Super Admin Login</p>
        <form className="space-y-5" onSubmit={async event => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            const result = await sharedSignIn(formData);
            if (result.error) setError(result.error);
            else window.location.assign("/super-admin-login/dashboards");
          } catch {
            setError("Unable to sign in. Please try again.");
          } finally { setPending(false); }
        }}>
          <label className="block text-sm">Email
            <input type="email" name="email" autoComplete="username" required className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 outline-none focus:border-blue-400" />
          </label>
          <label className="block text-sm">Password
            <input type="password" name="password" autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 outline-none focus:border-blue-400" />
          </label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button disabled={pending} className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50 cursor-pointer">{pending ? "Signing in..." : "Sign In"}</button>
        </form>
      </section>
    </main>
  );
}
