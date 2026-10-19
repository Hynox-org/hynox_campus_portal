"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, FileSearch, Plus, Copy, Trash2, Download, Save, Loader2, CheckCircle2, Eye, Pencil, Sparkles, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { emptyResume, validateResume, type SavedResume, type LearningItem } from "@/lib/resume";
import type { ScanRecord } from "@/lib/resume-scanner";
import { loadCareerAction, saveResumeAction, deleteResumeAction } from "@/app/actions/career-actions";
import { ResumeEditor, ResumePreview, Field, buttonClass, fieldClass } from "./resume-editor";
import { ResumeScanner } from "./resume-scanner";

export type CareerView = "resumes" | "builder" | "scanner";
type SaveStatus = "saved" | "unsaved" | "saving" | "error";
const signature = (r: SavedResume) => JSON.stringify([r.title, r.template, r.content]);

export default function CareerWorkspace({ studentId, fullName, email, view, onViewChange: setView }: { studentId: string; fullName: string; email: string; view: CareerView; onViewChange: (view: CareerView) => void }) {
  const initialView = useRef(view);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]); const [learning, setLearning] = useState<LearningItem[]>([]);
  const [draft, setDraft] = useState<SavedResume | null>(null); const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(""); const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved"); const [notice, setNotice] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false); const [exporting, setExporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedResume | null>(null); const [deleting, setDeleting] = useState(false);
  const [scannerId, setScannerId] = useState<string | undefined>();
  const [focusSection, setFocusSection] = useState("basics");
  const draftRef = useRef<SavedResume | null>(null); const saved = useRef<Record<string, string>>({});
  const inFlight = useRef<Promise<SavedResume | null> | null>(null); const failed = useRef(""); const conflict = useRef(false);
  const storageKey = `hynox-resume-draft:${studentId}`;
  const announce = useCallback((text: string) => setNotice(text), []);
  const setCurrent = useCallback((value: SavedResume | null) => { draftRef.current = value; setDraft(value); }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    let response: Awaited<ReturnType<typeof loadCareerAction>>;
    try { response = await loadCareerAction(); }
    catch { setLoadError("Unable to reach Career Tools. Check your connection and try again."); setLoading(false); return; }
    if (!response.data) { setLoadError(response.error || "Unable to load Career Tools."); setLoading(false); return; }
    setResumes(response.data.resumes); setScans(response.data.scans); setLearning(response.data.learning); setShared(response.data.shared);
    for (const r of response.data.resumes) saved.current[r.id] = signature(r);
    const requested = initialView.current;
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const recovered = JSON.parse(cached) as SavedResume;
        validateResume(recovered.content);
        if (!/^[0-9a-f-]{36}$/i.test(recovered.id) || typeof recovered.title !== "string" || !Number.isInteger(recovered.version) || !["classic", "modern"].includes(recovered.template)) throw new Error("Invalid local draft");
        const persisted = response.data.resumes.find(r => r.id === recovered.id);
        if (!persisted || signature(persisted) !== signature(recovered)) {
          conflict.current = !!recovered.version && (!persisted || persisted.version !== recovered.version);
          setCurrent(recovered); setSaveStatus(conflict.current ? "error" : "unsaved"); setView("builder");
          if (conflict.current) setError("Recovered an unsaved draft, but its saved version changed. Save as a copy to keep your edits, or reload the saved version.");
          announce("Recovered your unfinished resume draft from this browser tab.");
        } else if (requested === "builder") { setCurrent(persisted); setView("builder"); }
      } else if (requested === "builder" && response.data.resumes.length) { setCurrent(response.data.resumes[0]); setView("builder"); }
    } catch { sessionStorage.removeItem(storageKey); }
    setLoading(false);
  }, [storageKey, setCurrent, announce, setView]);
  useEffect(() => { void load(); }, [load]);

  const persist = useCallback(async function persist(manual = false): Promise<SavedResume | null> {
    if (inFlight.current) { await inFlight.current; return persist(manual); }
    const current = draftRef.current;
    if (!current) return null;
    const stamp = signature(current);
    if (saved.current[current.id] === stamp) return current;
    if (conflict.current || (!manual && failed.current === stamp)) return null;
    setSaveStatus("saving");
    const operation = (async () => {
      try {
        const result = await saveResumeAction(current);
        if (!result.data) throw new Error(result.error || "Save failed.");
        const updated = result.data; saved.current[updated.id] = signature(updated); failed.current = "";
        setResumes(rows => [updated, ...rows.filter(r => r.id !== updated.id)]);
        const latest = draftRef.current;
        if (latest?.id === updated.id) {
          // Adopt server normalization only if the student has not edited while saving.
          const merged = signature(latest) === stamp ? updated : { ...latest, version: updated.version, updated_at: updated.updated_at };
          setCurrent(merged);
          const clean = signature(merged) === signature(updated);
          setSaveStatus(clean ? "saved" : "unsaved");
          try { if (clean) sessionStorage.removeItem(storageKey); else sessionStorage.setItem(storageKey, JSON.stringify(merged)); } catch { /* Server save remains authoritative when browser storage is unavailable. */ }
        }
        setError(""); return updated;
      } catch (e) {
        failed.current = stamp;
        const msg = e instanceof Error ? e.message : "Unable to save. Your draft remains in this tab.";
        if (/another tab|reload.*saved version/i.test(msg)) conflict.current = true;
        setSaveStatus("error"); setError(msg); return null;
      }
    })();
    inFlight.current = operation;
    let result: SavedResume | null;
    try { result = await operation; } finally { inFlight.current = null; }
    const latest = draftRef.current;
    if (result && latest?.id === result.id && saved.current[latest.id] !== signature(latest)) return persist(manual);
    return result;
  }, [setCurrent, storageKey]);

  useEffect(() => {
    if (!draft || loading) return;
    if (saved.current[draft.id] === signature(draft)) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Autosave still works without browser storage. */ }
    const timer = setTimeout(() => { void persist(); }, 1100);
    return () => clearTimeout(timer);
  }, [draft, loading, storageKey, persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { const current = draftRef.current; if (current && saved.current[current.id] !== signature(current)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function edit(next: SavedResume) { failed.current = ""; setCurrent(next); setSaveStatus("unsaved"); }
  async function switchView(next: CareerView) {
    if (draftRef.current && saved.current[draftRef.current.id] !== signature(draftRef.current)) { if (!await persist(true)) return; }
    setView(next);
  }
  async function create(copy?: SavedResume, keepCurrent = false) {
    if (resumes.length >= 100) { setError("You have 100 resumes. Delete an unused version before creating another."); return; }
    if (!keepCurrent && draftRef.current && saved.current[draftRef.current.id] !== signature(draftRef.current) && !await persist(true)) return;
    const next: SavedResume = { id: crypto.randomUUID(), title: copy ? `${copy.title.slice(0, 112)} (copy)` : "My first resume", template: copy?.template || "classic", content: copy ? structuredClone(copy.content) : emptyResume(fullName, email), version: 0, updated_at: new Date().toISOString() };
    conflict.current = false; failed.current = ""; setError(""); edit(next); setView("builder"); setMobilePreview(false);
  }
  async function open(resume: SavedResume) {
    if (draftRef.current && draftRef.current.id !== resume.id && saved.current[draftRef.current.id] !== signature(draftRef.current) && !await persist(true)) return;
    conflict.current = false; setCurrent(resume); setSaveStatus("saved"); setError(""); setView("builder");
  }
  async function download() {
    setExporting(true); setError("");
    try {
      const result = await persist(true); if (!result) return;
      const { makeResumePdf } = await import("./resume-pdf");
      const blob = await makeResumePdf(result.content, result.template);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${result.title.replace(/[^\p{L}\p{N} -]/gu, "").trim() || "resume"}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      announce("Your resume PDF is ready. Check its pages before applying.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate this PDF. Please try again."); }
    finally { setExporting(false); }
  }
  async function scanCurrent() { const result = await persist(true); if (!result) return; setScannerId(result.id); await switchView("scanner"); }
  async function remove() {
    if (!pendingDelete) return; setDeleting(true);
    let result: Awaited<ReturnType<typeof deleteResumeAction>>;
    try { result = await deleteResumeAction(pendingDelete.id); }
    catch { setError("Unable to delete this resume. Check your connection and try again."); setDeleting(false); return; }
    if (result.error) setError(result.error);
    else {
      setResumes(rows => rows.filter(r => r.id !== pendingDelete.id));
      setScans(rows => rows.map(s => s.resume_id === pendingDelete.id ? { ...s, resume_id: null } : s));
      if (draftRef.current?.id === pendingDelete.id) { setCurrent(null); sessionStorage.removeItem(storageKey); setView("resumes"); }
      announce("Resume deleted. Its past scan reports remain in your history.");
    }
    setPendingDelete(null); setDeleting(false);
  }
  function reloadSaved() {
    const current = draftRef.current; const persisted = resumes.find(r => r.id === current?.id);
    if (!window.confirm("Discard the unsaved draft and load the saved version?")) return;
    conflict.current = false; failed.current = ""; setCurrent(persisted || null); sessionStorage.removeItem(storageKey); setError(""); setSaveStatus("saved"); if (!persisted) setView("resumes");
    // Refresh first: the list may predate a save made in another tab.
    void loadCareerAction().then(result => { if (result.data) { setResumes(result.data.resumes); const latest = result.data.resumes.find(r => r.id === current?.id); if (latest) { saved.current[latest.id] = signature(latest); setCurrent(latest); } } }).catch(() => setError("Unable to reload the saved version. Check your connection and try again."));
  }
  const completedBasics = draft ? [draft.content.basics.fullName, draft.content.basics.email, draft.content.sections.find(s => s.kind === "education")?.entries.some(e => e.title), draft.content.sections.find(s => s.kind === "skills")?.entries.some(e => e.title), draft.content.sections.find(s => s.kind === "projects")?.entries.some(e => e.title)].filter(Boolean).length : 0;

  return <div className="space-y-5 max-w-[1600px] mx-auto w-full">
      <div className="relative overflow-hidden rounded-2xl border border-[#454A73]/50 bg-gradient-to-br from-[#252442] via-[#181B2D] to-[#11141D] p-6 sm:p-8"><div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-[#8C91FF]/10 blur-3xl" /><div className="relative flex flex-wrap justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#B8BDFF]">Learn. Build. Show your work.</p><h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3">Your next opportunity starts here.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#C2C6D1]">Turn your learning into a resume you can own. Build your story, bring in completed work, and check it before you apply.</p></div><div className="flex items-center gap-2 self-end"><button className={`${buttonClass} !bg-[#8C91FF] !border-[#8C91FF] !text-[#10121B]`} disabled={loading || !!loadError} onClick={() => void create()}><Plus size={15} /> New resume</button></div></div></div>
      {shared && <div role="note" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-100">Shared demo login: everyone using this account can see its saved resumes and reports. Use sample details here. Use your individual student login for a private resume.</div>}
      <div className="flex flex-wrap gap-2">{([['resumes', 'My Resumes', FileText], ['builder', 'Resume Builder', Pencil], ['scanner', 'ATS Resume Scanner', FileSearch]] as const).map(([id, title, Icon]) => <button key={id} disabled={loading || !!loadError} aria-pressed={view === id} className={`${buttonClass} ${view === id ? "!border-[#8C91FF] !bg-[#6E79F4]/15 !text-[#C1C5FF]" : ""}`} onClick={() => { if (id === "builder" && !draft) void create(); else void switchView(id); }}><Icon size={15} />{title}</button>)}</div>
      <div aria-live="polite" className="text-xs text-[#B8BDFF]">{notice}</div>
      {loading && <Card className="p-8 flex items-center gap-3 text-sm"><Loader2 className="animate-spin text-[#8C91FF]" size={20} /> Loading your career workspace…</Card>}
      {loadError && <Card className="p-6 space-y-3"><p role="alert" className="text-red-200">{loadError}</p><button className={buttonClass} onClick={() => void load()}>Try again</button></Card>}
      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200"><p>{error}</p>{draft && <div className="flex flex-wrap gap-2 mt-3"><button className={buttonClass} onClick={() => void persist(true)}>Retry save</button><button className={buttonClass} onClick={() => void create(draft, true)}>Save as a copy</button><button className={buttonClass} onClick={reloadSaved}>Reload saved version</button></div>}</div>}
      {!loading && !loadError && (view === "resumes" || (view === "builder" && !draft)) && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resumes.map(r => <Card key={r.id} className="p-5 flex flex-col gap-4"><div className="h-28 rounded-xl bg-gradient-to-br from-[#252842] to-[#171A26] flex items-center justify-center"><FileText size={44} className="text-[#A9B1FF]" /></div><div><h2 className="font-semibold break-words">{r.title}</h2><p className="text-[11px] text-[#A3A9B6] mt-1">{r.template === "modern" ? "Modern" : "Classic"} · version {r.version} · {new Date(r.updated_at).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2 mt-auto"><button className={buttonClass} onClick={() => void open(r)}><Pencil size={13} /> Edit</button><button className={buttonClass} onClick={() => void create(r)}><Copy size={13} /> Copy</button><button className={buttonClass} onClick={() => { setScannerId(r.id); void switchView("scanner"); }}><FileSearch size={13} /> Scan</button><button className={`${buttonClass} !text-red-200`} aria-label={`Delete resume ${r.title}`} onClick={() => setPendingDelete(r)}><Trash2 size={13} /></button></div></Card>)}
        <button className="rounded-2xl border border-dashed border-[#4E5574] min-h-72 p-8 flex flex-col items-center justify-center gap-3 text-center hover:bg-[#6E79F4]/5 cursor-pointer" onClick={() => void create()}><Plus size={32} className="text-[#A9B1FF]" /><span className="font-semibold">{resumes.length ? "Create another version" : "Build your first resume"}</span><span className="text-xs text-[#A3A9B6] max-w-60">Start with a few details. Your draft saves as you go.</span></button>
      </div>}
      {!loading && !loadError && view === "builder" && draft && <div className="space-y-4">
        <Card className="p-4 space-y-4"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]"><Field label="Resume name" maxLength={120} value={draft.title} onChange={title => edit({ ...draft, title })} /><label className="block text-xs text-[#C2C6D1]">Template<select aria-label="Resume template" className={`${fieldClass} mt-1.5`} value={draft.template} onChange={e => edit({ ...draft, template: e.target.value as SavedResume["template"] })}><option value="classic">Classic · clean & simple</option><option value="modern">Modern · subtle accent</option></select></label></div>
          <div className="flex flex-wrap justify-between gap-3 items-center"><span role="status" className={`flex items-center gap-2 text-xs ${saveStatus === "error" ? "text-red-200" : "text-[#A3A9B6]"}`}>{saveStatus === "saving" ? <Loader2 size={14} className="animate-spin" /> : saveStatus === "saved" ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertCircle size={14} />}{saveStatus === "saved" ? `Saved · version ${draft.version}` : saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved — your draft is kept in this tab" : "Unsaved changes"}</span>
          <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => void persist(true)} disabled={saveStatus === "saving"}><Save size={14} />Save</button><button className={buttonClass} disabled={saveStatus === "saving"} onClick={() => void scanCurrent()}><FileSearch size={14} />Check resume</button><button className={`${buttonClass} !bg-[#6E79F4] !border-[#6E79F4]`} disabled={exporting} onClick={() => void download()}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download PDF</button></div></div>
          <div className="flex items-center gap-3"><Sparkles size={14} className="text-[#A9B1FF]" /><div className="flex-1 h-1.5 rounded-full bg-[#25293A]"><div className="h-1.5 rounded-full bg-[#8C91FF] transition-all" style={{ width: `${completedBasics * 20}%` }} /></div><span className="text-[10px] text-[#A3A9B6]">{completedBasics}/5 starter steps</span></div><p className="text-[11px] text-[#A3A9B6]">Add your name, email, education, skills, and a project. All sections remain optional while drafting.</p>
        </Card>
        <button className={`${buttonClass} xl:hidden`} onClick={() => setMobilePreview(!mobilePreview)}>{mobilePreview ? <Pencil size={14} /> : <Eye size={14} />}{mobilePreview ? "Back to editing" : "Show preview"}</button>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]"><div className={mobilePreview ? "hidden xl:block" : ""}><ResumeEditor key={`${draft.id}:${focusSection}`} initialSection={focusSection} content={draft.content} learning={learning} announce={announce} onChange={content => edit({ ...draft, content })} /></div><div className={`${mobilePreview ? "" : "hidden xl:block"} xl:sticky xl:top-24 min-w-0`}><div className="flex justify-between text-xs text-[#A3A9B6] mb-3"><span>Live preview</span><span>PDF pagination may differ</span></div><div className="max-h-[80vh] overflow-auto rounded-lg"><ResumePreview content={draft.content} template={draft.template} /></div></div></div>
      </div>}
      {!loading && !loadError && view === "scanner" && <ResumeScanner key={scannerId || "scanner"} resumes={resumes} scans={scans} initialResumeId={scannerId} onScans={setScans} onEdit={(id, section) => { const r = resumes.find(row => row.id === id); if (r) { setFocusSection(section); void open(r).then(() => { announce(`Review ${section === "basics" ? "your details" : section} in the editor, then scan again.`); }); } }} />}
      {pendingDelete && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-labelledby="delete-resume-heading" className="rounded-2xl border border-[#454A62] bg-[#131418] p-6 max-w-md w-full space-y-4"><h2 id="delete-resume-heading" className="font-semibold">Delete “{pendingDelete.title}”?</h2><p className="text-sm text-[#C2C6D1]">This removes the saved document. Past scan reports remain available.</p><div className="flex justify-end gap-2"><button autoFocus className={buttonClass} disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button><button className={`${buttonClass} !bg-red-600 !border-red-600`} disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete resume"}</button></div></div></div>}
    </div>;
}

