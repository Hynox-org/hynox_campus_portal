import React from "react";
import Image from "next/image";

/** Use URL structure, not the storage provider's name, to select a renderer. */
export function lessonMediaSource(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"].includes(host)) {
    const id = host === "youtu.be" ? path.split("/")[1]
      : url.searchParams.get("v") || path.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` } as const;
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const id = path.match(/\/(?:video\/)?(\d+)\/?$/)?.[1];
    if (id) return { kind: "embed", src: `https://player.vimeo.com/video/${id}` } as const;
  }
  if (host === "drive.google.com") {
    const id = path.match(/^\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get("id");
    if (id && /^[\w-]+$/.test(id)) return { kind: "document", src: `https://drive.google.com/file/d/${id}/preview` } as const;
  }
  if (/\.(mp4|webm|ogv|ogg|m4v)$/i.test(path)) return { kind: "video", src: url.href } as const;
  if (/\.(mp3|wav|m4a|oga)$/i.test(path)) return { kind: "audio", src: url.href } as const;
  if (/\.pdf$/i.test(path)) {
    const options = new URLSearchParams(url.hash.slice(1));
    if (!options.has("view") && !options.has("zoom")) options.set("view", "FitH");
    url.hash = options.toString();
    return { kind: "document", src: url.href } as const;
  }
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(path)) return { kind: "image", src: url.href } as const;
  return { kind: "link", src: url.href } as const;
}

export function LessonMedia({ url, title }: { url?: string | null; title: string }) {
  if (!url) return null;
  const media = lessonMediaSource(url);
  if (!media) return <p role="alert" className="text-xs text-red-400">This learning resource has an invalid URL.</p>;
  return (
    <div className="space-y-2 min-w-0 w-full mb-4">
      {media.kind === "video" && <video src={media.src} controls playsInline preload="metadata" aria-label={title} className="w-full aspect-video rounded-xl bg-black" />}
      {media.kind === "audio" && <audio src={media.src} controls preload="metadata" aria-label={title} className="w-full" />}
      {media.kind === "image" && <Image src={media.src} alt={title} width={1200} height={800} unoptimized loading="lazy" style={{ width: "auto", height: "auto" }} className="max-w-full max-h-[600px] object-contain rounded-xl" />}
      {(media.kind === "embed" || media.kind === "document") && (
        <iframe src={media.src} title={title} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className={`w-full border border-[#23252C] rounded-xl ${media.kind === "embed" ? "aspect-video" : "h-[380px] sm:h-[480px] md:h-[600px]"}`} />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-[#6E79F4] underline break-words">
        {media.kind === "link" ? `Open ${title}` : "Open resource in a new tab"}
      </a>
    </div>
  );
}
