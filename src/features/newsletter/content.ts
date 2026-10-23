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
  const body = sections.map(section => `<h2 style="font-size:19px;color:#4338ca">${escapeHtml(section.title)}</h2>${section.articles.map(article => `<div style="margin:20px 0"><a href="${escapeHtml(canonicalUrl(article.url) || "#")}" style="font-size:16px;color:#172554">${escapeHtml(article.title)}</a><p style="font-size:12px;color:#64748b">${escapeHtml(article.source)} · ${escapeHtml(article.publishedAt.slice(0, 10))}</p></div>`).join("")}`).join("");
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172554"><main style="max-width:600px;margin:24px auto;padding:28px;background:white;border-radius:12px"><p>HYNOX CAMPUS · ${escapeHtml(date)}</p><h1 style="font-size:26px">Your daily field update</h1><p>Recent stories related to your enrolled courses. Follow each headline to read the original publisher.</p>${body}<hr><p style="font-size:12px;color:#64748b">You subscribed to course news in Hynox Campus. Headlines are attributed to their publishers; no full articles are reproduced.</p><p><a href="{{ unsubscribe }}">Unsubscribe from newsletters</a></p></main></body></html>`;
}

export function indiaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
