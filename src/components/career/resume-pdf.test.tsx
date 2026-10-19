import React from "react";
import { expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdf } from "./resume-pdf";
import { emptyResume, newEntry } from "@/lib/resume";

it("exports selectable text and paginates long resumes without losing entries", async () => {
  const content = emptyResume("QA Student", "qa@example.com");
  content.sections = [{ id: crypto.randomUUID(), kind: "projects", title: "Projects", entries: Array.from({ length: 30 }, (_, i) => ({ ...newEntry(), title: `Project number ${i + 1}`, subtitle: "Academic project", description: "Designed and tested an accessible student learning portal. Built tools for 20 students and documented the results.\nCollaborated on implementation and verified the final deliverables." })) }];
  const bytes = await renderToBuffer(<ResumePdf content={content} template="modern" />);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const doc = await task.promise; expect(doc.numPages).toBeGreaterThan(1);
    let text = "";
    for (let p = 1; p <= doc.numPages; p++) { const page = await doc.getPage(p); const data = await page.getTextContent(); text += data.items.map(item => "str" in item ? item.str : "").join(" "); }
    expect(text).toContain("QA Student"); expect(text).toContain("qa@example.com"); expect(text).toContain("Project number 30");
  } finally { await task.destroy(); }
}, 20000);
