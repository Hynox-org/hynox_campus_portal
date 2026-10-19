"use server";

import { createHash } from "node:crypto";
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { requireUuid, validateResume, resumeText, type SavedResume, type LearningItem } from "@/lib/resume";
import { analyzeResume, type ScanRecord, type ScanReport } from "@/lib/resume-scanner";

async function studentContext() {
  const session = await getCurrentUser();
  if (!session?.user || session.primaryRole !== "student" || session.user.status !== "active") throw new Error("Sign in with an active student account to use Career Tools.");
  return { session, db: (await createClient()).schema("learning") };
}
function message(error: unknown) { return error instanceof Error ? error.message : "Career Tools could not complete this request. Please try again."; }

export async function loadCareerAction() {
  try {
    const { session, db } = await studentContext();
    const [resumes, scans, learning] = await Promise.all([
      db.from("student_resumes").select("id,title,template,content,version,updated_at").eq("student_id", session.user.id).order("updated_at", { ascending: false }).limit(100),
      db.from("resume_scans").select("id,resume_id,resume_version,label,report,created_at").eq("student_id", session.user.id).order("created_at", { ascending: false }).limit(50),
      db.rpc("resume_learning_items"),
    ]);
    for (const result of [resumes, scans, learning]) if (result.error) throw new Error(result.error.message);
    return { data: { resumes: resumes.data as SavedResume[], scans: scans.data as ScanRecord[], learning: learning.data as LearningItem[], shared: !!session.sharedLogin } };
  } catch (error) { return { error: message(error) }; }
}

export async function saveResumeAction(input: { id: string; title: string; template: string; content: unknown; version: number }) {
  try {
    const { session, db } = await studentContext();
    const id = requireUuid(input.id);
    if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 120) throw new Error("Give your resume a name of 1–120 characters.");
    if (!["classic", "modern"].includes(input.template) || !Number.isInteger(input.version) || input.version < 0) throw new Error("Invalid resume settings.");
    const content = validateResume(input.content);
    const row = { title: input.title.trim(), template: input.template, content, version: input.version + 1 };
    const query = input.version === 0
      ? db.from("student_resumes").insert({ ...row, id, student_id: session.user.id, tenant_id: session.tenantId })
      : db.from("student_resumes").update(row).eq("id", id).eq("student_id", session.user.id).eq("version", input.version);
    const { data, error } = await query.select("id,title,template,content,version,updated_at").maybeSingle();
    if (error?.code === "23505" || (!error && !data)) throw new Error("This resume changed in another tab. Your draft is kept here; reload the saved version or save it as a copy.");
    if (error) throw new Error(error.message);
    return { data: data as SavedResume };
  } catch (error) { return { error: message(error) }; }
}

export async function deleteResumeAction(id: string) {
  try {
    const { session, db } = await studentContext();
    const { data, error } = await db.from("student_resumes").delete().eq("id", requireUuid(id)).eq("student_id", session.user.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Resume not found or no longer available.");
    return { success: true };
  } catch (error) { return { error: message(error) }; }
}

export async function scanResumeAction(input: { resumeId?: string; text?: string; label: string; job: string; pages: number | null; source: ScanReport["source"] }) {
  try {
    const { session, db } = await studentContext();
    let text = input.text ?? "";
    let version: number | null = null;
    let id: string | null = null;
    if (input.resumeId) {
      id = requireUuid(input.resumeId);
      const result = await db.from("student_resumes").select("content,version").eq("id", id).eq("student_id", session.user.id).maybeSingle();
      if (result.error || !result.data) throw new Error("Save this resume before scanning it.");
      text = resumeText(validateResume(result.data.content)); version = result.data.version;
    }
    if (!["builder", "text", "pdf"].includes(input.source) || (input.source === "builder" && !id)) throw new Error("Invalid scan source.");
    if (input.pages !== null && (!Number.isInteger(input.pages) || input.pages < 1 || input.pages > 10)) throw new Error("Upload a PDF with no more than 10 pages.");
    if (typeof input.label !== "string" || !input.label.trim() || input.label.length > 120) throw new Error("Give this scan a name of up to 120 characters.");
    const report = analyzeResume(text, input.job, input.source, input.pages);
    const { data, error } = await db.from("resume_scans").insert({ student_id: session.user.id, tenant_id: session.tenantId, resume_id: id, resume_version: version, label: input.label.trim(), fingerprint: createHash("sha256").update(text).digest("hex"), report }).select("id,resume_id,resume_version,label,report,created_at").single();
    if (error) throw new Error(error.message);
    return { data: data as ScanRecord, extractedText: text };
  } catch (error) { return { error: message(error) }; }
}

export async function deleteScanAction(id: string) {
  try {
    const { session, db } = await studentContext();
    const { error } = await db.from("resume_scans").delete().eq("id", requireUuid(id)).eq("student_id", session.user.id);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) { return { error: message(error) }; }
}
