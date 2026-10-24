"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, GripVertical, GraduationCap, Check, Unlink } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { SECTION_KINDS, SECTION_LABELS, newEntry, safeLink, type ResumeContent, type ResumeEntry, type ResumeSection, type LearningItem, type SectionKind } from "@/lib/resume";

export const fieldClass = "w-full min-w-0 rounded-lg border border-[#303441] bg-[#0F1117] px-3 py-2.5 text-sm text-[#EDEFF5] placeholder:text-[#737C90] outline-none focus:border-[#8C91FF] focus:ring-2 focus:ring-[#6E79F4]/20";
export const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#303441] bg-[#1A1D28] px-3 py-2 text-xs font-semibold text-[#EDEFF5] hover:bg-[#25293A] focus-visible:outline-2 focus-visible:outline-[#8C91FF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
export function Field({ label, value, onChange, multiline = false, placeholder = "", maxLength = 300, id }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; maxLength?: number; id?: string }) {
  return <label className="block min-w-0 text-xs font-medium text-[#C2C6D1]">{label}
    {multiline ? <textarea id={id} className={`${fieldClass} mt-1.5 min-h-28 resize-y`} value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} placeholder={placeholder} /> : <input id={id} className={`${fieldClass} mt-1.5`} value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
  </label>;
}

function move<T>(items: T[], index: number, direction: number) { const next = [...items]; const other = index + direction; if (other < 0 || other >= next.length) return items; [next[index], next[other]] = [next[other], next[index]]; return next; }

