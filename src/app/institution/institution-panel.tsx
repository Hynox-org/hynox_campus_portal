"use client";

import { isPassedQuizAttempt } from "@/lib/quiz-result";
import { useInputsChanged, useHydrated } from "@/hooks/use-inputs-changed";
import type { Institution, Enrollment, LessonProgress, Lesson } from "@/types/campus";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import {

  Users,
  Search,
  CheckCircle,
  Clock,
  X,
  ExternalLink,
  TrendingUp,
  ChevronDown,
  Loader2
} from "lucide-react";
import { CustomSelect } from "@/components/custom-select";
import { listStudentLessonProgressAction } from "@/app/actions/delivery-actions";
import { listLessonsForCourseAction } from "@/app/actions/academic-actions";
import { learningAnalyticsScope } from "@/lib/learning-analytics";
import { useToast } from "@/components/toast";

import { useDeliveryData, useLearningData } from "@/hooks/use-delivery";
import { useAcademicPrefetchData } from "@/hooks/use-academics";
import AppShell from "@/components/app-shell";
import { DashboardLoader } from "@/components/dashboard-loader";
import AnalyticsTab from "./analytics-tab";

const EMPTY_COHORTS: never[] = [];

interface InstitutionPanelProps {
  adminEmail: string;
  institution: Institution;
  tenantId: string;
  primaryRole: string;
}

