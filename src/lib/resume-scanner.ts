export const CHECKER_VERSION = "1.0";
export interface Finding { id: string; category: "readability" | "content" | "writing"; passed: boolean; title: string; detail: string; section: string }
export interface ScanReport { checkerVersion: string; readiness: number; match: number | null; matched: string[]; missing: string[]; findings: Finding[]; wordCount: number; pageCount: number | null; source: "pdf" | "builder" | "text" }
export interface ScanRecord { id: string; resume_id: string | null; resume_version: number | null; label: string; report: ScanReport; created_at: string }
// shortcut: a curated vocabulary and exact phrase matching, replace with evaluated semantic matching if student feedback warrants it.
const SKILLS = ["JavaScript", "TypeScript", "Java", "Python", "C++", "C#", "SQL", "React", "Next.js", "Node.js", "HTML", "CSS", "Git", "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "PostgreSQL", "MySQL", "MongoDB", "REST", "GraphQL", "Flutter", "Dart", "Excel", "Power BI", "Tableau", "Figma", "AutoCAD", "SolidWorks", "MATLAB", "TensorFlow", "PyTorch", "machine learning", "data analysis", "data visualization", "project management", "communication", "teamwork", "leadership", "problem solving", "customer service", "digital marketing", "SEO", "accounting", "financial analysis", "bookkeeping", "sales", "research", "writing", "statistics", "Linux", "testing", "Agile"];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const containsTerm = (text: string, term: string) => new RegExp(`(^|[^\\p{L}\\p{N}_])${escape(term)}(?=$|[^\\p{L}\\p{N}_+#])`, "iu").test(text);
export function analyzeResume(raw: string, job = "", source: ScanReport["source"] = "text", pages: number | null = null): ScanReport {
  if (typeof raw !== "string" || raw.length > 150000 || typeof job !== "string" || job.length > 20000) throw new Error("Resume or job description exceeds the supported length.");
  const text = raw.normalize("NFKC").replace(/\r/g, "");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const findings: Finding[] = [];
  const check = (id: string, category: Finding["category"], passed: boolean, title: string, detail: string, section = "basics") => findings.push({ id, category, passed, title, detail, section });
  check("text", "readability", words.length >= 40, "Readable text", "Include at least 40 words of selectable text. Image-only PDFs need OCR before they can be checked.");
  check("email", "content", /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text), "Contact email", "Include a valid contact email near the top.");
  const hasPhone = (text.match(/\+?\d[\d ()-]{7,}\d/g) || []).some(value => { const digits = value.replace(/\D/g, "").length; return digits >= 10 && digits <= 15; });
  check("phone", "content", hasPhone, "Contact phone", "Include a phone number so recruiters can contact you.");
  const heading = (re: RegExp) => text.split("\n").some(line => re.test(line.trim()));
  check("education", "content", heading(/^(education|academic background|qualifications)\s*:?$/i), "Education heading", "Use a clear Education heading and list your qualification and institution.", "education");
  check("skills", "content", heading(/^(technical skills|skills|core competencies)\s*:?$/i), "Skills heading", "Add a Skills section with skills you can demonstrate.", "skills");
  check("evidence", "content", heading(/^(projects|experience|work experience|internships|volunteering)\s*:?$/i), "Projects or experience", "Freshers can include academic or personal projects instead of employment.", "projects");
  check("length", "readability", words.length >= 150 && words.length <= 1000, "Focused length", "Aim for roughly 150–1,000 words; this is guidance, not an employer requirement.");
  check("dates", "content", /\b(?:19|20)\d{2}\b/.test(text), "Dates present", "Include clear dates for education, projects, and experience.", "education");
  check("actions", "writing", /\b(built|created|designed|developed|implemented|analyzed|analysed|led|organized|organised|improved|managed|researched|delivered|tested|supported|maintained|collaborated|wrote)\b/i.test(text), "Specific contributions", "Describe what you built, researched, improved, or contributed. Use only truthful claims.", "projects");
  check("results", "writing", /\b\d+(?:\.\d+)?\s*(?:%|users|students|customers|hours|days|records|participants|tests|members|projects)\b/i.test(text), "Evidence of impact", "Where relevant, add real scope or results, such as participants supported or tests written. Do not invent numbers.", "projects");
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 35);
  check("repetition", "writing", new Set(lines.map(l => l.toLowerCase())).size === lines.length, "Distinct descriptions", "Remove repeated descriptions and give each entry its own contribution.", "projects");
  check("characters", "readability", (text.match(/\uFFFD/g)?.length || 0) < 3, "Text extraction quality", "Some characters could not be read. Export a new text-based PDF and check the extracted text.");
  if (pages !== null) check("pages", "readability", pages <= 2, "Page count", "For an early-career resume, one or two pages is usually easier to review.");
  const requested = job.trim() ? SKILLS.filter(s => containsTerm(job, s)) : [];
  const matched = requested.filter(s => containsTerm(text, s));
  const missing = requested.filter(s => !containsTerm(text, s));
  return { checkerVersion: CHECKER_VERSION, readiness: Math.round(100 * findings.filter(f => f.passed).length / findings.length), match: requested.length ? Math.round(matched.length / requested.length * 100) : null, matched, missing, findings, wordCount: words.length, pageCount: pages, source };
}
