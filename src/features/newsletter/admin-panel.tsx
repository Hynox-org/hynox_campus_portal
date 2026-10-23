"use client";

import { useCallback, useEffect, useState } from "react";
import { loadNewsletterAdmin, saveNewsletterSettings, saveNewsletterCourse, previewNewsletterCourse, runNewsletterNow } from "./actions";
import type { NewsArticle } from "./content";

type AdminData = NonNullable<Awaited<ReturnType<typeof loadNewsletterAdmin>>["data"]>;
const inputClass = "w-full rounded-lg border border-[#343846] bg-[#10131B] px-3 py-2 text-sm";
const buttonClass = "rounded-lg border border-[#454B60] px-4 py-2 text-sm hover:bg-[#282D40] disabled:opacity-50";

export default function NewsletterAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(""); const [query, setQuery] = useState(""); const [courseEnabled, setCourseEnabled] = useState(true);
  const [preview, setPreview] = useState<{ query: string; articles: NewsArticle[]; provider: string } | null>(null);
  const load = useCallback(async (term = "") => {
    const result = await loadNewsletterAdmin(term);
    if (result.data) setData(result.data); else setError(result.error || "Unable to load newsletter status.");
  }, []);
  useEffect(() => {
    let active = true;
    void loadNewsletterAdmin().then(result => { if (active) { if (result.data) setData(result.data); else setError(result.error || "Unable to load newsletter status."); } }).catch(() => { if (active) setError("Unable to reach newsletter administration."); });
    return () => { active = false; };
  }, []);
  async function perform(operation: () => Promise<{ error?: string }>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await operation(); if (result.error) setError(result.error); else { setNotice(message); await load(search); } }
    catch { setError("Request failed. Refresh the status before retrying."); }
    finally { setBusy(false); }
  }
  const course = data?.courses.find(item => item.id === selected);
  return <div className="space-y-7">
    <div><h1 className="text-3xl font-semibold">Course newsletters</h1><p className="mt-3 text-sm text-[#C2C6D1]">Automatically discover course topics, collect free news, and send one combined edition per subscribed student.</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 p-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="text-emerald-300">{notice}</p>}
    {!data && !error && <p role="status">Loading newsletter administration…</p>}
    {data && <>
      <section className="rounded-2xl border border-[#343846] bg-[#171A22] p-6 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Delivery settings</h2><span className="text-sm">{data.subscribers} subscribed students · {data.transportConfigured ? "Worker configured" : "Transport setup required"}</span></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.settings.enabled} onChange={event => setData({ ...data, settings: { ...data.settings, enabled: event.target.checked } })} /> Enable scheduled delivery</label>
        <div className="grid gap-4 sm:grid-cols-3">{([['daily_limit','Newsletter emails / day',1,100000],['credit_reserve','Credits reserved for other emails',0,10000],['send_hour','Delivery starts at hour (IST)',0,23]] as const).map(([key,label,min,max]) => <label key={key} className="space-y-2 text-xs block"><span>{label}</span><input className={inputClass} type="number" min={min} max={max} value={data.settings[key]} onChange={event => setData({ ...data, settings: { ...data.settings, [key]: Number(event.target.value) } })} /></label>)}</div>
        <p className="text-xs leading-relaxed text-[#A3A9B6]">Free-plan defaults: 250 newsletters/day and 50 credits reserved. Brevo credits are checked before sending. Delivery continues in small batches for up to 12 hours from the selected hour. Capacity rotates toward students who have waited longest.</p>
        <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy} onClick={() => void perform(() => saveNewsletterSettings(data.settings), "Delivery settings saved.")}>Save settings</button><button className={buttonClass} disabled={busy || !data.transportConfigured} onClick={() => void perform(async () => { const result = await runNewsletterNow(); if (result.data) setNotice(`Worker: ${result.data.state}. Refresh to see new batches.`); return result; }, "Worker request completed. Check the refreshed status.")}>Run one worker cycle</button><button className={buttonClass} disabled={busy} onClick={() => void perform(async () => { await load(search); return {}; }, "Status refreshed.")}>Refresh status</button></div>
        <p className="text-xs text-[#A3A9B6]">Last worker run: {data.settings.last_run_at ? new Date(data.settings.last_run_at).toLocaleString() : "Not yet run"}</p>
        {data.settings.last_error && <p role="alert" className="text-sm text-amber-200">{data.settings.last_error}</p>}
      </section>
      <section className="rounded-2xl border border-[#343846] p-6 space-y-4">
        <h2 className="text-lg font-semibold">Course topics</h2><p className="text-xs text-[#A3A9B6]">Every new course is included automatically. Its title supplies the search topic. Override abbreviations or internal batch names with a clear field, such as “mechanical engineering” or “digital marketing”.</p>
        <form className="flex gap-3" onSubmit={event => { event.preventDefault(); void perform(async () => { await load(search); return {}; }, "Course list updated."); }}><input className={inputClass} aria-label="Search courses" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search courses (first 100 matches)" /><button className={buttonClass} disabled={busy}>Search</button></form>
        <select className={inputClass} aria-label="Select newsletter course" value={selected} onChange={event => { const current = data.courses.find(item => item.id === event.target.value); setSelected(event.target.value); setQuery(current?.query || ""); setCourseEnabled(current?.enabled ?? true); setPreview(null); }}><option value="">Choose a course</option>{data.courses.map(item => <option key={item.id} value={item.id}>{item.title} · {item.institution_id.slice(0,8)}</option>)}</select>
        {course && <><p className="text-xs text-[#A3A9B6]">Automatic topic: {course.automaticQuery || "A descriptive override is needed"}</p><label className="block text-xs space-y-2"><span>Custom topic (optional)</span><input className={inputClass} maxLength={120} value={query} onChange={event => setQuery(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={courseEnabled} onChange={event => setCourseEnabled(event.target.checked)} /> Include this course in newsletters</label><div className="flex gap-3"><button className={buttonClass} disabled={busy} onClick={() => void perform(() => saveNewsletterCourse(selected,query,courseEnabled), "Course topic saved. Changes apply to future editions.")}>Save course topic</button><button className={buttonClass} disabled={busy} onClick={() => void perform(async () => { const result = await previewNewsletterCourse(selected,query); if (result.data) setPreview(result.data); return result; }, "Preview collected. No emails were sent.")}>Preview news without sending</button></div></>}
        {preview && <div className="space-y-3"><p className="text-xs">Topic: {preview.query} · Source: {preview.provider}</p>{preview.articles.map(article => <p key={article.url}><a className="text-[#A5B4FC] underline" href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a><span className="block text-xs text-[#A3A9B6]">{article.source} · {article.publishedAt.slice(0,10)}</span></p>)}{!preview.articles.length && <p className="text-sm text-amber-200">No fresh relevant stories. Try a clearer course topic. Empty newsletters are skipped.</p>}</div>}
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Recent editions</h2>{!data.editions.length && <p className="text-sm text-[#A3A9B6]">Editions are collected when individual students subscribe and have active course enrollments.</p>}{data.editions.map(edition => <div key={`${edition.course_id}:${edition.day}`} className="rounded-lg border border-[#343846] p-4 text-sm"><p>{edition.title} · {edition.day} · {edition.state} · {edition.articles.length} stories</p><p className="text-xs text-[#A3A9B6]">Topic: {edition.query} · {edition.provider || "No source response"}</p>{edition.error && <p className="text-amber-200">{edition.error}</p>}</div>)}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Delivery batches</h2><p className="text-xs text-[#A3A9B6]">“Sent” means Brevo accepted the campaign for delivery. An “unknown” batch is held for review in Brevo to prevent an accidental duplicate.</p>{data.batches.map(batch => <div key={batch.id} className="rounded-lg border border-[#343846] p-4 text-sm"><p>{batch.day} · {batch.state} · {batch.sections.map(section => section.title).join(", ")}</p><p className="text-xs text-[#A3A9B6]">Campaign: {batch.campaign_id || "Not created"} · Attempts: {batch.attempts}</p>{batch.error && <p className="text-amber-200">{batch.error}</p>}</div>)}</section>
    </>}
  </div>;
}
