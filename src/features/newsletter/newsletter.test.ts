import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalUrl, collectNews, courseQuery, headlineKey, indiaDay, parseNewsRss, renderDigest, selectArticles, type NewsArticle } from "./content";
import { availableEmailCredits, NewsletterDatabase, runNewsletters } from "./engine";

const now = new Date("2026-10-21T03:30:00Z");
const article: NewsArticle = { title: "New Python release improves performance", url: "https://example.com/python?utm_source=test", source: "Example", publishedAt: "2026-10-20T12:00:00Z" };
const course = { id: "course-1", title: "Python Fundamentals", query: "" };
const member = { student_id: "student-1", email: "student@example.com", full_name: "Student", courses: [course] };
const secrets = { brevo_api_key: "test-only", sender_email: "news@example.com" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); });

describe("newsletter content", () => {
  it("derives topics for arbitrary fields without a fixed course catalog", () => {
    expect(courseQuery("Introduction to Civil Engineering - Batch 2026")).toBe("Civil Engineering");
    expect(courseQuery("Machine Learning Fundamentals")).toBe("Machine Learning");
    expect(courseQuery("QA Nursing Basics")).toBe("Nursing");
    expect(courseQuery("Internal batch name", "Pediatric Nursing")).toBe("Pediatric Nursing");
  });
  it("uses the Indian date around midnight", () => { expect(indiaDay(new Date("2026-10-20T20:00:00Z"))).toBe("2026-10-21"); });
  it("rejects unsafe links, stale news and duplicates across URLs and headlines", () => {
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("https://user:password@example.com")).toBeNull();
    expect(selectArticles([article, { ...article, url: "https://other.example/story" }, { ...article, title: "Python old story", publishedAt: "2020-01-01" }, { ...article, title: "Football scores" }], "Python", new Set(), now)).toHaveLength(1);
    expect(selectArticles([article], "Python", new Set([headlineKey(article.title)]), now)).toHaveLength(0);
    expect(selectArticles([article], "Python", new Set(["https://example.com/python"]), now)).toHaveLength(0);
  });
  it("parses RSS without accepting document entities", () => {
    const items = parseNewsRss(`<rss><channel><item><title>Python release</title><link>https://example.com</link><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate><source url="https://example.com">Example</source></item></channel></rss>`);
    expect(items[0]).toMatchObject({ title: "Python release", source: "Example", publishedAt: "2026-10-20T12:00:00.000Z" });
    expect(() => parseNewsRss('<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>')).toThrow();
  });
  it("falls back when the primary free source fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("Unavailable", { status: 429 })).mockResolvedValueOnce(new Response(`<rss><channel><item><title>Python release</title><link>https://example.com</link><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`));
    const result = await collectNews("Python", new Set(), fetcher, now);
    expect(result.provider).toBe("google-news-rss"); expect(result.articles).toHaveLength(1);
  });
  it("treats invalid feeds as source failures rather than empty editions", () => {
    expect(() => parseNewsRss("<html>Try again later</html>")).toThrow("valid RSS");
    expect(parseNewsRss('<rss><channel><title>News</title></channel></rss>')).toEqual([]);
  });
  it("escapes untrusted content and includes Brevo's unsubscribe placeholder", () => {
    const html = renderDigest([{ courseId: "1", title: '<script>alert("x")</script>', articles: [{ ...article, title: "<img src=x onerror=alert(1)>" }] }], "2026-10-21");
    expect(html).not.toContain("<script>"); expect(html).not.toContain("<img"); expect(html).toContain("{{ unsubscribe }}");
  });
  it("reserves credits and fails closed for unknown credit plans", () => {
    expect(availableEmailCredits({ plan: [{ type: "free", credits: 300 }] }, 50)).toBe(250);
    expect(availableEmailCredits({ plan: [{ type: "free", credits: 20 }] }, 50)).toBe(0);
    expect(() => availableEmailCredits({ plan: [{ type: "sms", credits: 500 }] }, 0)).toThrow();
  });
});

