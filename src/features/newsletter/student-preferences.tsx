"use client";

import { useEffect, useState } from "react";
import { loadStudentNewsletter, saveStudentNewsletter } from "./actions";

type StudentData = NonNullable<Awaited<ReturnType<typeof loadStudentNewsletter>>["data"]>;

export default function StudentNewsletterPreferences() {
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    let active = true;
    void loadStudentNewsletter().then(result => { if (active) { if (result.data) { setData(result.data); setConsent(result.data.preference?.enabled || false); } else setError(result.error || "Unable to load preferences."); } }).catch(() => { if (active) setError("Unable to load preferences. Refresh and try again."); });
    return () => { active = false; };
  }, []);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveStudentNewsletter(consent);
      if (result.error) setError(result.error);
      else { setMessage(consent ? "Subscribed. Your enrolled courses will determine your daily news." : "Newsletter emails are turned off."); const updated = await loadStudentNewsletter(); if (updated.data) setData(updated.data); }
    } catch { setError("Unable to save. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold">Your daily field update</h1><p className="mt-3 text-sm text-[#C2C6D1]">A short email with recent news related to your active courses. New enrollments are included automatically.</p></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {!data && !error && <p role="status">Loading newsletter preferences…</p>}
    {data && <>
      {data.shared && <p className="rounded-xl border border-amber-400/30 p-4 text-amber-100">Shared demonstration accounts do not receive newsletters. Sign in with your individual student account to subscribe.</p>}
      {data.preference?.suppressed_reason && <p className="text-amber-200">Email delivery is paused: {data.preference.suppressed_reason}</p>}
      <div className="rounded-2xl border border-[#343846] bg-[#171A22] p-6 space-y-5">
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={consent} disabled={data.shared || busy} onChange={event => setConsent(event.target.checked)} /><span>I want daily course-related newsletters from Hynox Campus. I can unsubscribe here or through any newsletter email.</span></label>
        <p className="text-xs leading-relaxed text-[#A3A9B6]">You receive at most one combined newsletter each day when fresh relevant stories are available. Delivery depends on available email capacity. Turning this off does not affect your account or learning notifications.</p>
        <button className="rounded-lg bg-[#6E79F4] px-5 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy || data.shared} onClick={() => void save()}>{busy ? "Saving…" : "Save preference"}</button>
        {data.preference?.last_sent_at && <p className="text-xs text-[#A3A9B6]">Last newsletter submitted for delivery: {new Date(data.preference.last_sent_at).toLocaleString()}</p>}
      </div>
      <section><h2 className="text-lg font-semibold">Your active course topics</h2><ul className="mt-3 space-y-2">{data.courses.map(course => <li key={course.course_id} className="rounded-lg border border-[#343846] p-3 text-sm">{course.title}</li>)}</ul>{!data.courses.length && <p className="mt-3 text-sm text-[#A3A9B6]">No eligible courses yet. Active course enrollments will appear here automatically.</p>}</section>
    </>}
  </div>;
}
