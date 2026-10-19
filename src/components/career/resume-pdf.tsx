"use client";

import { Document, Page, Text, View, Link, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { ResumeContent } from "@/lib/resume";
import { safeLink } from "@/lib/resume";

Font.registerHyphenationCallback(word => [word]);
const styles = StyleSheet.create({ page: { padding: 38, fontFamily: "Helvetica", fontSize: 10, color: "#18212d", lineHeight: 1.45 }, name: { fontSize: 24, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 8 }, headline: { fontSize: 12, lineHeight: 1.3, marginBottom: 6 }, contacts: { fontSize: 9, lineHeight: 1.3, marginBottom: 4 }, section: { marginTop: 14 }, heading: { fontSize: 11, fontFamily: "Helvetica-Bold", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 7 }, entry: { marginBottom: 9 }, title: { fontFamily: "Helvetica-Bold" }, muted: { color: "#4b5563", fontSize: 9 }, body: { marginTop: 3 }, link: { color: "#334155", fontSize: 9 }, footer: { position: "absolute", bottom: 20, right: 38, fontSize: 8, color: "#6b7280" } });

export function ResumePdf({ content, template = "classic" }: { content: ResumeContent; template?: "classic" | "modern" }) {
  const b = content.basics;
  const accent = template === "modern" ? "#4338ca" : "#18212d";
  return <Document title={`${b.fullName || "Student"} - Resume`} author={b.fullName}>
    <Page size="A4" style={styles.page}>
      <View><Text style={[styles.name, { color: accent }]}>{b.fullName || "Your name"}</Text>{b.headline && <Text style={styles.headline}>{b.headline}</Text>}
        <Text style={styles.contacts}>{[b.email, b.phone, b.location].filter(Boolean).join(" | ")}</Text>
        {[b.website, b.linkedin, b.github].filter(Boolean).map((url, i) => <Link key={i} src={safeLink(url) || ""} style={styles.link}>{url}</Link>)}
      </View>
      {b.summary && <View style={styles.section}><Text style={[styles.heading, { color: accent }]}>Summary</Text><Text>{b.summary}</Text></View>}
      {content.sections.filter(s => s.entries.length).map(section => <View key={section.id} style={styles.section}>
        <Text style={[styles.heading, { color: accent }]} minPresenceAhead={35}>{section.title}</Text>
        {section.entries.map(e => <View key={e.id} style={styles.entry}>
          <Text style={styles.title} minPresenceAhead={18}>{e.title}</Text>
          {e.subtitle && <Text>{e.subtitle}</Text>}
          {(e.start || e.end) && <Text style={styles.muted}>{[e.start, e.end].filter(Boolean).join(" – ")}</Text>}
          {e.description && <Text style={styles.body}>{e.description}</Text>}
          {safeLink(e.url) && <Link src={safeLink(e.url)!} style={styles.link}>{e.url}</Link>}
        </View>)}
      </View>)}
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""} />
    </Page>
  </Document>;
}
export async function makeResumePdf(content: ResumeContent, template: "classic" | "modern") { return pdf(<ResumePdf content={content} template={template} />).toBlob(); }

