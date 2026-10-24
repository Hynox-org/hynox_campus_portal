"use client";

import { useState } from "react";
import { FileSearch, Upload, CheckCircle2, AlertCircle, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { scanResumeAction, deleteScanAction } from "@/app/actions/career-actions";
import { Card } from "@/components/ui/primitives";
import type { SavedResume } from "@/lib/resume";
import type { ScanRecord } from "@/lib/resume-scanner";
import { fieldClass, buttonClass } from "./resume-editor";

export function ResumeScanner({ resumes, scans, onScans, onEdit, initialResumeId }: { resumes: SavedResume[]; scans: ScanRecord[]; onScans: (scans: ScanRecord[]) => void; onEdit: (id: string, section: string) => void; initialResumeId?: string }) {
  const [mode, setMode] = useState<"builder" | "pdf" | "text">(initialResumeId || resumes.length ? "builder" : "pdf");
  const [resumeId, setResumeId] = useState(initialResumeId || resumes[0]?.id || "");
  const [text, setText] = useState(""); const [pages, setPages] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [label, setLabel] = useState(""); const [job, setJob] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [report, setReport] = useState<ScanRecord | null>(null); const [extracted, setExtracted] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  async function loadPdf(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError(""); setReport(null); setText(""); setPages(null); setLabel("");
    try { const { readResumePdf } = await import("@/lib/read-resume-pdf"); const result = await readResumePdf(file); setText(result.text); setPages(result.pages); setLabel(file.name.slice(0, 120)); }
    catch (e) { setError(e instanceof Error ? e.message : "The PDF could not be read. Export a new PDF or paste its text."); }
    finally { setBusy(false); }
  }
  async function scan() {
    setError(""); setBusy(true);
    try {
      const selected = resumes.find(r => r.id === resumeId);
      const result = await scanResumeAction({ resumeId: mode === "builder" ? resumeId : undefined, text: mode === "builder" ? undefined : text, label: mode === "builder" ? selected?.title || "Resume" : label || "Pasted resume", job, role, pages: mode === "pdf" ? pages : null, source: mode });
      if (result.error || !result.data) throw new Error(result.error || "Scan failed.");
      setReport(result.data); setExtracted(result.extractedText || ""); onScans([result.data, ...scans].slice(0, 50));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to scan. Please try again."); }
    finally { setBusy(false); }
  }
  async function removeScan(id: string) {
    setDeleting(id);
    try {
      const result = await deleteScanAction(id);
      if (result.error) setError(result.error); else { onScans(scans.filter(s => s.id !== id)); if (report?.id === id) setReport(null); }
    } catch { setError("Unable to delete this report. Check your connection and try again."); }
    finally { setDeleting(null); }
  }
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0 space-y-5"><Card className="p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3"><FileSearch className="text-[#A9B1FF]" size={24} /><div><h2 className="text-lg font-semibold">Make your resume easier to read</h2><p className="text-xs text-[#A3A9B6] mt-1">Practical checks, explained clearly. No paid API and no external AI service.</p></div></div>
      <div className="flex flex-wrap gap-2">{([['builder', 'Saved resume'], ['pdf', 'Upload PDF'], ['text', 'Paste text']] as const).map(([value, title]) => <button key={value} className={`${buttonClass} ${mode === value ? "!border-[#8C91FF] !bg-[#6E79F4]/15" : ""}`} aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setReport(null); setError(""); setText(""); setPages(null); setLabel(""); }}>{title}</button>)}</div>
      {mode === "builder" && <label className="block text-xs text-[#C2C6D1]">Choose a saved resume<select className={`${fieldClass} mt-2`} value={resumeId} onChange={e => setResumeId(e.target.value)}><option value="">Select a resume</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.title} · version {r.version}</option>)}</select>{!resumes.length && <span className="block mt-2">Create and save a resume in the Builder first.</span>}</label>}
      {mode === "pdf" && <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void loadPdf(e.dataTransfer.files[0]); }} className="rounded-xl border border-dashed border-[#555C7D] bg-[#6E79F4]/5 p-7 text-center"><Upload className="mx-auto text-[#A9B1FF]" size={28} /><p className="mt-3 text-sm font-medium">Drop your resume PDF here</p><p className="mt-1 text-xs text-[#A3A9B6]">Text-based PDF · up to 5 MB and 10 pages</p><label className={`${buttonClass} mt-4`}>Choose PDF<input aria-label="Upload resume PDF" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={e => { void loadPdf(e.target.files?.[0]); e.target.value = ""; }} /></label>{label && <p className="mt-3 text-xs text-[#B8C0FF]">{label} · {pages} page(s) · ready to scan</p>}</div>}
      {mode === "text" && <label className="block text-xs text-[#C2C6D1]">Resume text<textarea className={`${fieldClass} mt-2 min-h-56`} maxLength={150000} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your resume, keeping headings on separate lines." /></label>}
      {mode === "text" && <label className="block text-xs text-[#C2C6D1]">Report name<input className={`${fieldClass} mt-2`} maxLength={120} value={label} onChange={e => setLabel(e.target.value)} placeholder="My resume review" /></label>}
      <label className="block text-xs text-[#C2C6D1]">Role <span className="text-[#8D96AA]">(optional)</span><input className={`${fieldClass} mt-2`} value={role} maxLength={200} onChange={e => setRole(e.target.value)} placeholder="e.g. Frontend Developer or Data Analyst" /></label>
      <label className="block text-xs text-[#C2C6D1]">Target job description <span className="text-[#8D96AA]">(optional)</span><textarea className={`${fieldClass} mt-2 min-h-32`} value={job} maxLength={20000} onChange={e => setJob(e.target.value)} placeholder="Paste a job description to compare recognized skills and terms." /></label>
      <p className="text-[11px] text-[#A3A9B6] leading-relaxed">The report is saved to your account. Uploaded PDFs are read in your browser; extracted text is sent to Hynox for checking. The original file, raw text, role, and job description are not stored. Scores are guidance, not a hiring prediction.</p>
      <button className={`${buttonClass} !bg-[#6E79F4] !border-[#6E79F4] !text-white !px-5 !py-3`} disabled={busy || (mode === "builder" ? !resumeId : !text.trim())} onClick={() => void scan()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} {busy ? "Reading / checking…" : "Scan and save report"}</button>
      {error && <p role="alert" className="rounded-lg bg-red-950/40 border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
    </Card>
    {report && <Card className="p-5 sm:p-6 space-y-5" aria-label="Resume scan report">
      <div><h2 className="text-lg font-semibold">{report.label}</h2><p className="mt-1 text-xs text-[#A3A9B6]">{new Date(report.created_at).toLocaleString()} · Checker {report.report.checkerVersion}{report.resume_version ? ` · Resume version ${report.resume_version}` : ""}</p></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#6E79F4]/30 bg-[#6E79F4]/10 p-5"><p className="text-xs text-[#C2C6D1]">Readiness checks passed</p><p className="text-4xl font-bold mt-2 text-[#B8BDFF]">{report.report.readiness}<span className="text-sm text-[#A3A9B6]"> / 100</span></p><p className="mt-2 text-[11px] text-[#A3A9B6]">{report.report.wordCount} words{report.report.pageCount !== null ? ` · ${report.report.pageCount} page(s)` : ""}</p></div>
        <div className="rounded-xl border border-[#303441] bg-[#101219] p-5"><p className="text-xs text-[#C2C6D1]">Target terms matched</p><p className="text-4xl font-bold mt-2">{report.report.match === null ? "—" : `${report.report.match}%`}</p><p className="mt-2 text-[11px] text-[#A3A9B6]">{report.report.match === null ? "Add a role or job description with recognized terms to get a match result." : `${report.report.matched.length} of ${report.report.matched.length + report.report.missing.length} recognized terms. This is exact term matching, not semantic assessment.`}</p></div></div>
      {!!report.report.matched.length && <div><h3 className="text-xs font-semibold mb-2">Found in your resume</h3><div className="flex flex-wrap gap-2">{report.report.matched.map(term => <span key={term} className="rounded-full bg-emerald-500/10 border border-emerald-400/20 px-3 py-1 text-xs text-emerald-200">{term}</span>)}</div></div>}
      {!!report.report.missing.length && <div><h3 className="text-xs font-semibold mb-2">Not found — add only if true to your experience</h3><div className="flex flex-wrap gap-2">{report.report.missing.map(term => <span key={term} className="rounded-full bg-amber-500/10 border border-amber-400/20 px-3 py-1 text-xs text-amber-200">{term}</span>)}</div></div>}
      <div className="space-y-2">{[...report.report.findings].sort((a, b) => Number(a.passed) - Number(b.passed)).map(f => <div key={f.id} className="flex gap-3 rounded-xl border border-[#303441] p-3"><span className="mt-0.5 shrink-0">{f.passed ? <CheckCircle2 size={17} className="text-emerald-400" /> : <AlertCircle size={17} className="text-amber-300" />}</span><div className="flex-1"><p className="text-sm font-medium">{f.title} <span className="text-[10px] text-[#A3A9B6]">· {f.category}</span></p>{!f.passed && <p className="mt-1 text-xs text-[#C2C6D1]">{f.detail}</p>}</div>{!f.passed && report.resume_id && resumes.some(r => r.id === report.resume_id) && <button className={`${buttonClass} !p-2 self-center`} aria-label={`Edit resume: ${f.title}`} onClick={() => onEdit(report.resume_id!, f.section)}><ArrowRight size={15} /></button>}</div>)}</div>
      {report.resume_id && resumes.find(r => r.id === report.resume_id)?.version !== report.resume_version && <p className="text-xs text-amber-200">This report belongs to an older resume version. Scan the latest saved version after editing.</p>}
      {extracted && <details><summary className="cursor-pointer text-sm text-[#B8BDFF]">See the extracted text</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#0B0C0F] p-4 text-xs text-[#C2C6D1]">{extracted}</pre></details>}
      <p className="text-[11px] text-[#A3A9B6]">Layout checks are limited to extractable text and page count. Inspect the exported PDF yourself; this tool does not simulate every employer’s ATS.</p>
    </Card>}
    </div>
    <Card className="p-4"><h2 className="font-semibold text-sm">Recent reports</h2><p className="mt-1 text-[11px] text-[#A3A9B6]">Your latest 50 scans. Raw documents are not retained.</p><div className="mt-4 space-y-2">{scans.map(scan => <div key={scan.id} className="rounded-lg border border-[#303441] p-3 flex gap-2"><button className="flex-1 text-left min-w-0 cursor-pointer" onClick={() => { setReport(scan); setExtracted(""); }}><p className="text-xs font-medium break-words">{scan.label}</p><p className="text-[10px] text-[#A3A9B6] mt-1">{new Date(scan.created_at).toLocaleDateString()} · {scan.report.readiness}/100</p></button><button aria-label={`Delete report ${scan.label}`} className={`${buttonClass} !p-1.5 self-start`} disabled={!!deleting} onClick={() => { if (window.confirm("Delete this saved report?")) void removeScan(scan.id); }}><Trash2 size={13} /></button></div>)}</div>{!scans.length && <p className="mt-4 text-xs text-[#A3A9B6]">Your first report will appear here.</p>}</Card>
  </div>;
}

