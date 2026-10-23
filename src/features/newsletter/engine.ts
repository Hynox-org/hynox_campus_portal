import { collectNews, courseQuery, headlineKey, indiaDay, renderDigest, type NewsArticle, type NewsCourse, type NewsSection } from "./content.ts";

export interface NewsletterSettings {
  enabled: boolean;
  daily_limit: number;
  credit_reserve: number;
  send_hour: number;
  last_run_at: string | null;
  last_error: string | null;
  brevo_folder_id: number | null;
}

export interface NewsletterSecrets {
  brevo_api_key?: string;
  sender_email?: string;
  sender_name?: string;
  scheduler_token?: string;
  function_url?: string;
}

interface Member { student_id: string; email: string; full_name: string; courses: NewsCourse[] }
interface Edition { course_id: string; day: string; title: string; query: string; articles: NewsArticle[]; state: string; attempts: number; updated_at: string }
interface Batch { id: string; day: string; sections: NewsSection[]; state: string; campaign_id: number | null; list_id: number | null; attempts: number }
interface Delivery { student_id: string; email: string }

export class NewsletterHttpError extends Error {
  constructor(public status: number, service: string) { super(`${service} request failed (${status}).`); }
}

export class NewsletterDatabase {
  constructor(private url: string, private key: string, private fetcher: typeof fetch = fetch) {}

