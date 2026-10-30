"use client";
import { learningAnalyticsScope } from "@/lib/learning-analytics";
import { isPassedQuizAttempt } from "@/lib/quiz-result";
import { averageLearningProgress } from "@/lib/learning-progress";
import type { ProjectSubmission, QuizAttempt } from "@/types/campus";

import type { Cohort, Enrollment, Activity, ChallengeSubmission, CohortReport } from "@/types/campus";
import React, { useMemo, useState } from "react";
import { BarChart3, Trophy, AlertTriangle, Target, Award, Users } from "lucide-react";
import { HBarChart, VBarChart, DonutChart, StatTile, HBarDatum, VBarDatum, DonutDatum } from "@/components/analytics-charts";
import { CustomSelect } from "@/components/custom-select";

interface AnalyticsTabProps {
  cohorts: Cohort[];
  enrollments: Enrollment[];
  activities: Activity[];
  quizAttempts: QuizAttempt[];
  projectSubmissions: ProjectSubmission[];
  challengeSubmissions: ChallengeSubmission[];
  cohortReports?: Record<string, CohortReport>;
}

const SCORE_BUCKETS = [
  { id: "0-40", label: "0-40%", min: 0, max: 40, color: "var(--error)" },
  { id: "40-60", label: "40-60%", min: 40, max: 60, color: "var(--warning)" },
  { id: "60-80", label: "60-80%", min: 60, max: 80, color: "var(--accent)" },
  { id: "80-100", label: "80-100%", min: 80, max: 101, color: "var(--success)" },
];

