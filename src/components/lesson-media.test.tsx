// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LessonMedia, lessonMediaSource } from "./lesson-media";
afterEach(cleanup);
describe("learning format rendering", () => {
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ?t=12", "embed"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "embed"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "embed"],
    ["https://vimeo.com/123456", "embed"],
    ["https://drive.google.com/file/d/abc123/view", "document"],
    ["https://cdn.supabase.co/storage/v1/object/public/course/video.MP4?token=example", "video"],
    ["https://cdn.amazonaws.com/lesson.pdf?download=1", "document"],
    ["https://example.com/recording.mp3", "audio"],
    ["https://example.com/diagram.png", "image"],
    ["https://cdn.supabase.co/course/archive.zip", "link"],
    ["https://example.com/lesson?file=video.mp4", "link"],
    ["https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "link"],
  ])("classifies %s as %s", (url, kind) => {
    expect(lessonMediaSource(url)?.kind).toBe(kind);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com", "not a URL"])("rejects unsafe media %s", url => {
    render(<LessonMedia url={url} title="Lesson" />);
    expect(screen.getByRole("alert").textContent).toContain("invalid URL");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("renders a signed storage video with controls and metadata-only preload", () => {
    const { container } = render(<LessonMedia url="https://example.supabase.co/video.mp4?signature=example" title="Video lesson" />);
    const video = container.querySelector("video");
    expect(video?.getAttribute("preload")).toBe("metadata");
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
  });
  it("provides a document fallback link for mobile browsers or blocked embeds", () => {
    render(<LessonMedia url="https://example.com/notes.pdf" title="Notes" />);
    expect(screen.getByTitle("Notes").getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.com/notes.pdf");
  });
  it("does not iframe arbitrary sites or office downloads", () => {
    const { container } = render(<LessonMedia url="https://example.com/notes.doc" title="Notes" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link").textContent).toBe("Open Notes");
  });
  it("fits PDFs to narrow viewers without changing the signed request URL", () => {
    const media = lessonMediaSource("https://example.com/notes.pdf?signature=example#page=2");
    expect(media?.src).toBe("https://example.com/notes.pdf?signature=example#page=2&view=FitH");
  });
  it("preserves an explicit PDF zoom setting", () => {
    expect(lessonMediaSource("https://example.com/notes.pdf#zoom=150")?.src).toBe("https://example.com/notes.pdf#zoom=150");
  });
});
