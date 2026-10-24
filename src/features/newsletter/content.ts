import { XMLParser } from "fast-xml-parser";

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface NewsCourse {
  id: string;
  title: string;
  query: string;
}

export interface NewsSection {
  courseId: string;
  title: string;
  articles: NewsArticle[];
}

const stopWords = new Set("a an and the of for in to with course courses introduction introductory basics basic beginner beginners advanced fundamentals level batch semester training certification certificate learn qa updated verification".split(" "));

export const headlineKey = (title: string) => `title:${title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")}`;

export function courseQuery(title: string, override = "") {
  const clean = (override || title).normalize("NFKC").replace(/[^\p{L}\p{N}+#.\s-]/gu, " ").replace(/\s+/g, " ").trim();
  if (override) return clean.slice(0, 120);
  return clean.split(" ").filter(word => !stopWords.has(word.toLowerCase()) && /\p{L}/u.test(word)).slice(0, 8).join(" ").slice(0, 120);
}

export function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return null; }
}

export function selectArticles(articles: NewsArticle[], query: string, seen: Set<string>, now = new Date()) {
  const terms = courseQuery(query).toLowerCase().split(/\s+/).filter(Boolean);
  const urls = new Set(seen);
  const titles = new Set<string>(seen);
  return [...articles].sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt)).filter(article => {
    const url = canonicalUrl(article.url);
    const published = Date.parse(article.publishedAt);
    const title = headlineKey(article.title);
    const matches = terms.filter(term => new RegExp(`(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(article.title)).length;
    const relevant = terms.length > 0 && matches >= Math.min(terms.length, 2);
    if (!url || !relevant || !article.title.trim() || !Number.isFinite(published) || published > now.getTime() + 3600000 || published < now.getTime() - 7 * 86400000 || urls.has(url) || titles.has(title)) return false;
    article.url = url;
    urls.add(url); titles.add(title);
    return true;
  }).slice(0, 4);
}

export function parseNewsRss(xml: string): NewsArticle[] {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsupported news feed.");
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  if (!parsed?.rss?.channel) throw new Error("News source did not return a valid RSS feed.");
  const items = parsed?.rss?.channel?.item;
  return (Array.isArray(items) ? items : items ? [items] : []).map(item => {
    const source = typeof item.source === "string" ? item.source : String(item.source?.["#text"] || "Publisher");
    const title = typeof item.title === "string" ? item.title : "";
    return {
      title: (title.endsWith(` - ${source}`) ? title.slice(0,-source.length-3) : title).slice(0,300),
      url: typeof item.link === "string" ? item.link : "",
      source,
      publishedAt: typeof item.pubDate === "string" && Number.isFinite(Date.parse(item.pubDate)) ? new Date(item.pubDate).toISOString() : "",
    };
  });
}

export async function collectNews(query: string, seen: Set<string>, fetcher: typeof fetch = fetch, now = new Date()) {
  const clean = courseQuery(query);
  if (clean.length < 2) throw new Error("Set a descriptive news topic for this course.");
  const gdelt = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  gdelt.search = new URLSearchParams({ query: `"${clean}" sourcelang:english`, mode: "ArtList", format: "json", maxrecords: "30", timespan: "3d", sort: "DateDesc" }).toString();
  let primaryError = "";
  try {
    const response = await fetcher(gdelt, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`GDELT returned ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("News response too large.");
    const data = JSON.parse(text) as { articles?: { title: string; url: string; domain: string; seendate: string }[] };
    const articles = selectArticles((data.articles || []).map(item => ({ title: item.title, url: item.url, source: item.domain, publishedAt: item.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z") })), clean, seen, now);
    if (articles.length) return { articles, provider: "gdelt" };
  } catch (error) { primaryError = error instanceof Error ? error.message : "GDELT unavailable"; }
  const rss = new URL("https://news.google.com/rss/search");
  rss.search = new URLSearchParams({ q: `${clean} when:7d`, hl: "en-IN", gl: "IN", ceid: "IN:en" }).toString();
  try {
    const response = await fetcher(rss, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`RSS returned ${response.status}`);
    return { articles: selectArticles(parseNewsRss(await response.text()), clean, seen, now), provider: "google-news-rss" };
  } catch (error) {
    const fallbackError = error instanceof Error ? error.message : "RSS unavailable";
    throw new Error(`News sources unavailable. ${primaryError} RSS: ${fallbackError}`.trim());
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderDigest(sections: NewsSection[], date: string) {
  const body = sections.map((section, index) => `<tr><td style="padding:24px 32px 8px"><p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#64748b">COURSE BRIEF ${String(index + 1).padStart(2, "0")}</p><h2 style="margin:0;padding-bottom:12px;border-bottom:2px solid #e2e8f0;font-size:21px;color:#172554">${escapeHtml(section.title)}</h2>${section.articles.map(article => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:18px 0;border-bottom:1px solid #e2e8f0"><p style="margin:0 0 8px;font-size:12px;color:#64748b">${escapeHtml(article.source)} &nbsp;|&nbsp; ${escapeHtml(article.publishedAt.slice(0, 10))}</p><h3 style="margin:0 0 12px;font-size:17px;line-height:1.5"><a href="${escapeHtml(canonicalUrl(article.url) || "#")}" style="color:#172554;text-decoration:none">${escapeHtml(article.title)}</a></h3><a href="${escapeHtml(canonicalUrl(article.url) || "#")}" style="font-size:13px;font-weight:bold;color:#4338ca">Read the story &rarr;</a></td></tr></table>`).join("")}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hynox Campus | Course Newsletter</title></head><body style="margin:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#334155"><div style="display:none;max-height:0;overflow:hidden">Your course news, curated in one campus briefing.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f6"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0"><tr><td style="padding:28px 32px;background:#172554;color:#ffffff;border-top:5px solid #818cf8"><p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:3px">HYNOX CAMPUS</p><p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#c7d2fe">THE CAMPUS BRIEF &nbsp;|&nbsp; ${escapeHtml(date)}</p><h1 style="margin:0;font-size:29px;line-height:1.25">Stay curious.<br>Stay ahead.</h1></td></tr><tr><td style="padding:26px 32px 0;font-size:14px;line-height:1.7"><p style="margin:0 0 10px">Hello from Hynox Campus,</p><p style="margin:0">Explore recent developments connected to your enrolled courses. Each story links to its original publisher, so you can keep learning beyond the classroom.</p></td></tr>${body}<tr><td style="padding:24px 32px;font-size:13px;line-height:1.7"><p style="margin:0">Keep learning,<br><strong>The Hynox Campus Team</strong></p></td></tr><tr><td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:#64748b">You subscribed to course news in Hynox Campus. Headlines belong to their respective publishers; no full articles are reproduced.<br><a href="{{ unsubscribe }}" style="color:#475569">Unsubscribe from newsletters</a></td></tr></table></td></tr></table></body></html>`;
}

export function indiaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