export default function AnalyticsTab({
  cohorts,
  enrollments,
  activities,
  quizAttempts,
  projectSubmissions,
  challengeSubmissions,
}: AnalyticsTabProps) {
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>("all");

  const scope = useMemo(() => learningAnalyticsScope(enrollments, activities, quizAttempts, projectSubmissions, selectedCohortFilter),
    [enrollments, activities, quizAttempts, projectSubmissions, selectedCohortFilter]);
  const scopedEnrollments = scope.enrollments;
  // One person may have enrollments in several programs. Give each person one
  // ranking row and equal weight, averaging their cohort progress first.
  const scopedStudents = useMemo(() => {
    type StudentRow = Enrollment;
    const students = new Map<string, { row: StudentRow; progress: number; count: number }>();
    for (const enrollment of scopedEnrollments) {
      const entry = students.get(enrollment.user_id) || { row: enrollment, progress: 0, count: 0 };
      entry.progress += enrollment.progress_percentage || 0;
      entry.count += 1;
      students.set(enrollment.user_id, entry);
    }
    return [...students.values()].map(entry => ({ ...entry.row, progress_percentage: entry.progress / entry.count }));
  }, [scopedEnrollments]);

  const scopedStudentIds = useMemo(
    () => new Set(scopedEnrollments.map((e) => e.user_id)),
    [scopedEnrollments]
  );

  const scopedQuizAttempts = scope.outcomes.filter(a => a.submitted_at !== null);
  const scopedProjectSubs = scope.submissions;
  const scopedChallengeSubs = useMemo(
    () => challengeSubmissions.filter((s) => scopedStudentIds.has(s.student_id)),
    [challengeSubmissions, scopedStudentIds]
  );

  const quizzes = activities.filter((a) => a.activity_type_code === "quiz");

  const challenges = activities.filter((a) => a.activity_type_code === "programming");

  // KPIs -----------------------------------------------------------------
  const totalStudents = scopedStudents.length;

  const avgProgress = totalStudents > 0
    ? averageLearningProgress(scopedStudents.map(e => e.progress_percentage || 0))
    : 0;

  const passedAttempts = scopedQuizAttempts.filter(isPassedQuizAttempt).length;
  const quizPassRate = scopedQuizAttempts.length > 0 ? Math.round((passedAttempts / scopedQuizAttempts.length) * 100) : 0;

  const avgQuizScorePct = useMemo(() => {
    const scored = scopedQuizAttempts.filter((a) => a.max_score);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((acc, a) => acc + ((a.score ?? 0) / (a.max_score || 1)) * 100, 0);
    return Math.round(sum / scored.length);
  }, [scopedQuizAttempts]);

  const approvedProjects = scopedProjectSubs.filter((s) => s.review?.review_status === "approved").length;
  const projectApprovalRate = scopedProjectSubs.length > 0 ? Math.round((approvedProjects / scopedProjectSubs.length) * 100) : 0;

  const acceptedChallenges = scopedChallengeSubs.filter((s) => s.submission_status_code === "accepted").length;
  const challengeAcceptRate = scopedChallengeSubs.length > 0 ? Math.round((acceptedChallenges / scopedChallengeSubs.length) * 100) : 0;

  const forfeitedAttempts = scope.attempts.filter((a) => a.forfeited).length;

  // Cohort performance -----------------------------------------------------
  const cohortPerformance: HBarDatum[] = useMemo(() => {
    return cohorts
      .filter((c) => selectedCohortFilter === "all" || c.id === selectedCohortFilter)
      .map((c) => {
        const cEnrollments = scopedEnrollments.filter((e) => e.cohort_id === c.id);
        const avg = cEnrollments.length > 0
          ? averageLearningProgress(cEnrollments.map(e => e.progress_percentage || 0))
          : 0;
        return {
          id: c.id,
          label: c.name,
          sublabel: `${cEnrollments.length} students`,
          value: avg,
          color: avg >= 70 ? "var(--success)" : avg >= 40 ? "var(--warning)" : "var(--error)",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [cohorts, scopedEnrollments, selectedCohortFilter]);

  // Quiz score distribution -------------------------------------------------
  const scoreDistribution: VBarDatum[] = useMemo(() => {
    return SCORE_BUCKETS.map((bucket) => {
      const count = scopedQuizAttempts.filter((a) => {
        if (!a.max_score) return false;
        const pct = ((a.score ?? 0) / a.max_score) * 100;
        return pct >= bucket.min && pct < bucket.max;
      }).length;
      return { id: bucket.id, label: bucket.label, value: count, color: bucket.color };
    });
  }, [scopedQuizAttempts]);

  // Pass / Fail / Not attempted donut ---------------------------------------
  const quizStatusDonut: DonutDatum[] = useMemo(() => {
    const totalPossible = scope.eligibleQuizCount;
    const attempted = scope.outcomes.length;
    const notAttempted = Math.max(0, totalPossible - attempted);
    const failed = scopedQuizAttempts.length - passedAttempts;
    return [
      { id: "passed", label: "Passed", value: passedAttempts, color: "var(--success)" },
      { id: "failed", label: "Failed", value: Math.max(0, failed), color: "var(--error)" },
      { id: "not_attempted", label: "Not Attempted", value: notAttempted, color: "#A6ACBB" },
      { id: "in_progress", label: "In Progress", value: attempted - scopedQuizAttempts.length, color: "var(--accent)" },
    ];
  }, [scopedQuizAttempts, passedAttempts, scope.eligibleQuizCount, scope.outcomes]);

  // Engagement across activity types ----------------------------------------
  const engagementChart: HBarDatum[] = useMemo(() => {
    const quizEligible = scope.eligibleQuizCount;
    const projectEligible = scope.eligibleProjectCount;
    const challengeEligible = totalStudents * challenges.length;
    return [
      {
        id: "quizzes",
        label: "Quiz Engagement",
        sublabel: `${scope.outcomes.length}/${quizEligible}`,
        value: quizEligible > 0 ? Math.round((scope.outcomes.length / quizEligible) * 100) : 0,
        color: "var(--primary)",
      },
      {
        id: "projects",
        label: "Project Submissions",
        sublabel: `${scopedProjectSubs.length}/${projectEligible}`,
        value: projectEligible > 0 ? Math.round((scopedProjectSubs.length / projectEligible) * 100) : 0,
        color: "var(--warning)",
      },
      {
        id: "challenges",
        label: "Coding Challenge Runs",
        sublabel: `${scopedChallengeSubs.length}/${challengeEligible}`,
        value: challengeEligible > 0 ? Math.round((scopedChallengeSubs.length / challengeEligible) * 100) : 0,
        color: "var(--accent)",
      },
    ];
  }, [totalStudents, scope.eligibleQuizCount, scope.eligibleProjectCount, scope.outcomes.length, challenges.length, scopedProjectSubs, scopedChallengeSubs]);

  // Per-student composite ranking -------------------------------------------
  const studentRankings = useMemo(() => {
    return scopedStudents
      .map((enr) => {
        const sid = enr.user_id;
        const sQuiz = scopedQuizAttempts.filter((a) => a.student_id === sid);
        const quizAvg = sQuiz.length > 0
          ? sQuiz.reduce((acc, a) => acc + (a.max_score ? ((a.score ?? 0) / a.max_score) * 100 : 0), 0) / sQuiz.length
          : null;
        const progress = enr.progress_percentage || 0;
        const composite = quizAvg !== null ? Math.round((progress + quizAvg) / 2) : progress;
        return {
          id: enr.user_id,
          name: enr.student?.full_name || enr.student?.email || "Enrolled Student",
          progress,
          quizAvg: quizAvg !== null ? Math.round(quizAvg) : null,
          composite,
        };
      })
      .sort((a, b) => b.composite - a.composite);
  }, [scopedStudents, scopedQuizAttempts]);

  const topPerformers = studentRankings.slice(0, 5);
  const needsAttention = [...studentRankings].reverse().slice(0, 5).filter((s) => s.composite < 70);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cohort filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
            <BarChart3 size={14} className="text-[#6E79F4]" /> Performance Analytics
          </h3>
          <p className="text-[11px] text-[#C2C6D1] mt-0.5">Deep-dive metrics for this campus only.</p>
        </div>
        <CustomSelect
          className="w-full sm:w-60"
          required
          value={selectedCohortFilter}
          onChange={(v) => setSelectedCohortFilter(v || "all")}
          options={[
            { id: "all", name: "All Cohorts" },
            ...cohorts.map((c) => ({ id: c.id, name: c.name, code: c.code })),
          ]}
        />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatTile label="Students" value={totalStudents} color="var(--primary)" sublabel="In scope" />
        <StatTile label="Avg Progress" value={`${avgProgress}%`} color="var(--primary)" progressPct={avgProgress} />
        <StatTile label="Quiz Pass Rate" value={`${quizPassRate}%`} color="var(--success)" progressPct={quizPassRate} />
        <StatTile label="Avg Quiz Score" value={`${avgQuizScorePct}%`} color="var(--accent)" progressPct={avgQuizScorePct} />
        <StatTile label="Project Approval" value={`${projectApprovalRate}%`} color="var(--warning)" progressPct={projectApprovalRate} />
        <StatTile label="Challenge Accept" value={`${challengeAcceptRate}%`} color="var(--accent)" progressPct={challengeAcceptRate} />
      </div>

      {forfeitedAttempts > 0 && (
        <div className="flex items-center gap-2 bg-[#F0555D]/5 border border-[#F0555D]/15 rounded-xl px-4 py-2.5 text-[11px] text-[#F0555D] font-semibold">
          <AlertTriangle size={14} /> {forfeitedAttempts} quiz attempt{forfeitedAttempts !== 1 ? "s" : ""} forfeited (strict-mode violations) in this scope.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Cohort performance */}
        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <Users size={14} className="text-[#6E79F4]" /> Average Progress by Cohort
          </h4>
          <HBarChart data={cohortPerformance} emptyLabel="No cohorts to compare yet." />
        </div>

        {/* Quiz status donut */}
        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <Target size={14} className="text-[#6E79F4]" /> Quiz Outcomes
          </h4>
          {quizzes.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">No quizzes published yet.</div>
          ) : (
            <DonutChart data={quizStatusDonut} centerLabel="Total Slots" />
          )}
        </div>

        {/* Score distribution */}
        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <BarChart3 size={14} className="text-[#6E79F4]" /> Quiz Score Distribution
          </h4>
          <VBarChart data={scoreDistribution} emptyLabel="No quiz attempts recorded yet." />
        </div>

        {/* Engagement */}
        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <Award size={14} className="text-[#6E79F4]" /> Activity Engagement Rate
          </h4>
          <HBarChart data={engagementChart} emptyLabel="No activities published yet." />
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <Trophy size={14} className="text-[#F5B04A]" /> Top Performers
          </h4>
          {topPerformers.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">No student data yet.</div>
          ) : (
            <div className="space-y-2.5">
              {topPerformers.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#16171D] border border-[#23252C]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#F5B04A]/10 text-[#F5B04A] border border-[#F5B04A]/20 flex items-center justify-center font-black text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold text-[#EDEFF5] truncate">{s.name}</span>
                  </div>
                  <span className="text-xs font-black text-[#2FBF71] shrink-0">{s.composite}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
            <AlertTriangle size={14} className="text-[#F0555D]" /> Needs Attention (&lt;70%)
          </h4>
          {needsAttention.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#23252C] rounded-xl text-xs text-emerald-600 font-semibold">All students in good standing!</div>
          ) : (
            <div className="space-y-2.5">
              {needsAttention.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F0555D]/5 border border-[#F0555D]/15">
                  <span className="text-xs font-bold text-[#EDEFF5] truncate">{s.name}</span>
                  <span className="text-xs font-black text-[#F0555D] shrink-0">{s.composite}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