export function ResumeEditor({ content, onChange, learning, announce, initialSection = "basics" }: { content: ResumeContent; onChange: (content: ResumeContent) => void; learning: LearningItem[]; announce: (message: string) => void; initialSection?: string }) {
  const [active, setActive] = useState(content.sections.find(s => s.kind === initialSection)?.id || "basics");
  const [newKind, setNewKind] = useState<SectionKind>("achievements");
  const section = content.sections.find(s => s.id === active);
  const changeSection = (patch: Partial<ResumeSection>) => onChange({ ...content, sections: content.sections.map(s => s.id === active ? { ...s, ...patch } : s) });
  const changeEntry = (id: string, patch: Partial<ResumeEntry>) => { if (section) changeSection({ entries: section.entries.map(e => e.id === id ? { ...e, ...patch } : e) }); };
  const sourceKeys = new Set(content.sections.flatMap(s => s.entries.flatMap(e => e.sourceKey ? [e.sourceKey] : [])));
  const addLearning = (item: LearningItem, target?: ResumeSection) => {
    if (sourceKeys.has(item.source_key)) { announce("This learning item is already included."); return; }
    let sections = [...content.sections];
    let dest = target;
    if (!dest || dest.kind !== item.kind) dest = sections.find(s => s.kind === item.kind);
    if (!dest) { if (sections.length >= 12) { announce("Remove a section before adding another."); return; } dest = { id: crypto.randomUUID(), kind: item.kind, title: SECTION_LABELS[item.kind], entries: [] }; sections = [...sections, dest]; }
    if (dest.entries.length >= 50) { announce("This section is full. Remove an entry first."); return; }
    const entry: ResumeEntry = { ...newEntry(), title: item.title, subtitle: item.subtitle, end: item.completed_at ? item.completed_at.slice(0, 7) : "", url: safeLink(item.url) ? item.url : "", sourceKey: item.source_key };
    const destId = dest.id;
    onChange({ ...content, sections: sections.map(s => s.id === destId ? { ...s, entries: [...s.entries, entry] } : s) });
    setActive(destId); announce(`${item.title} added. Describe your own learning or contribution.`);
  };
  return <div className="space-y-4">
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Resume sections">
        <button className={`${buttonClass} ${active === "basics" ? "!border-[#8C91FF] !bg-[#6E79F4]/15" : ""}`} aria-pressed={active === "basics"} onClick={() => setActive("basics")}>Your details</button>
        {content.sections.map(s => <button key={s.id} className={`${buttonClass} ${active === s.id ? "!border-[#8C91FF] !bg-[#6E79F4]/15" : ""}`} aria-pressed={active === s.id} onClick={() => setActive(s.id)}>{s.title} <span className="text-[#A3A9B6]">{s.entries.length}</span></button>)}
      </div>
      {active === "basics" ? <div id="career-basics" className="space-y-4 scroll-mt-24">
        <div><h2 className="font-semibold text-base">Start with your story</h2><p className="mt-1 text-xs text-[#A3A9B6]">These contact details belong to this resume. Your account details stay unchanged.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">{([
          ["fullName", "Full name", "Your name"], ["headline", "Headline", "Computer science student | Python & web development"], ["email", "Contact email", "you@example.com"], ["phone", "Phone", "+91 …"], ["location", "Location", "City, State"], ["website", "Portfolio", "https://…"], ["linkedin", "LinkedIn", "https://linkedin.com/in/…"], ["github", "GitHub", "https://github.com/…"],
        ] as const).map(([key, label, hint]) => <Field key={key} label={label} value={content.basics[key]} onChange={v => onChange({ ...content, basics: { ...content.basics, [key]: v } })} placeholder={hint} />)}</div>
        <Field label="Professional summary (optional)" value={content.basics.summary} maxLength={3000} multiline onChange={v => onChange({ ...content, basics: { ...content.basics, summary: v } })} placeholder="What are you studying, what have you built, and what role are you working towards?" />
      </div> : section && <div id={`career-${section.kind}`} className="space-y-4 scroll-mt-24" onDragOver={e => { if (e.dataTransfer.types.includes("application/x-hynox-learning")) e.preventDefault(); }} onDrop={e => {
        const key = e.dataTransfer.getData("application/x-hynox-learning"); const item = learning.find(l => l.source_key === key);
        if (item) { e.preventDefault(); addLearning(item, section); }
      }}>
        <div className="flex items-center gap-2"><div className="flex-1"><Field label="Section heading" value={section.title} maxLength={80} onChange={v => changeSection({ title: v })} /></div>
          <button className={`${buttonClass} mt-5 !p-2`} aria-label="Move section up" disabled={content.sections[0].id === section.id} onClick={() => onChange({ ...content, sections: move(content.sections, content.sections.indexOf(section), -1) })}><ArrowUp size={15} /></button>
          <button className={`${buttonClass} mt-5 !p-2`} aria-label="Move section down" disabled={content.sections.at(-1)?.id === section.id} onClick={() => onChange({ ...content, sections: move(content.sections, content.sections.indexOf(section), 1) })}><ArrowDown size={15} /></button>
        </div>
        {!section.entries.length && <div className="rounded-xl border border-dashed border-[#454A62] p-6 text-center text-sm text-[#A3A9B6]">Add your first entry{["courses", "projects"].includes(section.kind) ? ", or drop a learning card here" : ""}. Experience is optional for freshers.</div>}
        {section.entries.map((entry, index) => <div key={entry.id} className="rounded-xl border border-[#303441] bg-[#101219] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#C2C6D1]">{SECTION_LABELS[section.kind]} · {index + 1}</span><div className="flex gap-1">
            <button className={`${buttonClass} !p-1.5`} aria-label={`Move entry ${index + 1} up`} disabled={index === 0} onClick={() => changeSection({ entries: move(section.entries, index, -1) })}><ArrowUp size={13} /></button>
            <button className={`${buttonClass} !p-1.5`} aria-label={`Move entry ${index + 1} down`} disabled={index === section.entries.length - 1} onClick={() => changeSection({ entries: move(section.entries, index, 1) })}><ArrowDown size={13} /></button>
            <button className={`${buttonClass} !p-1.5`} aria-label={`Remove entry ${index + 1}`} onClick={() => changeSection({ entries: section.entries.filter(e => e.id !== entry.id) })}><Trash2 size={13} /></button>
          </div></div>
          {entry.sourceKey && <div className="flex items-center justify-between gap-2 text-[11px] text-[#A9B1FF]"><span>Added from your Hynox learning record</span><button type="button" className="inline-flex items-center gap-1 underline" onClick={() => changeEntry(entry.id, { sourceKey: undefined })}><Unlink size={12} /> Unlink</button></div>}
          <Field label={section.kind === "skills" ? "Skill or skill group" : section.kind === "education" ? "Qualification / degree" : "Title"} value={entry.title} maxLength={200} onChange={v => changeEntry(entry.id, { title: v })} placeholder={section.kind === "skills" ? "Python, SQL, data visualization" : "What did you study, build, or contribute?"} />
          <Field label={section.kind === "education" ? "Institution" : "Organization / context (optional)"} value={entry.subtitle} maxLength={200} onChange={v => changeEntry(entry.id, { subtitle: v })} />
          <div className="grid grid-cols-2 gap-3"><Field label="Start date (optional)" value={entry.start} maxLength={30} onChange={v => changeEntry(entry.id, { start: v })} placeholder="Aug 2024" /><Field label="End / completion date" value={entry.end} maxLength={30} onChange={v => changeEntry(entry.id, { end: v })} placeholder="May 2026 or Present" /></div>
          <Field label="Description / highlights (optional)" value={entry.description} maxLength={5000} multiline onChange={v => changeEntry(entry.id, { description: v })} placeholder="Describe your contribution. Use separate lines for highlights and include real evidence where relevant." />
          <Field label="Project / credential link (optional)" value={entry.url} maxLength={500} onChange={v => changeEntry(entry.id, { url: v })} placeholder="https://…" />
        </div>)}
        <div className="flex flex-wrap justify-between gap-2"><button className={buttonClass} disabled={section.entries.length >= 50} onClick={() => changeSection({ entries: [...section.entries, newEntry()] })}><Plus size={14} /> Add entry</button>
          <button className={`${buttonClass} !text-[#FDA4AF]`} onClick={() => { if (section.entries.length && !window.confirm(`Remove ${section.title} and its entries?`)) return; onChange({ ...content, sections: content.sections.filter(s => s.id !== section.id) }); setActive("basics"); }}><Trash2 size={13} /> Remove section</button></div>
      </div>}
      <div className="flex flex-wrap gap-2 border-t border-[#23252C] pt-4"><select aria-label="New section type" className={`${fieldClass} !w-auto !text-xs`} value={newKind} onChange={e => setNewKind(e.target.value as SectionKind)}>{SECTION_KINDS.map(k => <option key={k} value={k}>{SECTION_LABELS[k]}</option>)}</select><button className={buttonClass} disabled={content.sections.length >= 12} onClick={() => { const id = crypto.randomUUID(); onChange({ ...content, sections: [...content.sections, { id, kind: newKind, title: SECTION_LABELS[newKind], entries: [] }] }); setActive(id); }}><Plus size={14} /> Add section</button></div>
    </Card>
    <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><GraduationCap size={18} className="text-[#A9B1FF]" /><h2 className="font-semibold text-sm">From my learning</h2></div><p className="mt-2 text-xs text-[#A3A9B6]">Completed courses and approved projects. Drag a card into the editor or select Add. Your descriptions remain editable.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{learning.map(item => <div key={item.source_key} draggable={!sourceKeys.has(item.source_key)} onDragStart={e => e.dataTransfer.setData("application/x-hynox-learning", item.source_key)} className="flex items-start gap-2 rounded-xl border border-[#303441] bg-[#101219] p-3"><GripVertical size={14} className="mt-1 shrink-0 text-[#737C90]" /><div className="flex-1 min-w-0"><p className="text-xs font-semibold break-words">{item.title}</p><p className="mt-1 text-[10px] text-[#A3A9B6]">{item.kind === "courses" ? "Completed course" : "Approved project"}{item.completed_at ? ` · ${item.completed_at.slice(0, 10)}` : ""}</p></div><button className={`${buttonClass} !p-1.5`} disabled={sourceKeys.has(item.source_key)} aria-label={`Add ${item.title} to resume`} onClick={() => addLearning(item)}>{sourceKeys.has(item.source_key) ? <Check size={14} /> : <Plus size={14} />}</button></div>)}</div>
      {!learning.length && <p className="mt-4 rounded-lg bg-[#101219] p-4 text-xs text-[#C2C6D1]">No eligible learning records yet. Complete your assigned course requirements or have a project approved. You can add your own education and projects now.</p>}
    </Card>
  </div>;
}

