"use client";

import { Document, Page, Text, View, Link, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { ResumeContent } from "@/lib/resume";
import { safeLink } from "@/lib/resume";

Font.registerHyphenationCallback(word => [word]);
const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingHorizontal: 35, paddingBottom: 26, fontFamily: "Times-Roman", fontSize: 10, color: "#000000", lineHeight: 1.2 },
  name: { fontSize: 26, lineHeight: 1.2, textAlign: "center", marginBottom: 8 },
  contacts: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", fontSize: 10 },
  link: { color: "#0000ff", textDecoration: "underline" },
  section: { marginTop: 9 },
  heading: { fontSize: 12, fontFamily: "Times-Bold", borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 4, marginBottom: 6 },
  entry: { marginBottom: 5 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: "Times-Bold", flexShrink: 1 }, date: { fontFamily: "Times-Bold", fontSize: 9, maxWidth: "30%", textAlign: "right" },
  bullet: { flexDirection: "row", marginTop: 4, paddingLeft: 18, gap: 10 }, body: { flex: 1 },
});

// Legacy template values remain readable; every export uses the reference layout.
export function ResumePdf({ content }: { content: ResumeContent; template?: "classic" | "modern" }) {
  const b = content.basics;
  return <Document title={`${b.fullName || "Student"} - Resume`} author={b.fullName}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.name}>{b.fullName || "Your name"}</Text>
      <View style={styles.contacts}>
        <Text>{[b.location, b.email, b.phone].filter(Boolean).join(" | ")}</Text>
        {[b.linkedin, b.github, b.website].filter(Boolean).map((url, i) => <Text key={i}> | <Link src={safeLink(url) || ""} style={styles.link}>{url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</Link></Text>)}
      </View>
      {b.headline && <Text style={{ textAlign: "center", marginTop: 4 }}>{b.headline}</Text>}
      {b.summary && <View style={styles.section}><Text style={styles.heading}>SUMMARY</Text><Text>{b.summary}</Text></View>}
      {content.sections.filter(s => s.entries.length).map(section => <View key={section.id} style={styles.section}>
        <Text style={styles.heading} minPresenceAhead={35}>{section.title.toUpperCase()}</Text>
        {section.entries.map(e => <View key={e.id} style={styles.entry}>
          <View style={styles.row} minPresenceAhead={18}>
            {section.kind === "skills" || section.kind === "certifications" ? <Text style={{ flex: 1 }}><Text style={styles.title}>{e.title}{e.subtitle ? ": " : ""}</Text>{e.subtitle}</Text> : safeLink(e.url) ? <Link src={safeLink(e.url)!} style={[styles.title, styles.link]}>{e.title}</Link> : <Text style={styles.title}>{e.title}</Text>}
            {(e.start || e.end) && <Text style={styles.date}>{[e.start, e.end].filter(Boolean).join(" - ")}</Text>}
          </View>
          {e.subtitle && section.kind !== "skills" && section.kind !== "certifications" && <Text>{e.subtitle}</Text>}
          {e.description && e.description.split("\n").filter(line => line.trim()).map((line, i) => section.kind === "projects" || section.kind === "experience"
            ? <View key={i} style={styles.bullet}><Text>•</Text><Text style={styles.body}>{line.replace(/^[•*-]\s*/, "")}</Text></View>
            : <Text key={i}>{line}</Text>)}
        </View>)}
      </View>)}
    </Page>
  </Document>;
}
export async function makeResumePdf(content: ResumeContent) { return pdf(<ResumePdf content={content} />).toBlob(); }