  async request<Result>(path: string, method = "GET", body?: unknown): Promise<Result> {
    const response = await this.fetcher(`${this.url}/rest/v1/${path}`, {
      method,
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, "Accept-Profile": "learning", "Content-Profile": "learning", "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new NewsletterHttpError(response.status, "Newsletter database");
    const text = await response.text();
    return text ? JSON.parse(text) as Result : undefined as Result;
  }

  rpc<Result>(name: string, args: Record<string, unknown> = {}) { return this.request<Result>(`rpc/newsletter_${name}`, "POST", args); }
}

export async function brevoRequest<Result>(key: string, path: string, method = "GET", body?: unknown, fetcher: typeof fetch = fetch): Promise<Result> {
  const response = await fetcher(`https://api.brevo.com/v3/${path}`, {
    method, headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new NewsletterHttpError(response.status, "Brevo");
  const text = await response.text();
  return text ? JSON.parse(text) as Result : undefined as Result;
}

export function availableEmailCredits(account: { plan?: { type: string; credits: number; creditsType?: string }[] }, reserve: number) {
  const plan = account.plan?.find(item => item.type === "free") || account.plan?.find(item => item.type === "subscription" || item.type === "payAsYouGo");
  if (!plan || !Number.isFinite(plan.credits) || plan.credits < 0) throw new Error("Cannot verify Brevo email credits. Sending is paused.");
  return Math.max(0, Math.floor(plan.credits) - reserve);
}

export function memberSections(member: Member, editions: Edition[]) {
  return member.courses.flatMap(course => {
    const edition = editions.find(item => item.course_id === course.id && item.state === "ready");
    return edition?.articles.length ? [{ courseId: course.id, title: course.title, articles: edition.articles }] : [];
  });
}

async function sendBatch(db: NewsletterDatabase, batch: Batch, settings: NewsletterSettings, secrets: NewsletterSecrets, deadline: number, fetcher: typeof fetch) {
  const key = secrets.brevo_api_key!;
  const brevo = <Result>(path: string, method = "GET", body?: unknown) => brevoRequest<Result>(key, path, method, body, fetcher);
  const clearList = async (listId: number) => {
    const list = await brevo<{ totalSubscribers: number; totalBlacklisted: number }>(`contacts/lists/${listId}`);
    if (list.totalSubscribers !== 0 || list.totalBlacklisted !== 0) await brevo(`contacts/lists/${listId}/contacts/remove`, "POST", { all: true });
  };
  if (batch.state === "sending" || batch.state === "unknown") {
    if (batch.campaign_id) {
      const report = await brevo<{ status: string }>(`emailCampaigns/${batch.campaign_id}`);
      if (["sent", "queued"].includes(report.status)) {
        await db.rpc("finish_batch", { p_batch: batch.id, p_state: "sent" });
        return "accepted";
      }
    }
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "unknown", p_error: "Brevo acceptance is unconfirmed. Review this campaign in Brevo; automatic resend is disabled to prevent duplicates." });
    return "unknown";
  }
  if (batch.day !== indiaDay()) {
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "cancelled", p_error: "Edition expired before sending." });
    return "expired";
  }
  if (batch.attempts >= 5) {
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "failed", p_error: "Retry limit reached. Check sender configuration and Brevo account." });
    return "failed";
  }
  const deliveries = await db.request<Delivery[]>(`newsletter_deliveries?batch_id=eq.${batch.id}&select=student_id,email`);
  const members = await db.rpc<Member[]>("audience", { p_ids: deliveries.map(item => item.student_id), p_include_reserved: true });
  const active = members.filter(member => deliveries.some(item => item.student_id === member.student_id && item.email === member.email) && batch.sections.every(section => member.courses.some(course => course.id === section.courseId)));
  const recipients: Member[] = [];
  for (const member of active) {
    if (Date.now() > deadline - 20000) return "deferred";
    try {
      const contact = await brevo<{ emailBlacklisted?: boolean }>(`contacts/${encodeURIComponent(member.email)}`);
      if (contact.emailBlacklisted) {
        await db.request(`newsletter_preferences?student_id=eq.${member.student_id}`, "PATCH", { suppressed_reason: "Unsubscribed or blocked in Brevo", enabled: false, updated_at: new Date().toISOString() });
        continue;
      }
    } catch (error) {
      if (!(error instanceof NewsletterHttpError) || error.status !== 404) throw error;
      await brevo("contacts", "POST", { email: member.email, updateEnabled: true });
    }
    recipients.push(member);
  }
  if (!recipients.length) {
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "cancelled", p_error: "No active subscribed recipients remain." });
    return "cancelled";
  }
  const credits = availableEmailCredits(await brevo("account"), settings.credit_reserve);
  if (credits < recipients.length) return "quota";
  if (Date.now() > deadline - 20000) return "deferred";
  let folderId = settings.brevo_folder_id;
  if (!folderId) {
    const folder = await brevo<{ id: number }>("contacts/folders", "POST", { name: "Hynox Course Newsletters" });
    folderId = folder.id;
    await db.request("newsletter_settings?id=eq.true", "PATCH", { brevo_folder_id: folderId });
    settings.brevo_folder_id = folderId;
  }
  let listId = batch.list_id;
  if (!listId) {
    const list = await brevo<{ id: number }>("contacts/lists", "POST", { folderId, name: `Hynox ${batch.day} ${batch.id}` });
    listId = list.id;
    await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { list_id: listId });
  }
  await clearList(listId);
  await brevo(`contacts/lists/${listId}/contacts/add`, "POST", { emails: recipients.map(item => item.email) });
  const campaign = {
    name: `Hynox ${batch.day} ${batch.id}`, subject: `Your course news · ${batch.day}`,
    sender: { email: secrets.sender_email, name: secrets.sender_name || "Hynox Campus" },
    htmlContent: renderDigest(batch.sections, batch.day), recipients: { listIds: [listId] },
  };
  let campaignId = batch.campaign_id;
  if (!campaignId) {
    const created = await brevo<{ id: number }>("emailCampaigns", "POST", campaign);
    campaignId = created.id;
    await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { campaign_id: campaignId });
  } else {
    const report = await brevo<{ status: string }>(`emailCampaigns/${campaignId}`);
    if (report.status !== "draft") {
      await db.rpc("finish_batch", { p_batch: batch.id, p_state: ["sent", "queued"].includes(report.status) ? "sent" : "unknown" });
      return "reconciled";
    }
    await brevo(`emailCampaigns/${campaignId}`, "PUT", campaign);
  }
  const finalAudience = await db.rpc<Member[]>("audience", { p_ids: recipients.map(item => item.student_id), p_include_reserved: true });
  const finalEmails = recipients.filter(member => finalAudience.some(current => current.student_id === member.student_id && current.email === member.email && batch.sections.every(section => current.courses.some(course => course.id === section.courseId)))).map(member => member.email);
  await clearList(listId);
  if (!finalEmails.length) {
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "cancelled" });
    return "cancelled";
  }
  await brevo(`contacts/lists/${listId}/contacts/add`, "POST", { emails: finalEmails });
  const [latest] = await db.request<NewsletterSettings[]>("newsletter_settings?id=eq.true&select=*");
  if (!latest.enabled || Date.now() > deadline - 14000) return "deferred";
  await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { state: "sending", attempts: batch.attempts + 1, error: null, updated_at: new Date().toISOString() });
  try {
    await brevo(`emailCampaigns/${campaignId}/sendNow`, "POST");
  } catch (error) {
    if (error instanceof NewsletterHttpError && [402,429].includes(error.status)) {
      await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { state: "preparing", error: error.message, updated_at: new Date().toISOString() });
      return "quota";
    }
    await db.rpc("finish_batch", { p_batch: batch.id, p_state: "unknown", p_error: "Brevo acceptance could not be confirmed. Review campaign before any resend." });
    throw error;
  }
  await db.rpc("finish_batch", { p_batch: batch.id, p_state: "sent" });
  return "accepted";
}