export function ResumePreview({ content }: { content: ResumeContent; template?: "classic" | "modern" }) {
  const b = content.basics;
  return <article aria-label="Resume preview" style={{ fontFamily: '"Times New Roman", serif' }} className="bg-white text-black px-8 py-7 shadow-xl break-words min-h-[650px] text-[11px] leading-[1.2]">
    <h2 className="text-[26px] text-center mb-2">{b.fullName || "Your name"}</h2>
    <div className="text-center text-[10px]">{[b.location, b.email, b.phone].filter(Boolean).join(" | ")}{[b.linkedin, b.github, b.website].filter(Boolean).map((url, i) => <span key={i}> | <span className="text-[#0000ff] underline">{url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span></span>)}</div>
    {b.headline && <p className="text-center mt-1">{b.headline}</p>}
    {b.summary && <section className="mt-3"><h3 className="font-bold uppercase border-b border-black pb-1 mb-1.5">Summary</h3><p className="whitespace-pre-line">{b.summary}</p></section>}
    {content.sections.filter(s => s.entries.length).map(s => <section key={s.id} className="mt-3"><h3 className="font-bold uppercase border-b border-black pb-1 mb-1.5 text-xs">{s.title}</h3>{s.entries.map(e => <div key={e.id} className="mb-1.5"><div className="flex justify-between gap-3">{s.kind === "skills" || s.kind === "certifications" ? <p><strong>{e.title}{e.subtitle ? ": " : ""}</strong>{e.subtitle}</p> : <p className={`font-bold ${safeLink(e.url) ? "text-[#0000ff] underline" : ""}`}>{e.title || "Entry title"}</p>}<p className="text-[10px] font-bold text-right shrink-0">{[e.start, e.end].filter(Boolean).join(" - ")}</p></div>{e.subtitle && s.kind !== "skills" && s.kind !== "certifications" && <p>{e.subtitle}</p>}{e.description && (s.kind === "projects" || s.kind === "experience" ? <ul className="list-disc pl-8">{e.description.split("\n").filter(line => line.trim()).map((line, i) => <li className="mt-1" key={i}>{line.replace(/^[•*-]\s*/, "")}</li>)}</ul> : <p className="whitespace-pre-line">{e.description}</p>)}</div>)}</section>)}
  </article>;
}
