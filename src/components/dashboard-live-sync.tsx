"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export const dashboardQueryDomains: Record<string, string[]> = {
  academic: ["academic-prefetch", "programs", "courses", "course-modules", "course-instructors", "academic-modules", "academic-lessons", "academic-resources", "student-delivery"],
  delivery: ["student-lesson-progress", "attendance-register", "delivery-prefetch", "tenant-cohorts", "teacher-cohorts", "all-cohorts", "student-delivery", "academic-prefetch", "learning-prefetch", "all-activities", "cohort-activities", "quiz-attempts", "project-submissions", "challenge-submissions"],
  library: ["course-templates", "module-templates", "lesson-templates", "resource-templates"],
  identity: ["admin-prefetch", "institutions", "institution-users", "all-teachers", "teacher-cohorts", "delivery-prefetch", "academic-prefetch", "student-delivery"],
};

/** Realtime carries protected revision counters, never underlying user records. */
export function DashboardLiveSync() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!/^\/(admin|teacher|student|institution)(\/|$)/.test(pathname)) return;
    const client = createClient();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    const pending = new Set<string>();
    const revisions = new Map<string, number>();
    const schedule = (domain: string) => {
      if (disposed || !dashboardQueryDomains[domain]) return;
      pending.add(domain);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const domains = [...pending];
        pending.clear();
        const prefixes = new Set(domains.flatMap(domain => dashboardQueryDomains[domain]));
        void queryClient.invalidateQueries({ predicate: query => prefixes.has(String(query.queryKey[0])) });
        window.dispatchEvent(new CustomEvent("hynox:dashboard-change", { detail: domains }));
        if (domains.includes("identity")) router.refresh();
      }, 250);
    };
    const channel = client.channel("dashboard-revisions")
      .on("postgres_changes", { event: "*", schema: "core", table: "dashboard_revisions" }, event => {
        const row = event.new as { domain?: string };
        if (row.domain) schedule(row.domain);
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") Object.keys(dashboardQueryDomains).forEach(schedule);
      });
    // Recovery catches missed events during connection loss; hidden tabs do no work.
    const checkRevisions = async () => {
      if (disposed || polling || document.visibilityState === "hidden") return;
      polling = true;
      try {
        const { data, error } = await client.schema("core").from("dashboard_revisions").select("topic,domain,revision");
        if (disposed || error) return;
        for (const row of data || []) {
          const key = `${row.topic}:${row.domain}`;
          if (revisions.get(key) !== row.revision) schedule(row.domain);
          revisions.set(key, row.revision);
        }
      } catch { /* A later reconnect or visible-tab check retries. */ }
      finally { polling = false; }
    };
    const recovery = setInterval(() => { void checkRevisions(); }, 30_000);
    window.addEventListener("online", checkRevisions);
    document.addEventListener("visibilitychange", checkRevisions);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      clearInterval(recovery);
      window.removeEventListener("online", checkRevisions);
      document.removeEventListener("visibilitychange", checkRevisions);
      void client.removeChannel(channel);
    };
  }, [pathname, queryClient, router]);
  return null;
}