export async function runNewsletters(db: NewsletterDatabase, secrets: NewsletterSecrets, fetcher: typeof fetch = fetch) {
  const owner = crypto.randomUUID();
  if (!await db.rpc<boolean>("claim", { p_owner: owner })) return { state: "paused-or-running" };
  const deadline = Date.now() + 85000;
  const result = { state: "complete", collected: 0, accepted: 0, waiting: 0 };
  const errors: string[] = [];
  try {
    const [settings] = await db.request<NewsletterSettings[]>("newsletter_settings?id=eq.true&select=*");
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    if (hour < settings.send_hour || hour >= Math.min(24, settings.send_hour + 12)) return { state: "outside-delivery-window" };
    if (!secrets.brevo_api_key || !secrets.sender_email) throw new Error("Newsletter email transport is not configured.");
    const day = indiaDay();
    const pending = await db.request<Batch[]>("newsletter_batches?state=in.(preparing,sending,unknown)&order=state.asc,created_at.asc&limit=3");
    for (const batch of pending) {
      if (Date.now() > deadline - 20000) break;
      try {
        const state = await sendBatch(db, batch, settings, secrets, deadline, fetcher);
        if (state === "accepted") result.accepted++;
        if (["quota","deferred"].includes(state)) { result.waiting++; return result; }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Newsletter delivery failed.";
        errors.push(message);
        await db.request(`newsletter_batches?id=eq.${batch.id}&state=eq.preparing`, "PATCH", { attempts: batch.attempts + 1, error: message, updated_at: new Date().toISOString() });
      }
    }
    if (Date.now() > deadline - 28000) return result;
    const account = await brevoRequest<{ plan: { type: string; credits: number }[] }>(secrets.brevo_api_key, "account", "GET", undefined, fetcher);
    const credits = availableEmailCredits(account, settings.credit_reserve);
    if (!credits) return { ...result, state: "email-quota" };
    const audience = await db.rpc<Member[]>("audience", { p_limit: 500 });
    for (let offset = 0; offset < audience.length; offset += 100) {
      await db.request(`newsletter_preferences?student_id=in.(${audience.slice(offset,offset+100).map(member => member.student_id).join(",")})`, "PATCH", { last_considered_at: new Date().toISOString() });
    }
    const courses = [...new Map(audience.flatMap(member => member.courses).map(course => [course.id, course])).values()];
    const editions = await db.request<Edition[]>(`newsletter_editions?day=eq.${day}&select=*`);
    for (const course of courses) {
      const edition = editions.find(item => item.course_id === course.id);
      if (edition && (edition.state !== "error" || edition.attempts >= 3 || Date.parse(edition.updated_at) > Date.now() - 30 * 60000)) continue;
      if (Date.now() > deadline - 30000 || result.collected >= 2) break;
      const query = courseQuery(course.title, course.query);
      try {
        const history = await db.request<Edition[]>(`newsletter_editions?course_id=eq.${course.id}&day=lt.${day}&state=eq.ready&order=day.desc&limit=14&select=articles`);
        const seen = new Set(history.flatMap(item => item.articles.flatMap(article => [article.url, headlineKey(article.title)])));
        const news = await collectNews(query, seen, fetcher);
        const row = { course_id: course.id, day, title: course.title, query, articles: news.articles, provider: news.provider, state: news.articles.length ? "ready" : "empty", attempts: (edition?.attempts || 0) + 1, error: null, updated_at: new Date().toISOString() };
        await db.request("newsletter_editions?on_conflict=course_id,day", "POST", row);
        const existingIndex = editions.findIndex(item => item.course_id === course.id);
        if (existingIndex === -1) editions.push(row); else editions[existingIndex] = row;
      } catch (error) {
        const message = error instanceof Error ? error.message : "News collection failed.";
        errors.push(`${course.title}: ${message}`);
        await db.request("newsletter_editions?on_conflict=course_id,day", "POST", { course_id: course.id, day, title: course.title, query, articles: [], state: "error", attempts: (edition?.attempts || 0) + 1, error: message, updated_at: new Date().toISOString() });
      }
      result.collected++;
    }
    const groups = new Map<string, { students: string[]; sections: NewsSection[] }>();
    for (const member of audience) {
      if (member.courses.some(course => !editions.some(item => item.course_id === course.id && item.state !== "error"))) continue;
      const sections = memberSections(member, editions);
      if (!sections.length) continue;
      const signature = sections.map(section => section.courseId).sort().join(":");
      const group = groups.get(signature) || { students: [], sections };
      group.students.push(member.student_id); groups.set(signature, group);
    }
    for (const group of groups.values()) {
      if (Date.now() > deadline - 15000) break;
      await db.rpc("prepare_batch", { p_students: group.students.slice(0, Math.min(credits,25)), p_sections: group.sections });
    }
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0,10);
    const oldLists = await db.request<Batch[]>(`newsletter_batches?day=lt.${new Date(Date.now()-7*86400000).toISOString().slice(0,10)}&state=in.(sent,failed,cancelled)&list_id=not.is.null&limit=3&select=id,list_id`);
    for (const batch of oldLists) {
      if (Date.now() > deadline - 15000) break;
      try {
        await brevoRequest(secrets.brevo_api_key, `contacts/lists/${batch.list_id}`, "DELETE", undefined, fetcher);
        await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { list_id: null });
      } catch (error) {
        if (error instanceof NewsletterHttpError && error.status === 404) await db.request(`newsletter_batches?id=eq.${batch.id}`, "PATCH", { list_id: null });
        else errors.push("Could not clean an expired newsletter contact list.");
      }
    }
    await db.request(`newsletter_editions?day=lt.${cutoff}`, "DELETE");
    await db.request(`newsletter_batches?day=lt.${cutoff}&state=in.(sent,failed,cancelled)&list_id=is.null`, "DELETE");
    return result;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Newsletter run failed.");
    throw error;
  } finally {
    await db.request(`newsletter_settings?id=eq.true&lease_owner=eq.${owner}`, "PATCH", { lease_until: null, lease_owner: null, last_error: errors.length ? errors.join("; ").slice(0,1000) : null });
  }
}

export async function suppressNewsletterContact(db: NewsletterDatabase, email: string, reason: string) {
  const members = await db.request<{ student_id: string }[]>(`newsletter_deliveries?email=eq.${encodeURIComponent(email)}&select=student_id&limit=1`);
  if (members[0]) await db.request(`newsletter_preferences?student_id=eq.${members[0].student_id}`, "PATCH", { enabled: false, suppressed_reason: reason, updated_at: new Date().toISOString() });
}