function environment(options: { claim?: boolean; credits?: number; members?: typeof member[]; state?: string; sendFails?: boolean; blocked?: boolean } = {}) {
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  let batchState = options.state || "preparing";
  let listHasContacts = false;
  const batch = { id: "batch-1", day: "2026-10-21", sections: [{ courseId: course.id, title: course.title, articles: [article] }], campaign_id: batchState === "unknown" ? 30 : null, list_id: null, attempts: 0 };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input)); const method = init?.method || "GET";
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    const path = url.pathname + url.search; calls.push({ path, method, body });
    let result: unknown = [];
    if (url.host === "db.example.com") {
      if (path.includes("rpc/newsletter_claim")) result = options.claim !== false;
      else if (path.includes("rpc/newsletter_audience")) result = body.p_include_reserved ? options.members ?? [member] : [];
      else if (path.includes("rpc/newsletter_finish_batch")) { batchState = String(body.p_state); result = null; }
      else if (path.includes("newsletter_settings") && method === "GET") result = [{ enabled: true, daily_limit: 250, credit_reserve: 50, send_hour: 8, brevo_folder_id: 10 }];
      else if (path.includes("newsletter_batches?state=")) result = ["preparing","sending","unknown"].includes(batchState) ? [{ ...batch, state: batchState }] : [];
      else if (path.includes("newsletter_batches") && method === "PATCH" && body.state) batchState = String(body.state);
      else if (path.includes("newsletter_deliveries")) result = [{ student_id: member.student_id, email: member.email }, { student_id: "removed-student", email: "removed@example.com" }];
    } else if (url.host === "api.brevo.com") {
      if (path.endsWith("/account")) result = { plan: [{ type: "free", credits: options.credits ?? 300 }] };
      else if (path.endsWith("/contacts/lists/20") && method === "GET") result = { totalSubscribers: listHasContacts ? 1 : 0, totalBlacklisted: 0 };
      else if (path.endsWith("/contacts/remove")) {
        if (!listHasContacts) return new Response(JSON.stringify({ code: "invalid_parameter", message: "Contacts already removed from list and/or does not exist" }), { status: 400 });
        listHasContacts = false; result = {};
      }
      else if (path.endsWith("/contacts/add")) { listHasContacts = true; result = {}; }
      else if (path.includes("/contacts/student")) result = { emailBlacklisted: options.blocked || false };
      else if (path.endsWith("/contacts/lists") && method === "POST") result = { id: 20 };
      else if (path.endsWith("/emailCampaigns") && method === "POST") result = { id: 30 };
      else if (path.endsWith("/emailCampaigns/30") && method === "GET") result = { status: "draft" };
      else if (path.endsWith("/sendNow") && options.sendFails) throw new DOMException("Timed out", "TimeoutError");
      else result = {};
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return { db: new NewsletterDatabase("https://db.example.com", "test-only", fetcher), fetcher, calls, state: () => batchState };
}

describe("newsletter delivery", () => {
  it("does nothing when paused or another worker owns the lease", async () => {
    const env = environment({ claim: false });
    expect(await runNewsletters(env.db, secrets, env.fetcher)).toEqual({ state: "paused-or-running" });
    expect(env.calls).toHaveLength(1);
  });
  it("sends only currently eligible students and never sends a second daily campaign", async () => {
    const env = environment();
    await runNewsletters(env.db, secrets, env.fetcher);
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.calls.filter(call => call.path.endsWith("/sendNow"))).toHaveLength(1);
    expect(env.calls.filter(call => call.path.endsWith("/contacts/add")).every(call => JSON.stringify(call.body) === JSON.stringify({ emails: [member.email] }))).toBe(true);
    expect(env.state()).toBe("sent");
    expect(env.calls.find(call => call.path.endsWith("/emailCampaigns") && call.method === "POST")?.body).not.toHaveProperty("tag");
  });
  it("does not ask Brevo to remove contacts from a new empty list", async () => {
    const env = environment();
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.state()).toBe("sent");
    expect(env.calls.filter(call => call.path.endsWith("/contacts/remove"))).toHaveLength(1);
    expect(env.calls.some(call => call.path.endsWith("/sendNow"))).toBe(true);
  });
  it("cancels a batch after an opt-out or enrollment removal", async () => {
    const env = environment({ members: [] });
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.state()).toBe("cancelled"); expect(env.calls.some(call => call.path.endsWith("/sendNow"))).toBe(false);
  });
  it("preserves Brevo suppression and does not re-enable blocked contacts", async () => {
    const env = environment({ blocked: true });
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.calls.some(call => call.path.includes("newsletter_preferences") && call.body.enabled === false)).toBe(true);
    expect(env.calls.some(call => call.path.endsWith("/sendNow"))).toBe(false);
  });
  it("defers a batch when reserved provider capacity is exhausted", async () => {
    const env = environment({ credits: 50 });
    const result = await runNewsletters(env.db, secrets, env.fetcher);
    expect(result.waiting).toBe(1); expect(env.calls.some(call => call.path.endsWith("/sendNow"))).toBe(false);
  });
  it("holds ambiguous sends and never blindly retries them", async () => {
    const env = environment({ sendFails: true });
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.state()).toBe("unknown");
    await runNewsletters(env.db, secrets, env.fetcher);
    expect(env.calls.filter(call => call.path.endsWith("/sendNow"))).toHaveLength(1);
  });
});
