export const SECTION_KINDS = ["education", "projects", "skills", "experience", "courses", "certifications", "achievements", "languages", "custom"] as const;
export type SectionKind = typeof SECTION_KINDS[number];
export interface ResumeEntry {
  id: string; title: string; subtitle: string; start: string; end: string;
  description: string; url: string; sourceKey?: string;
}
export interface ResumeSection { id: string; kind: SectionKind; title: string; entries: ResumeEntry[] }
export interface ResumeContent {
  basics: { fullName: string; headline: string; email: string; phone: string; location: string; website: string; linkedin: string; github: string; summary: string };
  sections: ResumeSection[];
}
export interface SavedResume { id: string; title: string; template: "classic" | "modern"; content: ResumeContent; version: number; updated_at: string }
export interface LearningItem { source_key: string; kind: "courses" | "projects"; title: string; subtitle: string; completed_at: string | null; url: string }
export const SECTION_LABELS: Record<SectionKind, string> = { education: "Education", projects: "Projects", skills: "Skills", experience: "Experience", courses: "Courses", certifications: "Certifications", achievements: "Achievements", languages: "Languages", custom: "Additional information" };
export const newEntry = (): ResumeEntry => ({ id: crypto.randomUUID(), title: "", subtitle: "", start: "", end: "", description: "", url: "" });
export function emptyResume(fullName = "", email = ""): ResumeContent {
  return { basics: { fullName, email, headline: "", phone: "", location: "", website: "", linkedin: "", github: "", summary: "" }, sections: ["education", "projects", "skills", "experience", "courses"].map(kind => ({ id: crypto.randomUUID(), kind: kind as SectionKind, title: SECTION_LABELS[kind as SectionKind], entries: [] })) };
}
export function safeLink(value: string): string | undefined {
  if (!value.trim()) return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) throw new Error("Invalid document identifier.");
  return value;
}
export function validateResume(value: unknown): ResumeContent {
  if (!value || typeof value !== "object" || JSON.stringify(value).length > 150000) throw new Error("Resume is too large or invalid.");
  const root = value as Record<string, unknown>;
  if (!root.basics || typeof root.basics !== "object" || !Array.isArray(root.sections) || root.sections.length > 12) throw new Error("Invalid resume sections.");
  const text = (v: unknown, max = 200) => { if (typeof v !== "string" || v.length > max || /\u0000/.test(v)) throw new Error(`Fields must contain text shorter than ${max + 1} characters.`); return v; };
  const basics = {} as ResumeContent["basics"];
  for (const key of ["fullName", "headline", "email", "phone", "location", "website", "linkedin", "github", "summary"] as const) basics[key] = text((root.basics as Record<string, unknown>)[key], key === "summary" ? 3000 : 300);
  if (basics.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basics.email)) throw new Error("Enter a valid contact email.");
  for (const key of ["website", "linkedin", "github"] as const) if (basics[key] && !safeLink(basics[key])) throw new Error("Links must start with https:// or http://.");
  const ids = new Set<string>();
  const uniqueId = (v: unknown) => { const id = requireUuid(v); if (ids.has(id)) throw new Error("Resume contains duplicate entries."); ids.add(id); return id; };
  const sections = root.sections.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid section.");
    const s = raw as Record<string, unknown>;
    if (!SECTION_KINDS.includes(s.kind as SectionKind) || !Array.isArray(s.entries) || s.entries.length > 50) throw new Error("Invalid section or too many entries.");
    return { id: uniqueId(s.id), kind: s.kind as SectionKind, title: text(s.title, 80), entries: s.entries.map((rawEntry: unknown) => {
      if (!rawEntry || typeof rawEntry !== "object") throw new Error("Invalid resume entry.");
      const e = rawEntry as Record<string, unknown>;
      const entry: ResumeEntry = { id: uniqueId(e.id), title: text(e.title), subtitle: text(e.subtitle), start: text(e.start, 30), end: text(e.end, 30), description: text(e.description, 5000), url: text(e.url, 500) };
      if (entry.url && !safeLink(entry.url)) throw new Error("Links must start with https:// or http://.");
      if (e.sourceKey !== undefined) { if (typeof e.sourceKey !== "string" || !/^(course|project):[0-9a-f-]{36}$/i.test(e.sourceKey)) throw new Error("Invalid learning reference."); entry.sourceKey = e.sourceKey; }
      return entry;
    }) };
  });
  const sourceKeys = sections.flatMap(s => s.entries.flatMap(e => e.sourceKey ? [e.sourceKey] : []));
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error("This learning item is already in your resume.");
  return { basics, sections };
}
export function resumeText(content: ResumeContent): string {
  const b = content.basics;
  return [b.fullName, b.headline, [b.email, b.phone, b.location].filter(Boolean).join(" | "), [b.website, b.linkedin, b.github].filter(Boolean).join(" | "), b.summary ? `Summary\n${b.summary}` : "", ...content.sections.filter(s => s.entries.length).map(s => `${s.title}\n${s.entries.map(e => [e.title, e.subtitle, [e.start, e.end].filter(Boolean).join(" – "), e.description, e.url].filter(Boolean).join("\n")).join("\n\n")}`)].filter(Boolean).join("\n\n");
}
