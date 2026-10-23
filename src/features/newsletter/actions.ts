"use server";

import { getCurrentUser } from "@/services/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { collectNews, courseQuery, type NewsSection } from "./content";
import type { NewsletterSecrets, NewsletterSettings } from "./engine";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Newsletter request failed."; }
function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid course.");
  return value;
}

async function context(role: "student" | "super_admin") {
  const session = await getCurrentUser();
  if (!session?.user || session.user.status !== "active" || session.primaryRole !== role) throw new Error("Sign in with an active account to continue.");
  return { session, client: createAdminClient() };
}

export async function loadNewsletterAdmin(search = "") {
  try {
    const { client } = await context("super_admin");
    const db = client.schema("learning");
    const cleaned = search.replace(/[%_,().]/g, " ").trim().slice(0, 100);
    let courseQueryBuilder = client.schema("academic").from("courses").select("id,title,description,institution_id").is("deleted_at", null).order("title").limit(100);
    if (cleaned) courseQueryBuilder = courseQueryBuilder.ilike("title", `%${cleaned}%`);
    const [settings, courses, overrides, batches, editions, subscribers, runtime] = await Promise.all([
      db.from("newsletter_settings").select("enabled,daily_limit,credit_reserve,send_hour,last_run_at,last_error,brevo_folder_id").single(),
      courseQueryBuilder,
      db.from("newsletter_courses").select("course_id,enabled,query"),
      db.from("newsletter_batches").select("id,day,state,campaign_id,attempts,error,sections,updated_at").order("created_at", { ascending: false }).limit(20),
      db.from("newsletter_editions").select("course_id,title,day,query,state,provider,error,articles").order("updated_at", { ascending: false }).limit(20),
      db.from("newsletter_preferences").select("student_id", { count: "exact", head: true }).eq("enabled", true).is("suppressed_reason", null),
      db.rpc("newsletter_runtime"),
    ]);
    for (const result of [settings,courses,overrides,batches,editions,subscribers,runtime]) if (result.error) throw new Error(result.error.message);
    const secrets = runtime.data as NewsletterSecrets;
    return { data: {
      settings: settings.data as NewsletterSettings,
      courses: (courses.data || []).map(course => ({ ...course, enabled: overrides.data?.find(item => item.course_id === course.id)?.enabled ?? true, query: overrides.data?.find(item => item.course_id === course.id)?.query || "", automaticQuery: courseQuery(course.title) })),
      batches: (batches.data || []) as { id: string; day: string; state: string; campaign_id: number | null; attempts: number; error: string | null; sections: NewsSection[]; updated_at: string }[],
      editions: (editions.data || []) as { course_id: string; title: string; day: string; query: string; state: string; provider: string | null; error: string | null; articles: NewsSection["articles"] }[],
      subscribers: subscribers.count || 0,
      transportConfigured: !!(secrets.brevo_api_key && secrets.sender_email && secrets.scheduler_token && secrets.function_url),
    } };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function saveNewsletterSettings(input: { enabled: boolean; daily_limit: number; credit_reserve: number; send_hour: number }) {
  try {
    const { client } = await context("super_admin");
    if (typeof input.enabled !== "boolean" || !Number.isInteger(input.daily_limit) || input.daily_limit < 1 || input.daily_limit > 100000 || !Number.isInteger(input.credit_reserve) || input.credit_reserve < 0 || input.credit_reserve > 10000 || !Number.isInteger(input.send_hour) || input.send_hour < 0 || input.send_hour > 23) throw new Error("Enter valid delivery settings.");
    const { error } = await client.schema("learning").from("newsletter_settings").update({ enabled: input.enabled, daily_limit: input.daily_limit, credit_reserve: input.credit_reserve, send_hour: input.send_hour }).eq("id", true);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function saveNewsletterCourse(courseId: string, query: string, enabled: boolean) {
  try {
    const { client } = await context("super_admin");
    if (typeof query !== "string" || query.length > 120 || typeof enabled !== "boolean") throw new Error("Use a topic of up to 120 characters.");
    const id = uuid(courseId);
    const { error } = await client.schema("learning").from("newsletter_courses").upsert({ course_id: id, query: query.trim(), enabled });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function previewNewsletterCourse(courseId: string, query: string) {
  try {
    const { client } = await context("super_admin");
    if (typeof query !== "string" || query.length > 120) throw new Error("Topic is too long.");
    const { data, error } = await client.schema("academic").from("courses").select("title").eq("id", uuid(courseId)).is("deleted_at", null).single();
    if (error || !data) throw new Error("Course not found.");
    const topic = courseQuery(data.title, query);
    return { data: { ...await collectNews(topic, new Set()), query: topic } };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function runNewsletterNow() {
  try {
    const { client } = await context("super_admin");
    const { data, error } = await client.schema("learning").rpc("newsletter_runtime");
    if (error) throw new Error(error.message);
    const secrets = data as NewsletterSecrets;
    if (!secrets.function_url || !secrets.scheduler_token) throw new Error("Scheduled worker is not configured.");
    const response = await fetch(secrets.function_url, { method: "POST", headers: { "x-newsletter-token": secrets.scheduler_token, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(100000) });
    if (!response.ok) throw new Error("Worker failed. Check the latest run status.");
    const result = await response.json() as { state: string; collected?: number; accepted?: number };
    return { data: result };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function loadStudentNewsletter() {
  try {
    const { client, session } = await context("student");
    const db = client.schema("learning");
    const [preference, courses] = await Promise.all([
      db.from("newsletter_preferences").select("enabled,consent_at,suppressed_reason,last_sent_at").eq("student_id", session.user.id).maybeSingle(),
      db.from("newsletter_members").select("course_id,title").eq("student_id", session.user.id).order("title"),
    ]);
    if (preference.error || courses.error) throw new Error(preference.error?.message || courses.error?.message);
    return { data: { preference: preference.data, courses: courses.data || [], shared: !!session.sharedLogin } };
  } catch (error) { return { error: errorMessage(error) }; }
}

export async function saveStudentNewsletter(enabled: boolean) {
  try {
    const { client, session } = await context("student");
    if (session.sharedLogin) throw new Error("Use your individual student account to subscribe.");
    if (typeof enabled !== "boolean") throw new Error("Invalid preference.");
    const db = client.schema("learning");
    const existing = await db.from("newsletter_preferences").select("suppressed_reason").eq("student_id", session.user.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (enabled && existing.data?.suppressed_reason) throw new Error("This address is blocked or unsubscribed in Brevo. Contact your institution to review it before subscribing again.");
    const { error } = await db.from("newsletter_preferences").upsert({ student_id: session.user.id, enabled, consent_at: enabled ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) { return { error: errorMessage(error) }; }
}