async function readStudentLessons(student: string): Promise<LessonProgress[]> {
  const result = await listStudentLessonProgressAction(student);
  if (!result.success || !result.progressList) throw new Error(result.error || "Unable to load student progress.");
  return result.progressList;
}
export default function InstitutionPanel({ 
  adminEmail, 
  institution, 
  tenantId
}: InstitutionPanelProps) {
  const { showError } = useToast();
  const queryClient = useQueryClient();
  // Navigation states
  const [activeTab, setActiveTab] = useState<"roster" | "analytics">(() => {
    return "analytics";
  });

  // Hydrate the active tab from the URL after mount. Reading
  // window.location during the initial render causes an SSR/client
  // hydration mismatch, so it must happen in an effect.
  const hydrated = useHydrated();
  if (useInputsChanged([hydrated]) && hydrated) {
    (() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["roster", "analytics"].includes(tab)) {
      setActiveTab(tab as "roster" | "analytics");
    }

  })();
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") !== activeTab) {
        params.set("tab", activeTab);
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? "?" + newSearch : ""}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [activeTab]);

  // React Query Data Fetching
  const { data: deliveryData, isLoading: loadingDelivery, error: deliveryError } = useDeliveryData(tenantId);
  const { data: learningData, isLoading: loadingLearning, error: learningError } = useLearningData(tenantId);
  const { data: academicData, isLoading: loadingAcademic, error: academicError } = useAcademicPrefetchData(tenantId);

  // Default fallbacks during initial hydration
  const initialCohorts = deliveryData?.cohorts || EMPTY_COHORTS;
  const enrollments = deliveryData?.enrollments || [];

  const activities = learningData?.activities || [];
  const projectSubmissions = learningData?.projectSubmissions || [];
  const challengeSubmissions = learningData?.challengeSubmissions || [];
  const quizAttempts = learningData?.quizAttempts || [];

  const coursesList = academicData?.courses || [];

  // Roster and Drawer states
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");

  if (useInputsChanged([initialCohorts, selectedCohortId])) {
    (() => {
    if (initialCohorts.length > 0 && !selectedCohortId) {
      setSelectedCohortId(initialCohorts[0].id);
    }
  })();
  }

  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);

  const studentLessons = useQuery({
    queryKey: ["student-lesson-progress", selectedStudent?.user_id],
    enabled: !!selectedStudent,
    queryFn: () => readStudentLessons(selectedStudent!.user_id),
    staleTime: 30_000,
  });
  const activeStudentLessonsProgress = studentLessons.data ?? [];
  const [drawerLessonsCache, setDrawerLessonsCache] = useState<Record<string, Lesson[]>>({});
  const [studentDetailTab, setStudentDetailTab] = useState<"overview" | "syllabus" | "quizzes" | "projects" | "challenges">("overview");
  const [rosterSearch, setRosterSearch] = useState("");

  // Collapsible accordion states in drawer
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Derived datasets
  const cohorts = initialCohorts;
  const currentCohortEnrollments = enrollments.filter(e => e.cohort_id === selectedCohortId);

  const filteredEnrollments = currentCohortEnrollments.filter(enr => {
    const studentName = enr.student?.full_name?.toLowerCase() || "";
    const studentEmail = enr.student?.email?.toLowerCase() || "";
    const search = rosterSearch.toLowerCase();
    return !rosterSearch || studentName.includes(search) || studentEmail.includes(search);
  });

  // Which roster row is currently prefetching its drawer data
  const [openingStudentId, setOpeningStudentId] = useState<string | null>(null);

  if (useInputsChanged([academicData])) setDrawerLessonsCache({});
  if (useInputsChanged([enrollments]) && selectedStudent) {
    setSelectedStudent(enrollments.find(e => e.id === selectedStudent.id) ?? null);
  }
  // Load progress before opening; lessons are read on expansion for a student's data first, then open the drawer
  const openStudentDrawer = async (enr: Enrollment) => {
    if (openingStudentId) return;
    setOpeningStudentId(enr.id);
    setStudentDetailTab("overview");
    try {
      await queryClient.fetchQuery({ queryKey: ["student-lesson-progress", enr.user_id], queryFn: () => readStudentLessons(enr.user_id), staleTime: 30_000 });
      setSelectedStudent(enr);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to load student.");
    } finally {
      setOpeningStudentId(null);
    }
  };

  // Clear cached progress when the drawer closes


  // Lazy load lessons for courses expanded inside the student detail drawer
  useEffect(() => {
    if (expandedCourseId && !drawerLessonsCache[expandedCourseId]) {
      listLessonsForCourseAction(expandedCourseId).then(res => {
        if (res.success && res.lessons) {
          setDrawerLessonsCache(prev => ({ ...prev, [expandedCourseId]: res.lessons }));
        }
      });
    }
  }, [expandedCourseId, drawerLessonsCache]);

  const renderStudentDetailDrawer = () => {
    if (!selectedStudent) return null;

    // Real student progress percentage from enrollment/overall computed average
    const progressPercentage = selectedStudent.progress_percentage || 0;

    // Filter submissions for this student
    const studentScope = learningAnalyticsScope(enrollments.filter(e => e.user_id === selectedStudent.user_id), activities, quizAttempts, projectSubmissions, selectedStudent.cohort_id);
    const studentProjSubs = studentScope.submissions;
    const studentChalSubs = challengeSubmissions.filter(sub => sub.student_id === selectedStudent.user_id);
    const studentQuizAttemptsList = studentScope.attempts;
    const studentQuizOutcomes = studentScope.outcomes.filter(a => a.submitted_at);

    const quizzes = activities.filter(a => a.activity_type_code === "quiz" && a.status_code === "published" && a.cohort_ids?.includes(selectedStudent.cohort_id));
    const projects = activities.filter(a => a.activity_type_code === "project" && a.status_code === "published" && a.cohort_ids?.includes(selectedStudent.cohort_id));
    const challenges = activities.filter(a => a.activity_type_code === "programming");

    // Real student quiz attempts mapper


    // Real syllabus lessons mapper using lazy loaded drawerLessonsCache and activeStudentLessonsProgress
    const assignedIds = new Set((deliveryData?.assignments || []).filter(a => a.cohort_id === selectedStudent.cohort_id).map(a => a.course_id));
    const studentSyllabus = coursesList.filter(c => assignedIds.has(c.id)).map((course) => {
      const courseLessons = drawerLessonsCache[course.id] || [];
      return {
        id: course.id,
        title: course.title,
        lessons: courseLessons.map(l => {
          const progressEntry = activeStudentLessonsProgress.find(p => p.lesson_id === l.id);
          return {
            id: l.id,
            title: l.title,
            status: progressEntry?.status_code || "not_started"
          };
        })
      };
    });

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex justify-end animate-fadeIn">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedStudent(null)} />
        <div className="relative w-full sm:max-w-3xl bg-[#131418] h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden sm:border-l border-[#23252C]">

          {/* Drawer Header */}
          <div className="p-4 sm:p-6 border-b border-[#23252C] flex justify-between items-start gap-3 bg-[#16171D] shrink-0">
            <div className="flex gap-3 items-center min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#6E79F4] text-white flex items-center justify-center font-bold text-base sm:text-lg uppercase shadow-md border border-[#6E79F4]/10 shrink-0">
                {(selectedStudent.student?.full_name || selectedStudent.student?.email || "S").substring(0, 2)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#EDEFF5] truncate">{selectedStudent.student?.full_name || "Enrolled Student"}</h3>
                <p className="text-xs text-[#C2C6D1] truncate">{selectedStudent.student?.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20">
                    {selectedStudent.cohort?.name || "No cohort"}
                  </span>
                  <span className="text-[10px] text-[#C2C6D1]">• Enrolled on {new Date((selectedStudent.created_at ?? "")).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedStudent(null)}
              className="p-1.5 hover:bg-[#23252C] rounded-xl transition-all border border-transparent hover:border-[#23252C] cursor-pointer"
            >
              <X size={18} className="text-[#C2C6D1]" />
            </button>
          </div>

          {/* Drawer Tab Navigation */}
          <div className="flex border-b border-[#23252C] px-3 sm:px-6 bg-[#131418] shrink-0 overflow-x-auto no-scrollbar">
            {(["overview", "syllabus", "quizzes", "projects", "challenges"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStudentDetailTab(tab)}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all capitalize cursor-pointer shrink-0 whitespace-nowrap ${
                  studentDetailTab === tab 
                    ? "border-[#6E79F4] text-[#6E79F4] font-bold" 
                    : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {studentLessons.error && <div role="alert" className="p-3">{studentLessons.error.message}<button className="ml-3 underline" onClick={() => void studentLessons.refetch()}>Retry</button></div>}
          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            
            {/* 1. OVERVIEW TAB */}
            {studentDetailTab === "overview" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/10 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Course Progress</span>
                    <div className="text-xl font-black text-[#6E79F4] mt-1">{progressPercentage}%</div>
                    <div className="w-full bg-[#23252C] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#6E79F4] h-full" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Quizzes Cleared</span>
                    <div className="text-xl font-black text-[#2FBF71] mt-1">
                      {studentQuizOutcomes.filter(isPassedQuizAttempt).length} / {studentScope.eligibleQuizCount}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">
                      Avg Score: {
                        studentQuizOutcomes.length > 0
                          ? Math.round(studentQuizOutcomes.reduce((acc, curr) => acc + (curr.max_score ? (curr.score ?? 0) / curr.max_score * 100 : 0), 0) / studentQuizOutcomes.length)
                          : 0
                      }%
                    </span>
                  </div>

                  <div className="bg-[#F5B04A]/5 border border-[#F5B04A]/20 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Projects Submitted</span>
                    <div className="text-xl font-black text-[#F5B04A] mt-1">
                      {studentProjSubs.length} / {projects.length}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">
                      Approved: {studentProjSubs.filter(p => p.review?.review_status === "approved").length}
                    </span>
                  </div>

                  <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Coding Runs</span>
                    <div className="text-xl font-black text-[#22D3EE] mt-1">
                      {studentChalSubs.length} / {challenges.length}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">
                      Accepted: {studentChalSubs.filter(c => c.submission_status_code === "accepted").length}
                    </span>
                  </div>
                </div>

                <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
                    <TrendingUp size={14} className="text-[#6E79F4]" /> Performance Indicators
                  </h4>
                  <div className="divide-y divide-[#23252C] text-xs">
                    <div className="py-3 flex justify-between">
                      <span className="text-[#C2C6D1] font-medium">Platform Activity Status</span>
                      <span className="font-bold text-[#2FBF71] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#2FBF71] rounded-full animate-ping"></span> Active in Cohort
                      </span>
                    </div>
                    <div className="py-3 flex justify-between">
                      <span className="text-[#C2C6D1] font-medium">Completed Syllabus Lessons</span>
                      <span className="font-bold text-[#EDEFF5]">
                        {activeStudentLessonsProgress.filter(p => p.status_code === "completed").length} Core Lessons
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SYLLABUS TAB */}
            {studentDetailTab === "syllabus" && (
              <div className="space-y-6 animate-fadeIn">
                {studentSyllabus.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No courses available in this syllabus context.
                  </div>
                ) : (
                  studentSyllabus.map(course => {
                    const isExpanded = expandedCourseId === course.id;
                    return (
                      <div key={course.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden">
                        <div 
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                          className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <ChevronDown 
                              className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} 
                            />
                            <h4 className="text-xs font-extrabold text-[#EDEFF5]">{course.title}</h4>
                          </div>
                          <span className="text-[10px] font-bold text-[#6E79F4] bg-[#6E79F4]/10 px-2 py-0.5 rounded-full border border-[#6E79F4]/20 shrink-0">Course</span>
                        </div>

                        {isExpanded && (
                          <div className="p-5 border-t border-[#23252C] space-y-2.5 bg-[#16171D]/30">
                            {course.lessons.map(lesson => (
                              <div key={lesson.id} className="flex justify-between items-center text-xs p-2.5 bg-[#131418] border border-[#23252C] rounded-xl hover:bg-[#16171D] transition-all shadow-sm">
                                <div className="flex items-center gap-2.5">
                                  {lesson.status === "completed" ? (
                                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200"><CheckCircle className="w-3 h-3" /></div>
                                  ) : lesson.status === "in_progress" ? (
                                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200"><Clock className="w-3 h-3" /></div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-[#1A1C22] text-[#A3A9B6] flex items-center justify-center font-bold text-[10px] border border-[#23252C]">•</div>
                                  )}
                                  <span className="font-semibold text-[#EDEFF5]">{lesson.title}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                  lesson.status === "completed" 
                                    ? "bg-emerald-50 text-emerald-600" 
                                    : lesson.status === "in_progress"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-[#1A1C22] text-[#C2C6D1]"
                                }`}>
                                  {lesson.status.replace(/_/g, " ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 3. QUIZZES TAB */}
            {studentDetailTab === "quizzes" && (
              <div className="space-y-6 animate-fadeIn">
                {quizzes.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No quizzes found on the platform.
                  </div>
                ) : (
                  quizzes.map(quiz => {
                    const attempts = studentQuizAttemptsList.filter(a => a.activity_id === quiz.id);
                    const sortedAttempts = [...attempts].sort((a, b) => new Date(b.submitted_at || b.created_at || b.started_at || 0).getTime() - new Date(a.submitted_at || a.created_at || a.started_at || 0).getTime());
                    const passedAttempt = sortedAttempts.find(isPassedQuizAttempt);
                    const attempt = passedAttempt || sortedAttempts[0];
                    const isPassed = isPassedQuizAttempt(attempt);

                    return (
                      <div key={quiz.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                        <div className="p-5 flex justify-between items-center gap-4 hover:bg-[#16171D]/80 transition-colors select-none">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <h4 className="text-xs font-bold text-[#EDEFF5]">{quiz.title}</h4>
                              {attempt && (
                                <p className="text-[9px] text-[#C2C6D1] mt-0.5">
                                  {attempts.length > 1 ? `${attempts.length} attempts • ` : ""}
                                  Last attempt on {new Date(attempt.submitted_at || attempt.created_at || attempt.started_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0 font-bold">
                            {attempt ? (
                              !attempt.submitted_at ? <span>In Progress</span> : isPassed ? (
                                <span className="px-2.5 py-1 rounded bg-[#2FBF71]/10 text-[#2FBF71] border border-[#2FBF71]/20 font-bold text-[10px]">
                                  Passed with {attempt.score} marks
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-[10px]">
                                  Failed with {attempt.score} marks
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[8px] uppercase bg-[#1A1C22] text-[#A3A9B6]">Not Attempted</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 4. PROJECTS TAB */}
            {studentDetailTab === "projects" && (
              <div className="space-y-6 animate-fadeIn">
                {studentProjSubs.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No projects submitted yet by this student.
                  </div>
                ) : (
                  studentProjSubs.map(sub => {
                    const isExpanded = expandedProjectId === sub.id;
                    return (
                      <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                        <div 
                          onClick={() => setExpandedProjectId(isExpanded ? null : sub.id)}
                          className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <ChevronDown 
                              className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} 
                            />
                            <div>
                              <h4 className="text-xs font-bold text-[#EDEFF5]">{sub.project_title}</h4>
                              <p className="text-[9px] text-[#C2C6D1] mt-0.5">Submitted on {new Date(sub.submitted_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase shrink-0 ${
                            sub.review?.review_status === "approved"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-amber-50 text-amber-600 border-amber-100"
                          }`}>
                            {sub.review?.review_status || "Pending"}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="p-5 border-t border-[#23252C] space-y-3 bg-[#16171D]/30">
                            <div>
                              <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">GitHub Link</span>
                              <a 
                                href={sub.github_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-[#6E79F4] font-bold break-all hover:underline flex items-center gap-1 w-fit"
                              >
                                {sub.github_url}
                                <ExternalLink size={12} />
                              </a>
                            </div>

                            {sub.submission_notes && (
                              <div>
                                <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">Student Notes</span>
                                <p className="p-3 bg-[#131418] border border-[#23252C] rounded-xl text-[#EDEFF5] italic">
                                  &quot;{sub.submission_notes}&quot;
                                </p>
                              </div>
                            )}

                            {sub.review && (
                              <div className="pt-3 border-t border-[#23252C]">
                                <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-2">Grade & Evaluation</span>
                                <div className="p-3 bg-[#6E79F4]/5 border border-[#6E79F4]/10 rounded-xl space-y-2">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-[#C2C6D1] font-medium">Score:</span>
                                    <strong className="text-sm font-black text-[#6E79F4]">{sub.review.score} / {sub.max_score} pts</strong>
                                  </div>
                                  {sub.review.feedback && (
                                    <div className="text-[10px] text-[#EDEFF5] mt-1 pt-1.5 border-t border-[#6E79F4]/10">
                                      <strong className="block text-[#C2C6D1] uppercase text-[8px] tracking-wide mb-0.5">Feedback:</strong>
                                      {sub.review.feedback}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 5. CHALLENGES TAB */}
            {studentDetailTab === "challenges" && (
              <div className="space-y-6 animate-fadeIn">
                {studentChalSubs.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No coding challenges submitted by this student.
                  </div>
                ) : (
                  studentChalSubs.map(sub => (
                    <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-[#EDEFF5]">{sub.challenge_title || "Coding Challenge"}</h4>
                          <p className="text-[9px] text-[#C2C6D1]">Language: {sub.lang} • Run on {new Date(sub.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          sub.submission_status_code === "accepted"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-red-50 text-red-600 border-red-100"
                        }`}>
                          {sub.submission_status_code}
                        </span>
                      </div>

                      {sub.result && (
                        <div className="bg-[#16171D] border border-[#23252C] p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[#C2C6D1]">Points Awarded:</span>
                            <strong className="text-[#6E79F4]">{sub.result.score} pts</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#C2C6D1]">Validation Result:</span>
                            <span>{sub.result.message || "Passed"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

          </div>

          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedStudent(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const initialError = deliveryError || learningError || academicError;
  if (initialError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load the campus dashboard. {initialError.message}</div>;
  }

  return (
    <>
      <DashboardLoader loading={loadingDelivery || loadingLearning || loadingAcademic} message="Setting up your Campus environment..." />
      <AppShell
        portalLabel="Campus Admin"
        pageTitle={activeTab === "roster" ? "Student Roster & Progress" : "Performance Analytics"}
        items={[
          { id: "analytics", label: "Analytics", icon: TrendingUp },
          { id: "roster", label: "Students", icon: Users },
        ]}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as "roster" | "analytics")}
        userName={adminEmail}
        userMeta={institution.name}
      >
      <div className="flex flex-col gap-6 animate-pageIn">
        
        {/* ROSTER TABLE */}
        {activeTab === "roster" && (
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#23252C]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C2C6D1]">Student Progress Registry</h3>
                <p className="text-[11px] text-[#C2C6D1] mt-0.5">Monitor, search, and view performance logs of enrolled candidates.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto min-w-0">
                <span className="text-xs font-bold text-[#C2C6D1] shrink-0">Cohort:</span>
                <CustomSelect
                  options={cohorts}
                  value={selectedCohortId}
                  onChange={setSelectedCohortId}
                  placeholder="Select cohort group"
                  searchable
                  className="w-full sm:w-64"
                />
              </div>
            </div>

            {selectedCohortId ? (
              <>
                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search size={14} className="absolute left-3 top-2.5 text-[#C2C6D1]" />
                  <input
                    type="text"
                    placeholder="Search students by name or email..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-xl pl-9 pr-3 py-2 text-xs text-[#EDEFF5] focus:outline-none focus:border-[#6E79F4] shadow-xs"
                  />
                </div>

                {filteredEnrollments.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No student enrollments found matching search filters.
                  </div>
                ) : (
                  <div className="border border-[#23252C] rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#16171D] border-b border-[#23252C] text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wide">
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3">Email Address</th>
                            <th className="px-4 py-3">Syllabus Progress</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Enrolled Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#23252C]">
                          {filteredEnrollments.map((enr) => {
                            const progVal = enr.progress_percentage || 0;

                            return (
                              <tr 
                                key={enr.id} 
                                onClick={() => openStudentDrawer(enr)}
                                className={`hover:bg-[#16171D]/50 cursor-pointer transition-colors ${openingStudentId === enr.id ? "opacity-70" : ""}`}
                              >
                                <td className="px-4 py-3.5 font-bold text-[#EDEFF5] flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-[#6E79F4]/10 text-[#6E79F4] flex items-center justify-center font-bold text-[10px] uppercase border border-[#6E79F4]/25 shrink-0">
                                    {openingStudentId === enr.id
                                      ? <Loader2 size={12} className="animate-spin" />
                                      : (enr.student?.full_name || enr.student?.email || "S").substring(0, 2)}
                                  </div>
                                  <span className="hover:text-[#6E79F4] transition-colors">{enr.student?.full_name || "Enrolled Student"}</span>
                                </td>
                                <td className="px-4 py-3.5 text-[#C2C6D1] font-medium">{enr.student?.email}</td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2 w-36">
                                    <div className="flex-1 bg-[#1A1C22] h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-[#6E79F4] h-full" style={{ width: `${progVal}%` }}></div>
                                    </div>
                                    <span className="font-bold shrink-0">{progVal}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    enr.status_code === "active" 
                                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                      : "bg-[#1A1C22] text-[#C2C6D1]"
                                  }`}>
                                    {enr.status_code}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-[#C2C6D1]">
                                  {new Date(enr.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                Please select a cohort group from the dropdown menu to inspect candidate roster logs.
              </div>
            )}
          </div>
        )}

        {/* PERFORMANCE ANALYTICS */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            cohorts={cohorts}
            enrollments={enrollments}
            activities={activities}
            quizAttempts={quizAttempts}
            projectSubmissions={projectSubmissions}
            challengeSubmissions={challengeSubmissions}

          />
        )}

      </div>

      {/* Roster detail drawer */}
      {renderStudentDetailDrawer()}

      </AppShell>
    </>
  );
}
