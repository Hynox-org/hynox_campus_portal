"use client";

export async function readResumePdf(file: File): Promise<{ text: string; pages: number }> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("Choose a PDF smaller than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("This file is not a valid PDF.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const timer = setTimeout(() => { void task.destroy(); }, 20000);
  try {
    const document = await task.promise;
    if (document.numPages > 10) throw new Error("Upload a PDF with no more than 10 pages.");
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      const parts: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(lastY - y) > 4) parts.push("\n");
        parts.push(item.str, item.hasEOL ? "\n" : " "); lastY = y;
      }
      pages.push(parts.join("")); page.cleanup();
      if (pages.join("\n").length > 150000) throw new Error("This PDF contains too much text. Use a shorter resume.");
    }
    const text = pages.join("\n\n").trim();
    if (text.split(/\s+/).length < 10) throw new Error("This PDF has too little selectable text. Image-only resumes need OCR; upload a text-based PDF or paste your text instead.");
    return { text, pages: document.numPages };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("Remove the PDF password before uploading it.");
    if (error instanceof Error && error.name === "InvalidPDFException") throw new Error("This PDF is damaged or unsupported. Export a new copy.");
    throw error;
  } finally { clearTimeout(timer); await task.destroy(); }
}
