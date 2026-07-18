"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  listModulesAction, 
  listLessonsAction, 
  listLessonResourcesAction 
} from "@/app/actions/academic-actions";
import { 
  startOrUpdateLessonProgressAction,
  completeLessonProgressAction,
  getStudentDeliveryDataAction,
  listStudentLessonProgressAction
} from "@/app/actions/delivery-actions";
import {
  getStudentAssignedActivitiesAction,
  getQuizDetailsAction,
  startQuizAttemptAction,
  submitQuizAnswersAction,
  getProjectDetailsAction,
  submitProjectAction,
  getProgrammingChallengeDetailsAction,
  submitChallengeCodeAction,
  getChallengeSubmissionResultsAction,
  getActiveQuizAttemptAction,
  getQuizSessionDetailsAction,
  ensureLessonProjectActivityAction,
  forfeitQuizAttemptAction
} from "@/app/actions/learning-actions";
import { getAttendanceRegisterAction, getStudentAttendanceSummaryAction } from "@/app/actions/attendance-actions";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCache } from "@/components/cache-provider";
import { useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/app-shell";
import { seedAcademicListCaches, unwrapActionResult } from "@/lib/dashboard-query";
import { 
  Building, 
  GraduationCap, 
  BookOpen, 
  Award, 
  Calendar,
  CheckCircle,
  Circle,
  Play,
  ArrowRight, 
  ChevronRight, 
  Clock, 
  File, 
  ExternalLink,
  ChevronLeft,
  ChevronDown,
  BookOpenCheck,
  CheckCircle2,
  FileQuestion,
  FolderCode,
  Terminal as TerminalIcon,
  Send,
  AlertTriangle,
  History,
  Code,
  Menu,
  X,
  ShieldAlert,
  Maximize2
} from "lucide-react";

import { useStudentDeliveryData } from "@/hooks/use-delivery";
import { useAcademicPrefetchData } from "@/hooks/use-academics";
import { DashboardLoader } from "@/components/dashboard-loader";
import { useToast } from "@/components/toast";
import { QuizResultBadge } from "@/components/quiz-result-badge";

interface StudentConsoleProps {
  studentEmail: string;
  fullName: string;
  primaryRole: string;
  institution: any;
  studentId: string;
}

export default function StudentConsole({ 
  studentEmail, 
  fullName, 
  primaryRole, 
  institution, 
  studentId
}: StudentConsoleProps) {
  const queryClient = useQueryClient();
  const { data: studentDeliveryRes, isLoading: loadingStudentDelivery, error: studentDeliveryError } = useStudentDeliveryData(studentId);
  const { data: academicPrefetch } = useAcademicPrefetchData(institution?.id);
  const initialPrograms = studentDeliveryRes?.programs || [];

  const [activeTab, setActiveTab] = useState<"overview" | "academics" | "quizzes" | "projects" | "challenges">("overview");
  const [activeParentTab, setActiveParentTab] = useState<"overview" | "curriculum" | "assessments">("overview");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && ["overview", "academics", "quizzes", "projects", "challenges"].includes(tab)) {
        setActiveTab(tab as any);
      }
      const parent = params.get("parentTab");
      if (parent && ["overview", "curriculum", "assessments"].includes(parent)) {
        setActiveParentTab(parent as any);
      }
    }
  }, []);

  // Academics exploration state
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<any | null>(null);

  useEffect(() => {
    if (initialPrograms.length > 0) {
      setPrograms(initialPrograms);
      if (!selectedCohort) {
        const flat: any[] = [];
        initialPrograms.forEach(p => {
          if (p.cohorts) {
            p.cohorts.forEach((c: any) => {
              if (!flat.some(item => item.id === c.id)) {
                flat.push({
                  ...c,
                  programId: p.id,
                  programTitle: p.title,
                  courses: p.courses ? p.courses.filter((course: any) => course.cohort_id === c.id) : []
                });
              }
            });
          }
        });
        setSelectedCohort(flat[0] || null);
      }
    }
  }, [initialPrograms]);

  const selectedProgram = selectedCohort ? programs.find(p => p.id === selectedCohort.programId) : null;
  
  const { get, set } = useCache();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, any>>({});
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [isSyllabusDrawerOpen, setIsSyllabusDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      if (params.get("tab") !== activeTab) {
        params.set("tab", activeTab);
        changed = true;
      }
      if (params.get("parentTab") !== activeParentTab) {
        params.set("parentTab", activeParentTab);
        changed = true;
      }

      // Clean up legacy URL search params
      if (params.has("courseId")) { params.delete("courseId"); changed = true; }
      if (params.has("lessonId")) { params.delete("lessonId"); changed = true; }

      if (selectedCourse && selectedCohort && selectedCohort.courses) {
        const cIdx = selectedCohort.courses.findIndex((c: any) => c.id === selectedCourse.id);
        if (cIdx !== -1) {
          if (params.get("c") !== String(cIdx)) {
            params.set("c", String(cIdx));
            changed = true;
          }
        } else if (params.has("c")) {
          params.delete("c");
          changed = true;
        }
      } else {
        if (params.has("c")) {
          params.delete("c");
          changed = true;
        }
      }

      if (activeLesson && modules.length > 0) {
        const flatLessons = modules.flatMap(m => m.lessons || []);
        const lIdx = flatLessons.findIndex((l: any) => l.id === activeLesson.id);
        if (lIdx !== -1) {
          if (params.get("l") !== String(lIdx)) {
            params.set("l", String(lIdx));
            changed = true;
          }
        } else if (params.has("l")) {
          params.delete("l");
          changed = true;
        }
      } else {
        if (params.has("l")) {
          params.delete("l");
          changed = true;
        }
      }

      if (changed) {
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? "?" + newSearch : ""}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [activeTab, activeParentTab, selectedCourse, activeLesson, selectedCohort, modules]);

  // Guards: restore from URL only once per session to prevent background
  // React Query refetches from overriding the user's active selections.
  const hasRestoredCourse = useRef(false);
  const hasRestoredLesson = useRef(false);

  // Scroll-synced line-number gutter for the challenge code editor.
  const codeEditorGutterRef = useRef<HTMLDivElement>(null);
  const handleCodeEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (codeEditorGutterRef.current) {
      codeEditorGutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Restore selectedCourse from query params when selectedCohort loads
  useEffect(() => {
    if (hasRestoredCourse.current) return;
    if (selectedCohort && selectedCohort.courses && selectedCohort.courses.length > 0 && typeof window !== "undefined" && !selectedCourse) {
      const params = new URLSearchParams(window.location.search);
      const cIdxStr = params.get("c");
      if (cIdxStr) {
        const idx = parseInt(cIdxStr, 10);
        if (!isNaN(idx) && idx >= 0 && idx < selectedCohort.courses.length) {
          setSelectedCourse(selectedCohort.courses[idx]);
          hasRestoredCourse.current = true;
        }
      } else {
        // No ?c= in URL — mark as restored so we don't loop
        hasRestoredCourse.current = true;
      }
    }
  }, [selectedCohort, selectedCourse]);

  // Restore activeLesson from query params when modules load
  useEffect(() => {
    if (hasRestoredLesson.current) return;
    if (modules.length > 0 && typeof window !== "undefined" && !activeLesson) {
      const params = new URLSearchParams(window.location.search);
      const lIdxStr = params.get("l");
      if (lIdxStr) {
        const idx = parseInt(lIdxStr, 10);
        const flatLessons = modules.flatMap(m => m.lessons || []);
        if (!isNaN(idx) && idx >= 0 && idx < flatLessons.length) {
          setActiveLesson(flatLessons[idx]);
          hasRestoredLesson.current = true;
        }
      } else {
        // No ?l= in URL — mark as restored so we don't loop
        hasRestoredLesson.current = true;
      }
    }
  }, [modules, activeLesson]);

  // Learning activities state
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Active quiz state
  const [selectedQuizActivity, setSelectedQuizActivity] = useState<any | null>(null);
  const [quizDetails, setQuizDetails] = useState<any | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<any | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [quizSubmittedResult, setQuizSubmittedResult] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Lets the timer's auto-submit read the latest answers without needing
  // selectedAnswers in its effect deps (which would restart the interval on
  // every option click). Also guards against the timer and the manual
  // submit button both firing submitQuizAnswersAction at the same instant.
  const selectedAnswersRef = useRef(selectedAnswers);
  useEffect(() => {
    selectedAnswersRef.current = selectedAnswers;
  }, [selectedAnswers]);
  const isSubmittingQuizRef = useRef(false);

  // Strict/proctored mode lockdown state
  const [quizViolationWarning, setQuizViolationWarning] = useState<{ deadline: number } | null>(null);
  const [, setViolationTick] = useState(0);
  const quizViolationCountRef = useRef(0);
  // Flips off the instant an attempt ends (submit/forfeit), so lockdown
  // listeners that fire during our own cleanup (e.g. exitFullscreen after a
  // normal submit) don't register a false violation.
  const attemptActiveRef = useRef(false);
  const activeAttemptRef = useRef<any>(null);
  useEffect(() => {
    activeAttemptRef.current = activeAttempt;
  }, [activeAttempt]);

  // Active project state
  const [selectedProjectActivity, setSelectedProjectActivity] = useState<any | null>(null);
  const [projectDetails, setProjectDetails] = useState<any | null>(null);
  const [projectSubmission, setProjectSubmission] = useState<any | null>(null);
  const [projectReview, setProjectReview] = useState<any | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");

  // Active lesson project state
  const [lessonProjectDetails, setLessonProjectDetails] = useState<any | null>(null);
  const [lessonProjectSubmission, setLessonProjectSubmission] = useState<any | null>(null);
  const [lessonProjectReview, setLessonProjectReview] = useState<any | null>(null);
  const [lessonGithubUrl, setLessonGithubUrl] = useState("");
  const [lessonSubmissionNotes, setLessonSubmissionNotes] = useState("");

  // Active programming challenge state
  const [selectedChallengeActivity, setSelectedChallengeActivity] = useState<any | null>(null);
  const [challengeDetails, setChallengeDetails] = useState<any | null>(null);
  const [challengeExamples, setChallengeExamples] = useState<any[]>([]);
  const [challengeSubmissions, setChallengeSubmissions] = useState<any[]>([]);
  const [editorLanguage, setEditorLanguage] = useState("javascript");
  const [editorCode, setEditorCode] = useState("");
  const [selectedSubmissionForResults, setSelectedSubmissionForResults] = useState<any | null>(null);
  const [submissionResults, setSubmissionResults] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  // Attendance states
  const [attendancePercentage, setAttendancePercentage] = useState<number | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const loadAttendance = async () => {
      const cohortId = selectedCohort?.id;
      if (!cohortId) {
        setAttendancePercentage(null);
        setAttendanceLogs([]);
        return;
      }
      setLoadingAttendance(true);
      const [registerRes, summaryRes] = await Promise.all([
        getAttendanceRegisterAction(cohortId),
        getStudentAttendanceSummaryAction(cohortId, studentId),
      ]);
      if (registerRes.register) {
        const logs = registerRes.register.dates
          .filter((d) => !d.isHoliday)
          .map((d) => ({ date: d.date, status: registerRes.register!.records[studentId]?.[d.date] || "absent" }));
        setAttendanceLogs(logs);
        setAttendancePercentage(summaryRes.summary ? summaryRes.summary.percentage : 100);
      } else if (registerRes.error) {
        showError(registerRes.error);
      }
      setLoadingAttendance(false);
    };
    loadAttendance();
  }, [selectedCohort, studentId]);

  // Load activities on mount or tab change. Returns the freshly fetched list
  // so callers (e.g. after a quiz submit) can re-sync any stale snapshot of
  // an individual activity (like selectedQuizActivity) instead of leaving it
  // pointed at pre-attempt data until the next full re-entry.
  const loadActivities = async (): Promise<any[]> => {
    const cachedActivities = get(`student-activities-${studentId}`);
    if (cachedActivities) {
      setActivities(cachedActivities);
    } else {
      setLoadingActivities(true);
    }

    const res = await getStudentAssignedActivitiesAction(studentId);
    if (res.activities) {
      set(`student-activities-${studentId}`, res.activities);
      setActivities(res.activities);
      setLoadingActivities(false);
      return res.activities;
    } else if (res.error) {
      showError(res.error);
    }
    setLoadingActivities(false);
    return cachedActivities || [];
  };

  useEffect(() => {
    refreshStudentData();

  }, [studentId]);

  // The academic prefetch hook owns the request. Reuse its result instead of
  // starting a second server action whenever this dashboard mounts.
  useEffect(() => {
    if (institution?.id && academicPrefetch?.success) {
      seedAcademicListCaches(queryClient, institution.id, academicPrefetch);
    }
  }, [academicPrefetch, institution?.id, queryClient]);

  const refreshStudentData = async () => {
    // Read from client-side memory cache first
    const cachedData = get(`student-delivery-data-${studentId}`);
    const applyData = (data: any) => {
      if (data.programs) {
        setPrograms(data.programs);
        
        const flat: any[] = [];
        data.programs.forEach((p: any) => {
          if (p.cohorts) {
            p.cohorts.forEach((c: any) => {
              if (!flat.some(item => item.id === c.id)) {
                flat.push({
                  ...c,
                  programId: p.id,
                  programTitle: p.title,
                  courses: p.courses ? p.courses.filter((course: any) => course.cohort_id === c.id) : []
                });
              }
            });
          }
        });

        if (selectedCohort) {
          const updatedCohort = flat.find(c => c.id === selectedCohort.id);
          if (updatedCohort) {
            setSelectedCohort(updatedCohort);
            if (selectedCourse) {
              const updatedCourse = updatedCohort.courses.find((c: any) => c.id === selectedCourse.id);
              if (updatedCourse) {
                setSelectedCourse(updatedCourse);
              }
            }
          }
        } else if (flat.length > 0) {
          setSelectedCohort(flat[0]);
        }
      }
    };

    if (cachedData) {
      applyData(cachedData);
    }

    // Use the same key as the dashboard observer. TanStack Query deduplicates
    // this fetch with an in-flight initial/background refresh instead of
    // issuing a second Supabase request for the same student payload.
    let res;
    try {
      res = await queryClient.fetchQuery({
        queryKey: ["student-delivery", studentId],
        queryFn: async () => unwrapActionResult(await getStudentDeliveryDataAction(studentId)),
        staleTime: 0,
      });
    } catch (fetchError) {
      showError(fetchError instanceof Error ? fetchError.message : "Unable to refresh your dashboard.");
      return;
    }
    if (res.programs) {
      set(`student-delivery-data-${studentId}`, res);
      applyData(res);
    }
    const updatedActivities = await loadActivities();
    await loadLessonProgress();
    return updatedActivities;
  };

  const loadLessonProgress = async () => {
    const res = await listStudentLessonProgressAction(studentId);
    if (res.progressList) {
      const pMap: Record<string, any> = {};
      res.progressList.forEach((p: any) => {
        pMap[p.lesson_id] = p;
      });
      setLessonProgressMap(pMap);
    }
  };

  const handleSelectCohort = (cohort: any) => {
    setSelectedCohort(cohort);
    setSelectedCourse(null);
    setModules([]);
    setActiveLesson(null);

    // Clear any assessment detail views so a stale activity from the old
    // cohort doesn't stay rendered under the newly selected one.
    setSelectedQuizActivity(null);
    setQuizDetails(null);
    setQuizQuestions([]);
    setActiveAttempt(null);
    setQuizSubmittedResult(null);
    setQuizViolationWarning(null);
    attemptActiveRef.current = false;
    quizViolationCountRef.current = 0;
    setSelectedProjectActivity(null);
    setProjectDetails(null);
    setProjectSubmission(null);
    setProjectReview(null);
    setSelectedChallengeActivity(null);
    setChallengeDetails(null);
    setChallengeExamples([]);
    setChallengeSubmissions([]);
    setSelectedSubmissionForResults(null);
    setSubmissionResults(null);
  };

  const handleSelectCourse = async (course: any) => {
    setSelectedCourse(course);
    setActiveLesson(null);
    // Clear immediately so a slow/failed fetch never leaves the previous
    // course's modules rendered under this course's header.
    setModules([]);

    // Check if we have modules already cached from the initial prefetch
    const cachedModules: any[] | undefined = queryClient.getQueryData(["course-modules", course.id]);
    const prefetchModules = academicPrefetch?.modules?.filter((m: any) => m.course_id === course.id);
    const prefetchLessons = academicPrefetch?.lessons;

    if ((cachedModules && cachedModules.length > 0) || (prefetchModules && prefetchModules.length > 0)) {
      const modulesToUse = (cachedModules?.length ? cachedModules : prefetchModules) || [];
      // Build modules with lessons from prefetch lessons cache
      const modulesWithLessons = modulesToUse.map((m: any) => {
        const moduleLessons = prefetchLessons
          ? prefetchLessons.filter((l: any) => {
              if (l.module_id !== m.id) return false;
              const typeCode = (l.lesson_type?.code || "").toLowerCase();
              return typeCode !== "assignment" && typeCode !== "assessment";
            })
          : [];
        return { ...m, lessons: moduleLessons.map((l: any) => ({ ...l, resources: [] })) };
      });
      setModules(modulesWithLessons);
      return;
    }

    // Fallback: slow path — fetch from API only when cache is cold
    setLoading(true);
    try {
      const mRes = await listModulesAction(course.id);
      if (mRes.error) {
        showError(mRes.error);
        return;
      }
      if (mRes.modules) {
        const modulesWithLessons = await Promise.all(
          mRes.modules.map(async (m: any) => {
            const lRes = await listLessonsAction(m.id);
            const lessons = (lRes.lessons || [])
              .filter((l: any) => {
                const typeCode = (l.lesson_type?.code || "").toLowerCase();
                return typeCode !== "assignment" && typeCode !== "assessment";
              })
              .map((l: any) => ({ ...l, resources: [] }));
            return { ...m, lessons };
          })
        );
        setModules(modulesWithLessons);
      }
    } catch (err: any) {
      showError(err.message || "Failed to load course modules.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartLesson = async (lesson: any) => {
    setActiveLesson(lesson);
    if (!selectedCourse) return;
    
    setActionLoading(true);
    try {
      const res = await startOrUpdateLessonProgressAction(studentId, lesson.id, selectedCourse.id);
      if (res.progress) {
        setLessonProgressMap(prev => ({
          ...prev,
          [lesson.id]: res.progress
        }));
      }
    } catch (err: any) {
      showError(err.message || "Failed to start lesson.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteLesson = async (lesson: any) => {
    if (!selectedCourse) return;
    setActionLoading(true);

    // Keep the prior state so a rejected request can be reverted precisely.
    const previousProgress = lessonProgressMap[lesson.id];

    // Optimistically update progress to completed in local state map
    setLessonProgressMap(prev => ({
      ...prev,
      [lesson.id]: {
        ...prev[lesson.id],
        status_code: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString()
      }
    }));

    try {
      const res = await completeLessonProgressAction(studentId, lesson.id, selectedCourse.id);
      if (res.progress) {
        setLessonProgressMap(prev => ({
          ...prev,
          [lesson.id]: res.progress
        }));
        showSuccess(`Completed lesson: ${lesson.title}`);
        await refreshStudentData();
      } else if (res.error) {
        setLessonProgressMap(prev => ({
          ...prev,
          [lesson.id]: previousProgress
        }));
        showError(res.error);
      }
    } catch (err: any) {
      setLessonProgressMap(prev => ({
        ...prev,
        [lesson.id]: previousProgress
      }));
      showError(err.message || "Failed to complete lesson.");
    } finally {
      setActionLoading(false);
    }
  };

  // Resolves a lesson's video_url into the right embedded media presentation
  // (YouTube / direct file / PDF / generic external link), with an explicit
  // fallback so a malformed URL still renders something actionable.
  const renderLessonMedia = (lesson: any) => {
    if (!lesson?.video_url) return null;
    const url: string = lesson.video_url;

    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return (
        <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-855 shadow-sm mb-4">
          <iframe
            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={lesson.title}
          />
        </div>
      );
    }

    if (url.match(/\.(mp4|webm|ogg)/i) || url.includes("storage.googleapis.com") || url.includes("amazonaws.com")) {
      return (
        <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-855 shadow-sm mb-4">
          <video src={url} className="w-full h-full" controls preload="metadata" />
        </div>
      );
    }

    const lowerUrl = url.toLowerCase();
    const isPdf = lowerUrl.includes(".pdf") || lowerUrl.includes("/object/public/") || lowerUrl.includes("supabase") || lowerUrl.includes("drive.google.com");
    if (isPdf) {
      return (
        <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm h-[380px] sm:h-[480px] md:h-[600px] w-full flex flex-col mb-4">
          <div className="bg-[#16171D] border-b border-[#23252C] px-4 py-2.5 flex items-center justify-between text-[10px]">
            <span className="font-bold text-[#EDEFF5] flex items-center gap-1.5">
              <File size={13} className="text-[#6E79F4]" /> Embedded PDF Study Material
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6E79F4] hover:underline font-bold flex items-center gap-0.5"
            >
              Open in New Tab <ExternalLink size={10} />
            </a>
          </div>
          <iframe src={url} className="w-full h-full border-0" title={lesson.title} />
        </div>
      );
    }

    // Fallback: unrecognized URL shape — still give the student a way in
    // rather than silently mislabeling it.
    return (
      <div className="bg-slate-900 aspect-video rounded-xl flex flex-col items-center justify-center text-white p-6 text-center border border-slate-800 shadow-sm mb-4">
        <Play size={32} className="text-[#6E79F4] mb-2 fill-[#6E79F4]" />
        <p className="text-xs font-semibold mb-3">External Video Resource</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#6E79F4] hover:bg-[#6E79F4]/90 text-white font-bold text-[11px] px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
        >
          Play Video External Link <ExternalLink size={10} />
        </a>
      </div>
    );
  };

  // Shared status pill for assessment list/detail views (quiz, project, challenge,
  // and submission statuses) so each tab doesn't hand-roll its own color mapping.
  const StatusBadge = ({ status, size = "xs" }: { status: string | null | undefined; size?: "xs" | "sm" }) => {
    const normalized = (status || "assigned").toLowerCase();
    const isDone = ["completed", "reviewed", "passed", "accepted"].includes(normalized);
    const isActive = ["started", "submitted", "in_progress", "pending", "running"].includes(normalized);
    const isFailed = ["rejected", "failed"].includes(normalized);
    const isRevision = ["revision_requested", "revision", "rework"].includes(normalized);
    const style = isDone
      ? "bg-emerald-55/15 text-emerald-500 border-emerald-500/20"
      : isRevision
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : isFailed
      ? "bg-red-500/10 text-red-500 border-red-500/20"
      : isActive
      ? "bg-amber-50/15 text-amber-500 border-amber-500/25"
      : "bg-[#16171D] text-[#C2C6D1] border-[#23252C]";
    const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[8px]";
    return (
      <span className={`rounded font-bold border uppercase tracking-wide ${sizeClasses} ${style}`}>
        {normalized === "revision_requested" ? "revision required" : normalized.replace(/_/g, " ")}
      </span>
    );
  };

  // A project submission is locked from resubmission the moment it exists,
  // until a teacher rejects it or requests revision — mirrors the server-side
  // gate in submitProject() so the form can't be edited into a state the
  // backend will just reject anyway.
  const isProjectResubmitLocked = (submission: any, review: any) => {
    if (!submission) return false;
    return !(review?.review_status === "rejected" || review?.review_status === "revision_requested");
  };

  // Quiz interactive flows
  const handleEnterQuiz = async (activity: any) => {
    setSelectedQuizActivity(activity);
    setQuizSubmittedResult(null);
    setActiveAttempt(null);
    setSelectedAnswers({});
    // Clear the previous quiz's details so a failed fetch for this one
    // doesn't leave stale data rendered under the new activity's title.
    setQuizDetails(null);
    setQuizQuestions([]);
    setLoading(true);

    try {
      // 1. Fetch main quiz configuration
      const res = await getQuizDetailsAction(activity.id);
      if (res && "quiz" in res) {
        setQuizDetails(res.quiz);
        setQuizQuestions(res.questions || []);

        // 2. Check for any active (unfinished) attempt
        const activeRes = await getActiveQuizAttemptAction(res.quiz.id, studentId);
        if (activeRes.attempt) {
          // Unfinished attempt found, resume it and fetch shuffled session details
          const sessionRes = await getQuizSessionDetailsAction(activeRes.attempt.id);
          if (sessionRes && "questions" in sessionRes) {
            setQuizQuestions(sessionRes.questions);
            setActiveAttempt(sessionRes.attempt);
          }
        }
      } else if (res && "error" in res) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to load quiz details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!quizDetails) return;

    // Fullscreen must be requested synchronously within this click-triggered
    // handler (before any state that would burn an attempt) so the browser's
    // user-gesture requirement is preserved and a permission failure doesn't
    // cost the student an attempt.
    if (quizDetails.strict_mode) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        showError("Your browser blocked fullscreen mode. Please allow fullscreen and try again.");
        return;
      }
    }

    setActionLoading(true);
    try {
      const attemptNum = (selectedQuizActivity.progress?.attempt_number || 0) + 1;
      const res = await startQuizAttemptAction(quizDetails.id, studentId, selectedQuizActivity.progress?.id || "new", attemptNum);
      if (res.attempt) {
        // Fetch shuffled session questions for this attempt
        const sessionRes = await getQuizSessionDetailsAction(res.attempt.id);
        if (sessionRes && "questions" in sessionRes) {
          setQuizQuestions(sessionRes.questions);
          setActiveAttempt(sessionRes.attempt);
        } else {
          setActiveAttempt(res.attempt);
        }
        setSelectedAnswers({});

        if (quizDetails.strict_mode) {
          quizViolationCountRef.current = 0;
          attemptActiveRef.current = true;
          // Trap a history entry so the very next Back press can be caught
          // by the popstate listener instead of navigating away.
          window.history.pushState(null, "", window.location.href);
        }

        showSuccess("Quiz attempt started. Good luck!");
      } else if (res.error) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        showError(res.error);
      }
    } catch (err: any) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      showError(err.message || "Failed to start quiz.");
    } finally {
      setActionLoading(false);
    }
  };

  // Re-points selectedQuizActivity at the freshly refetched copy of itself so
  // the "Attempts Done" / status display reflects the attempt that was just
  // submitted/forfeited, instead of the stale snapshot captured when the
  // student originally clicked "Enter Quiz".
  const resyncSelectedQuizActivity = (freshActivities: any[] | undefined) => {
    if (!freshActivities || !selectedQuizActivity) return;
    const updated = freshActivities.find((a: any) => a.id === selectedQuizActivity.id);
    if (updated) setSelectedQuizActivity(updated);
  };

  const handleOptionSelect = (questionId: string, optionId: string, questionType?: string) => {
    setSelectedAnswers(prev => {
      const current = prev[questionId] || [];
      if (questionType === "multiple_choice") {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [questionId]: current.filter(id => id !== optionId)
          };
        } else {
          return {
            ...prev,
            [questionId]: [...current, optionId]
          };
        }
      } else {
        return {
          ...prev,
          [questionId]: [optionId]
        };
      }
    });
  };

  const handleSubmitQuiz = async () => {
    if (!activeAttempt || isSubmittingQuizRef.current) return;
    isSubmittingQuizRef.current = true;
    setActionLoading(true);
    try {
      const payload = Object.entries(selectedAnswers).flatMap(([qId, optIds]) =>
        optIds.map(optId => ({
          questionId: qId,
          selectedOptionId: optId
        }))
      );

      const res = await submitQuizAnswersAction(activeAttempt.id, payload);
      if (res.attempt) {
        attemptActiveRef.current = false;
        setQuizViolationWarning(null);
        setQuizSubmittedResult(res.attempt);
        setActiveAttempt(null);
        if (document.fullscreenElement) {
          try { await document.exitFullscreen(); } catch {}
        }
        showSuccess("Quiz submitted successfully!");
        resyncSelectedQuizActivity(await refreshStudentData());
      } else if (res.error) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to submit quiz.");
    } finally {
      setActionLoading(false);
      isSubmittingQuizRef.current = false;
    }
  };

  // Ends a strict-mode attempt with a zero score because the student left
  // the quiz environment (fullscreen exit / tab switch / back navigation)
  // either after the one-warning grace period expired, or on a second
  // violation after the warning was already used.
  const forfeitAttempt = async (reason: string) => {
    if (!activeAttemptRef.current || isSubmittingQuizRef.current) return;
    isSubmittingQuizRef.current = true;
    attemptActiveRef.current = false;
    setQuizViolationWarning(null);
    setActionLoading(true);
    try {
      const res = await forfeitQuizAttemptAction(activeAttemptRef.current.id, reason);
      if (res.attempt) {
        setQuizSubmittedResult(res.attempt);
        setActiveAttempt(null);
        if (document.fullscreenElement) {
          try { await document.exitFullscreen(); } catch {}
        }
        showError("Attempt forfeited — you left the quiz environment.");
        resyncSelectedQuizActivity(await refreshStudentData());
      } else if (res.error) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to forfeit quiz attempt.");
    } finally {
      setActionLoading(false);
      isSubmittingQuizRef.current = false;
    }
  };

  const registerViolation = (reason: string) => {
    if (!attemptActiveRef.current || isSubmittingQuizRef.current) return;
    if (quizViolationCountRef.current === 0) {
      quizViolationCountRef.current = 1;
      setQuizViolationWarning({ deadline: Date.now() + 15000 });
    } else {
      forfeitAttempt(reason);
    }
  };

  // Grace-period countdown: once a warning is shown, either the student
  // returns to fullscreen + a visible tab before the deadline (dismiss, no
  // reset — the one warning stays used), or the deadline passes and the
  // attempt is forfeited.
  useEffect(() => {
    if (!quizViolationWarning) return;

    const check = () => {
      const cleared = typeof document !== "undefined" && !!document.fullscreenElement && !document.hidden;
      if (cleared) {
        setQuizViolationWarning(null);
        return;
      }
      if (Date.now() >= quizViolationWarning.deadline) {
        forfeitAttempt("grace_period_expired");
        return;
      }
      setViolationTick(t => t + 1);
    };

    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [quizViolationWarning]);

  // Lockdown listeners for strict-mode attempts: fullscreen exit, tab
  // switch, and back-navigation are all violations; tab close fires a
  // best-effort beacon so the attempt closes out promptly server-side too.
  useEffect(() => {
    if (!activeAttempt || !quizDetails?.strict_mode) return;

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        registerViolation("fullscreen_exit");
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        registerViolation("tab_switch");
      }
    };
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      registerViolation("back_navigation");
    };
    const onPageHide = () => {
      if (attemptActiveRef.current && activeAttemptRef.current) {
        const blob = new Blob(
          [JSON.stringify({ attemptId: activeAttemptRef.current.id, reason: "tab_closed" })],
          { type: "application/json" }
        );
        navigator.sendBeacon("/api/quiz-forfeit", blob);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeAttempt, quizDetails]);

  // Countdown Timer logic for quizzes
  useEffect(() => {
    if (!activeAttempt || !quizDetails || !quizDetails.time_limit_minutes) {
      setTimeLeft(null);
      return;
    }

    const limitSeconds = quizDetails.time_limit_minutes * 60;
    const calculateTimeLeft = () => {
      const elapsedSeconds = Math.floor((new Date().getTime() - new Date(activeAttempt.started_at).getTime()) / 1000);
      const remaining = limitSeconds - elapsedSeconds;
      return remaining > 0 ? remaining : 0;
    };

    // Initialize
    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (isSubmittingQuizRef.current) return;
        isSubmittingQuizRef.current = true;
        // Auto-submit when timer expires
        setActionLoading(true);
        const payload = Object.entries(selectedAnswersRef.current).flatMap(([qId, optIds]) =>
          optIds.map(optId => ({
            questionId: qId,
            selectedOptionId: optId
          }))
        );
        submitQuizAnswersAction(activeAttempt.id, payload)
          .then(async (res) => {
            if (res.attempt) {
              attemptActiveRef.current = false;
              setQuizViolationWarning(null);
              setQuizSubmittedResult(res.attempt);
              setActiveAttempt(null);
              if (document.fullscreenElement) {
                try { await document.exitFullscreen(); } catch {}
              }
              showSuccess("Time limit reached. Quiz automatically submitted.");
              resyncSelectedQuizActivity(await refreshStudentData());
            } else if (res.error) {
              showError(res.error);
              setActiveAttempt(null);
            }
          })
          .catch((err: any) => {
            showError(err.message || "Failed to auto-submit quiz.");
          })
          .finally(() => {
            setActionLoading(false);
            isSubmittingQuizRef.current = false;
          });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAttempt, quizDetails]);

  // Load associated activity and project details when active lesson changes
  useEffect(() => {
    async function loadLessonActivity() {
      if (!activeLesson) {
        setLessonProjectDetails(null);
        setLessonProjectSubmission(null);
        setLessonProjectReview(null);
        setLessonGithubUrl("");
        setLessonSubmissionNotes("");
        return;
      }

      const typeCode = activeLesson.lesson_type?.code?.toLowerCase() || "";
      const isAssignmentType = typeCode === "assignment" || typeCode === "assessment";

      let assocAct = activities.find((a: any) => a.lesson_id === activeLesson.id);

      // Dynamically auto-provision activity/project if it's an assignment/assessment but has no learning activity yet
      if (!assocAct && isAssignmentType && selectedCourse) {
        setActionLoading(true);
        try {
          const provisionRes = await ensureLessonProjectActivityAction(activeLesson.id, studentId, selectedCourse.id);
          if (provisionRes && !("error" in provisionRes)) {
            // Reload the activities from database
            const reloadRes = await getStudentAssignedActivitiesAction(studentId);
            if (reloadRes.activities) {
              setActivities(reloadRes.activities);
              assocAct = reloadRes.activities.find((a: any) => a.lesson_id === activeLesson.id);
            }
          }
        } catch (err) {
          console.error("Failed to provision assignment/assessment activity on the fly:", err);
        } finally {
          setActionLoading(false);
        }
      }

      if (assocAct && (assocAct.activity_type_code === "project" || assocAct.activity_type_code === "assignment")) {
        setActionLoading(true);
        try {
          const pRes = await getProjectDetailsAction(assocAct.id, studentId);
          if (pRes && "project" in pRes) {
            setLessonProjectDetails(pRes.project);
            setLessonProjectSubmission(pRes.submission);
            setLessonProjectReview(pRes.review);
            if (pRes.submission) {
              setLessonGithubUrl(pRes.submission.github_url || "");
              setLessonSubmissionNotes(pRes.submission.submission_notes || "");
            } else {
              setLessonGithubUrl("");
              setLessonSubmissionNotes("");
            }
          }
        } catch (err) {
          console.error("Failed to load project details for active lesson:", err);
        } finally {
          setActionLoading(false);
        }
      } else {
        setLessonProjectDetails(null);
        setLessonProjectSubmission(null);
        setLessonProjectReview(null);
        setLessonGithubUrl("");
        setLessonSubmissionNotes("");
      }
    }
    loadLessonActivity();
  }, [activeLesson, activities, studentId, selectedCourse]);

  const handleLessonSubmitProjectUrl = async () => {
    const assocAct = activities.find((a: any) => a.lesson_id === activeLesson.id);
    if (!assocAct || !lessonGithubUrl.trim() || !lessonProjectDetails) return;
    
    if (!lessonGithubUrl.trim().startsWith("https://github.com/")) {
      showError("Please provide a valid GitHub repository URL (starts with https://github.com/).");
      return;
    }

    setActionLoading(true);

    try {
      const res = await submitProjectAction(
        lessonProjectDetails.id,
        studentId,
        assocAct.progress?.id || "new",
        lessonGithubUrl,
        lessonSubmissionNotes
      );

      if (res.submission) {
        setLessonProjectSubmission(res.submission);
        // A resubmission clears any prior review server-side (see
        // submitProject) — drop the stale one from local state too so an
        // old approved/rejected verdict doesn't linger on screen.
        setLessonProjectReview(null);

        // Auto-complete the lesson progress in syllabus
        if (selectedCourse) {
          await completeLessonProgressAction(studentId, activeLesson.id, selectedCourse.id);
        }
        
        showSuccess("Assignment submitted successfully and marked as completed!");
        await refreshStudentData();
      } else if (res.error) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to submit assignment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Project interactive flows
  const handleEnterProject = async (activity: any) => {
    setSelectedProjectActivity(activity);
    setProjectDetails(null);
    setProjectSubmission(null);
    setProjectReview(null);
    setGithubUrl("");
    setSubmissionNotes("");
    setLoading(true);
    try {
      const res = await getProjectDetailsAction(activity.id, studentId);
      if (res && "project" in res) {
        setProjectDetails(res.project);
        setProjectSubmission(res.submission);
        setProjectReview(res.review);
        setGithubUrl(res.submission?.github_url || "");
        setSubmissionNotes(res.submission?.submission_notes || "");
      } else if (res && "error" in res) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to load project details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProjectUrl = async () => {
    if (!projectDetails) return;
    if (!githubUrl.trim().startsWith("https://github.com/")) {
      showError("Please provide a valid GitHub repository URL (starts with https://github.com/).");
      return;
    }
    setActionLoading(true);
    try {
      const res = await submitProjectAction(
        projectDetails.id,
        studentId,
        selectedProjectActivity.progress?.id || "new",
        githubUrl,
        submissionNotes
      );
      if (res.submission) {
        setProjectSubmission(res.submission);
        // A resubmission clears any prior review server-side (see
        // submitProject) — drop the stale one from local state too so an
        // old approved/rejected verdict doesn't linger on screen.
        setProjectReview(null);
        showSuccess("Project submitted successfully for mentor review!");
        await refreshStudentData();
      } else if (res.error) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to submit project.");
    } finally {
      setActionLoading(false);
    }
  };

  // Programming challenge flows
  const handleEnterChallenge = async (activity: any) => {
    setSelectedChallengeActivity(activity);
    setSelectedSubmissionForResults(null);
    setSubmissionResults(null);
    setChallengeDetails(null);
    setChallengeExamples([]);
    setChallengeSubmissions([]);
    setEditorCode("");
    setLoading(true);
    try {
      const res = await getProgrammingChallengeDetailsAction(activity.id, studentId);
      if (res && "challenge" in res) {
        setChallengeDetails(res.challenge);
        setChallengeExamples(res.examples || []);
        setChallengeSubmissions(res.submissions || []);
        setEditorCode(res.challenge.starter_code || "");
      } else if (res && "error" in res) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to load challenge details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitChallenge = async () => {
    if (!challengeDetails) return;
    if (!editorCode.trim()) {
      showError("Source code cannot be blank.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await submitChallengeCodeAction(
        challengeDetails.id,
        studentId,
        selectedChallengeActivity.progress?.id || "new",
        editorLanguage,
        editorCode
      );
      if (res.submission) {
        showSuccess("Code submitted successfully. Added to execution queue!");
        // Reload submissions list
        const updatedData = await getProgrammingChallengeDetailsAction(selectedChallengeActivity.id, studentId);
        if (updatedData && "submissions" in updatedData) {
          setChallengeSubmissions(updatedData.submissions || []);
        }
        await refreshStudentData();
      } else if (res.error) {
        showError(res.error);
      }
    } catch (err: any) {
      showError(err.message || "Failed to submit challenge code.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewSubmissionResults = async (sub: any) => {
    setSelectedSubmissionForResults(sub);
    setLoading(true);
    try {
      const res = await getChallengeSubmissionResultsAction(sub.id);
      setSubmissionResults(res);
    } catch (err: any) {
      showError(err.message || "Failed to load submission results.");
    } finally {
      setLoading(false);
    }
  };

  // Quick stats calculations
  const activeCohortIds = selectedCohort ? [selectedCohort.id] : [];
  const programActivities = activities.filter(a => activeCohortIds.includes(a.assignment?.cohort_id));
  const activeCoursesList = selectedCohort?.courses || [];

  const totalEnrolledCourses = activeCoursesList.length;
  const inProgressCourses = activeCoursesList.filter((c: any) => c.progress?.status_code === "in_progress").length;
  const completedCourses = activeCoursesList.filter((c: any) => c.progress?.status_code === "completed").length;

  const quizCount = programActivities.filter(a => a.activity_type_code === "quiz").length;
  const projectCount = programActivities.filter(a => a.activity_type_code === "project" || a.activity_type_code === "assignment").length;
  const challengeCount = programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming").length;

  const completedActivities = programActivities.filter(a => a.progress?.status_code === "completed" || a.progress?.status_code === "reviewed").length;
  const pendingActivities = programActivities.length - completedActivities;

  // Programming challenges specific stats
  const challengeActivities = programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming");
  const assignedChallengesCount = challengeActivities.length;
  const completedChallengesCount = challengeActivities.filter(a => a.progress?.status_code === "completed" || a.progress?.status_code === "reviewed").length;
  const pendingChallengesCount = assignedChallengesCount - completedChallengesCount;
  
  const challengeScores = challengeActivities.map(a => a.progress?.score).filter(s => s !== null && s !== undefined).map(Number);
  const averageChallengeScore = challengeScores.length > 0 ? (challengeScores.reduce((a, b) => a + b, 0) / challengeScores.length).toFixed(1) : "0.0";
  
  // Recent submissions/updates from activities
  const recentSubmissions = [...challengeActivities]
    .filter(a => a.progress?.status_code !== "assigned")
    .sort((a, b) => new Date(b.progress?.updated_at || b.progress?.submitted_at || 0).getTime() - new Date(a.progress?.updated_at || a.progress?.submitted_at || 0).getTime())
    .slice(0, 3);

  // Best candidate course to resume: prefer one already in progress, then any
  // partially completed course, then the first untouched course.
  const continueCourse =
    activeCoursesList.find((c: any) => c.progress?.status_code === "in_progress") ||
    activeCoursesList.find((c: any) => {
      const pct = c.progress?.progress_percentage || 0;
      return pct > 0 && pct < 100;
    }) ||
    activeCoursesList.find((c: any) => (c.progress?.progress_percentage || 0) === 0) ||
    null;

  if (studentDeliveryError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load your student dashboard. {studentDeliveryError.message}</div>;
  }

  return (
    <>
      <DashboardLoader loading={loadingStudentDelivery} message="Setting up your Student Hub..." />
      {quizViolationWarning && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131418] rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 border-4 border-[#F0555D]">
            <ShieldAlert size={48} className="text-[#F0555D] mx-auto animate-pulse" />
            <div>
              <h3 className="font-bold text-sm text-[#F0555D] uppercase tracking-wide">Quiz Environment Violation Detected</h3>
              <p className="text-[#C2C6D1] text-xs mt-2 leading-relaxed">
                You left fullscreen mode or switched away from the quiz. Return within{" "}
                <span className="font-mono font-bold text-[#F0555D]">
                  {Math.max(0, Math.ceil((quizViolationWarning.deadline - Date.now()) / 1000))}s
                </span>{" "}
                or your attempt will be forfeited with a score of 0. This is your only warning.
              </p>
            </div>
            <button
              onClick={() => {
                document.documentElement.requestFullscreen().catch(() => {});
              }}
              className="bg-[#F0555D] text-white px-5 py-2.5 rounded-lg shadow-sm font-bold hover:bg-[#F0555D]/90 transition-all text-xs flex items-center gap-1.5 justify-center w-full"
            >
              <Maximize2 size={13} /> Return to Fullscreen &amp; Continue
            </button>
          </div>
        </div>
      )}
      <AppShell
        portalLabel="Student Hub"
        pageTitle={
          activeParentTab === "overview"
            ? "Overview"
            : activeParentTab === "curriculum"
            ? "Syllabus"
            : activeTab === "projects"
            ? "Projects"
            : "Quizzes"
        }
        items={[
          { id: "overview", label: "Overview", icon: Building },
          { id: "curriculum", label: "Syllabus", icon: BookOpen, badge: selectedCohort?.courses?.length || 0 },
          {
            id: "assessments",
            label: "Assessments",
            icon: Award,
            children: [
              { id: "quizzes", label: "Quizzes", badge: quizCount },
              { id: "projects", label: "Projects", badge: projectCount },
              { id: "challenges", label: "Code Challenges", badge: challengeCount },
            ],
          },
        ]}
        activeId={activeParentTab}
        activeChildId={activeTab}
        onSelect={(id, childId) => {
          if (id === "overview") {
            setActiveParentTab("overview");
            setActiveTab("overview");
            setSelectedCourse(null);
            setActiveLesson(null);
          } else if (id === "curriculum") {
            setActiveParentTab("curriculum");
            setActiveTab("academics");
            setSelectedCourse(null);
            setActiveLesson(null);
          } else if (id === "assessments") {
            if (childId === "challenges") {
              window.location.href = "/student/programming";
              return;
            }
            setActiveParentTab("assessments");
            setActiveTab(childId === "projects" ? "projects" : "quizzes");
            setSelectedQuizActivity(null);
            setSelectedProjectActivity(null);
            setSelectedChallengeActivity(null);
          }
        }}
        userName={fullName}
        userMeta={institution ? institution.name : "Public Cohort"}
        headerActions={
          <div className="relative" ref={cohortDropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl hover:border-[#6E79F4]/40 hover:bg-[#6E79F4]/5 transition-all text-[11px] font-bold text-[#EDEFF5] cursor-pointer max-w-[220px] sm:max-w-[320px]"
            >
              <GraduationCap size={14} className="text-[#6E79F4] shrink-0" />
              <span className="truncate">
                {selectedCohort ? `${selectedCohort.name} (${selectedCohort.code})` : "No Active Group"}
              </span>
              <ChevronDown size={13} className="text-[#A3A9B6] shrink-0" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-[#131418] border border-[#23252C] rounded-xl shadow-card z-50 py-1.5 animate-fadeIn">
                <div className="px-4 py-1.5 border-b border-[#23252C] text-[9px] font-bold text-[#A3A9B6] uppercase tracking-wider">
                  Switch Active Group / Cohort
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {(() => {
                    const flatCohorts: any[] = [];
                    programs.forEach(p => {
                      if (p.cohorts) {
                        p.cohorts.forEach((c: any) => {
                          if (!flatCohorts.some(item => item.id === c.id)) {
                            flatCohorts.push({
                              ...c,
                              programId: p.id,
                              programTitle: p.title,
                              courses: p.courses ? p.courses.filter((course: any) => course.cohort_id === c.id) : []
                            });
                          }
                        });
                      }
                    });

                    if (flatCohorts.length > 0) {
                      return flatCohorts.map((coh) => (
                        <button
                          key={coh.id}
                          onClick={() => {
                            handleSelectCohort(coh);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-[#16171D] transition-all flex flex-col gap-0.5 text-xs cursor-pointer ${
                            selectedCohort?.id === coh.id ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#C2C6D1]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold truncate min-w-0 flex-1">{coh.name} ({coh.code})</span>
                            {selectedCohort?.id === coh.id && <CheckCircle2 size={13} className="text-[#6E79F4] shrink-0" />}
                          </div>
                          <span className="text-[9px] text-[#A3A9B6] truncate font-medium">Program: {coh.programTitle}</span>
                        </button>
                      ));
                    }
                    return <div className="px-4 py-3 text-xs text-[#C2C6D1]">No groups available.</div>;
                  })()}
                </div>
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden animate-pageIn">

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">

            {/* Header Greeting Block */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#151725] via-[#12131A] to-[#0E0F13] border border-[#23252C] p-6 sm:p-7 rounded-2xl shadow-card flex flex-col gap-6">
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#6E79F4]/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-[#2FBF71]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div className="space-y-1.5 w-full md:w-auto min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#131418]/10 text-white border border-white/15 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm">
                      Student Hub
                    </span>
                    {selectedCohort && (
                      <span className="text-[10px] text-slate-300 font-semibold">
                        • {selectedCohort.name} ({selectedCohort.code})
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-1">
                    Welcome back, {fullName.split(" ")[0]}! 👋
                  </h1>
                  <p className="text-xs text-slate-300 font-medium max-w-xl">
                    {continueCourse
                      ? `You're ${continueCourse.progress?.progress_percentage || 0}% through "${continueCourse.title}". Keep the momentum going.`
                      : "Track your modules, review pending assignments, and explore your batch curriculum."}
                  </p>
                </div>

                {continueCourse && (
                  <button
                    onClick={async () => {
                      await handleSelectCourse(continueCourse);
                      setActiveParentTab("curriculum");
                      setActiveTab("academics");
                    }}
                    className="relative z-10 flex items-center gap-2 bg-[#6E79F4] hover:bg-[#3B82F6] text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shrink-0"
                  >
                    <Play size={13} className="fill-white" />
                    <span>Continue Learning</span>
                  </button>
                )}
              </div>

              {/* Quick action pills */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                {[
                  { label: "Syllabus", icon: BookOpen, onClick: () => { setActiveParentTab("curriculum"); setActiveTab("academics"); } },
                  { label: "Quizzes", icon: FileQuestion, onClick: () => { setActiveParentTab("assessments"); setActiveTab("quizzes"); setSelectedQuizActivity(null); } },
                  { label: "Projects", icon: Award, onClick: () => { setActiveParentTab("assessments"); setActiveTab("projects"); setSelectedProjectActivity(null); } },
                  { label: "Code Challenges", icon: Code, onClick: () => { setActiveParentTab("assessments"); setActiveTab("challenges"); setSelectedChallengeActivity(null); } },
                ].map((pill) => (
                  <button
                    key={pill.label}
                    onClick={pill.onClick}
                    className="mt-2 flex items-center gap-1.5 bg-[#131418]/5 hover:bg-[#131418]/10 border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    <pill.icon size={12} /> {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Glowing Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  key: "progress",
                  label: "Program Progress",
                  icon: BookOpen,
                  color: "#6E79F4",
                  value: activeCoursesList.length > 0
                    ? `${Math.round(activeCoursesList.reduce((acc: number, c: any) => acc + (c.progress?.progress_percentage || 0), 0) / activeCoursesList.length)}%`
                    : "0%",
                  caption: "Overall Completion Rate",
                },
                {
                  key: "active-courses",
                  label: "Active Courses",
                  icon: Clock,
                  color: "#F5B04A",
                  value: `${inProgressCourses} / ${totalEnrolledCourses}`,
                  caption: "Courses in Progress",
                },
                {
                  key: "completed-tasks",
                  label: "Completed Tasks",
                  icon: Award,
                  color: "#2FBF71",
                  value: `${completedActivities} Done`,
                  caption: "Assessments Completed",
                },
                {
                  key: "pending-tasks",
                  label: "Pending Work",
                  icon: FileQuestion,
                  color: "#22D3EE",
                  value: `${pendingActivities} Tasks`,
                  caption: "Awaiting Submission",
                },
              ].map((stat) => (
                <div
                  key={stat.key}
                  className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-subtle space-y-3 hover:shadow-md hover:border-[#6E79F4]/15 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#C2C6D1] font-bold uppercase tracking-wider">{stat.label}</span>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${stat.color}1A`, color: stat.color }}>
                      <stat.icon size={16} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#EDEFF5] leading-tight">{stat.value}</h3>
                    <p className="text-[10px] text-[#C2C6D1] font-semibold mt-0.5">{stat.caption}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Split Grid Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left 2 Columns: Continue Learning, Enrolled Courses & Challenges */}
              <div className="lg:col-span-2 space-y-6">

                {/* Continue Learning spotlight */}
                {continueCourse && (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                      <div className="relative w-14 h-14 shrink-0">
                        <svg viewBox="0 0 40 40" className="w-14 h-14 -rotate-90">
                          <circle cx="20" cy="20" r="16" fill="none" stroke="#23252C" strokeWidth="4" />
                          <circle
                            cx="20" cy="20" r="16" fill="none"
                            stroke="#6E79F4" strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${(2 * Math.PI * 16 * (continueCourse.progress?.progress_percentage || 0)) / 100} ${2 * Math.PI * 16}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#EDEFF5]">
                          {continueCourse.progress?.progress_percentage || 0}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#6E79F4]">Continue Learning</p>
                        <h3 className="font-bold text-sm text-[#EDEFF5] truncate">{continueCourse.title}</h3>
                        <p className="text-[10px] text-[#C2C6D1] mt-0.5">
                          Lessons {continueCourse.progress?.completed_lessons || 0}/{continueCourse.progress?.total_lessons || 0}
                          {(continueCourse.progress?.completed_lessons || 0) >= (continueCourse.progress?.total_lessons || 0) && (continueCourse.progress?.progress_percentage || 0) < 100
                            ? " • assessments pending"
                            : " completed"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await handleSelectCourse(continueCourse);
                        setActiveParentTab("curriculum");
                        setActiveTab("academics");
                      }}
                      className="bg-[#6E79F4] hover:bg-[#6E79F4]/90 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer shrink-0 w-full sm:w-auto"
                    >
                      Resume
                    </button>
                  </div>
                )}

                {/* Enrolled Courses list */}
                {totalEnrolledCourses > 0 ? (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-4 sm:p-5 shadow-subtle space-y-4">
                    <div className="flex items-center justify-between border-b border-[#23252C] pb-3">
                      <h3 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider flex items-center gap-2">
                        <BookOpenCheck className="text-[#6E79F4]" size={14} /> Enrolled Courses
                      </h3>
                      <span className="text-[10px] text-[#C2C6D1] font-bold">
                        {totalEnrolledCourses} Course{totalEnrolledCourses > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {activeCoursesList.map((course: any) => {
                        const pct = course.progress?.progress_percentage || 0;
                        return (
                          <button
                            key={course.id}
                            onClick={async () => {
                              await handleSelectCourse(course);
                              setActiveParentTab("curriculum");
                              setActiveTab("academics");
                            }}
                            className="w-full text-left border border-[#23252C] hover:border-[#6E79F4]/25 hover:bg-[#16171D]/50 rounded-xl p-3 space-y-2 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#EDEFF5] truncate min-w-0 flex-1">{course.title}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${pct === 100 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct === 100 ? "bg-[#2FBF71]" : "bg-[#6E79F4]"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-[#C2C6D1] font-semibold">
                              <span className="capitalize">{(course.progress?.status_code || "Not Started").replace("_", " ")}</span>
                              <span>Lessons {course.progress?.completed_lessons || 0}/{course.progress?.total_lessons || 0}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-8 text-center shadow-subtle space-y-2">
                    <p className="text-sm font-semibold text-[#EDEFF5]">No study curriculum found</p>
                    <p className="text-xs text-[#C2C6D1]">You are not currently enrolled in any active cohorts.</p>
                  </div>
                )}

              </div>

              {/* Right Column: Pending tasks, attendance & performance */}
              <div className="space-y-6">

                {/* Attendance Overview card */}
                {selectedCohort && (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-4 sm:p-5 shadow-subtle space-y-4">
                    <h3 className="text-xs font-bold text-[#EDEFF5] border-b border-[#23252C] pb-3 flex items-center gap-2 uppercase tracking-wider">
                      <Calendar className="text-[#6E79F4]" size={14} /> Attendance Overview
                    </h3>

                    {loadingAttendance ? (
                      <div className="space-y-2">
                        <div className="h-6 bg-[#1A1C22] animate-pulse rounded-lg w-1/3"></div>
                        <div className="h-2 bg-[#1A1C22] animate-pulse rounded-full"></div>
                      </div>
                    ) : attendancePercentage !== null ? (
                      <>
                        <div className="flex items-end justify-between">
                          <div>
                            <span
                              className={`text-2xl font-bold leading-none ${
                                attendancePercentage >= 75 ? "text-[#2FBF71]" : attendancePercentage >= 50 ? "text-[#F5B04A]" : "text-red-500"
                              }`}
                            >
                              {Math.round(attendancePercentage)}%
                            </span>
                            <p className="text-[10px] text-[#C2C6D1] font-semibold mt-1">Present across {attendanceLogs.length} session{attendanceLogs.length !== 1 ? "s" : ""}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${
                              attendancePercentage >= 75
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : attendancePercentage >= 50
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-red-50 text-red-700 border-red-100"
                            }`}
                          >
                            {attendancePercentage >= 75 ? "Good Standing" : attendancePercentage >= 50 ? "At Risk" : "Low Attendance"}
                          </span>
                        </div>
                        <div className="w-full bg-[#23252C] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              attendancePercentage >= 75 ? "bg-[#2FBF71]" : attendancePercentage >= 50 ? "bg-[#F5B04A]" : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
                          />
                        </div>

                      </>
                    ) : (
                      <div className="text-center py-6 bg-[#16171D]/20 rounded-xl border border-dashed border-[#23252C] text-[10px] text-[#C2C6D1] font-medium">
                        No attendance records found for this group yet.
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: ACADEMICS / SYLLABUS VIEWER */}
        {activeTab === "academics" && (
          <div className="space-y-6 w-full max-w-full overflow-hidden">
            {!selectedCohort ? (
              <div className="text-center py-8 text-[#C2C6D1] font-medium bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm">
                You are not currently enrolled in any active groups. Please contact your administrator.
              </div>
            ) : !selectedCourse ? (
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 w-full max-w-full overflow-hidden">
                <div className="flex items-center gap-2 text-xs border-b border-[#23252C] pb-3 mb-3">
                  <span className="font-bold text-[#EDEFF5]">Courses under {selectedCohort.name} ({selectedCohort.code})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeCoursesList.length > 0 ? (
                    activeCoursesList.map((course: any) => {
                      const pct = course.progress?.progress_percentage || 0;
                      return (
                      <div
                        key={course.id}
                        onClick={() => handleSelectCourse(course)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open course ${course.title}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectCourse(course);
                          }
                        }}
                        className="group bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#6E79F4]/25 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6E79F4]/40 transition-all duration-200 flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="relative w-11 h-11 shrink-0">
                              <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
                                <circle cx="20" cy="20" r="16" fill="none" stroke="#23252C" strokeWidth="4" />
                                <circle
                                  cx="20" cy="20" r="16" fill="none"
                                  stroke="#6E79F4" strokeWidth="4" strokeLinecap="round"
                                  strokeDasharray={`${(2 * Math.PI * 16 * pct) / 100} ${2 * Math.PI * 16}`}
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[#EDEFF5]">
                                {pct}%
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#16171D] text-[#C2C6D1] border-[#23252C]">
                              {course.course_type}
                            </span>
                          </div>

                          <h3 className="font-bold text-xs text-[#EDEFF5] mb-1">{course.title}</h3>
                          <p className="text-[10px] text-[#C2C6D1] line-clamp-2 leading-relaxed mb-4">
                            {course.description || "No course description provided."}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#23252C] text-[10px] text-[#C2C6D1]">
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {course.duration_minutes || 0} mins
                          </span>
                          <span className="flex items-center gap-1.5 font-bold text-white bg-[#6E79F4] group-hover:bg-[#6E79F4]/90 px-3 py-1.5 rounded-lg transition-colors">
                            {pct > 0 ? "Continue" : "Start Learning"} <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center py-8 text-[#C2C6D1] font-medium bg-[#16171D]/20 rounded-xl">
                      No assigned courses registered under this program.
                    </div>
                  )}
                </div>
              </div>
            ) : (() => {
              const flatCourseLessons = modules.flatMap((m: any) => m.lessons || []);
              const totalCourseLessons = flatCourseLessons.length;
              const completedCourseLessons = flatCourseLessons.filter((l: any) => lessonProgressMap[l.id]?.status_code === "completed").length;
              const currentLessonIdx = activeLesson ? flatCourseLessons.findIndex((l: any) => l.id === activeLesson.id) : -1;
              const prevLesson = currentLessonIdx > 0 ? flatCourseLessons[currentLessonIdx - 1] : null;
              const nextLesson = currentLessonIdx >= 0 && currentLessonIdx < flatCourseLessons.length - 1 ? flatCourseLessons[currentLessonIdx + 1] : null;
              const coursePct = totalCourseLessons > 0 ? Math.round((completedCourseLessons / totalCourseLessons) * 100) : (selectedCourse.progress?.progress_percentage || 0);

              const syllabusPanel = (
                <>
                  <div className="p-4 border-b border-[#23252C] shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-xs text-[#EDEFF5] truncate min-w-0 flex-1">{selectedCourse.title}</h3>
                      <button
                        onClick={() => setIsSyllabusDrawerOpen(false)}
                        className="lg:hidden shrink-0 text-[#C2C6D1] hover:text-[#EDEFF5] cursor-pointer p-1"
                        aria-label="Close syllabus"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#C2C6D1] font-bold mt-2">
                      <span>{totalCourseLessons > 0 ? `${completedCourseLessons}/${totalCourseLessons} lessons` : "No lessons yet"}</span>
                      <span>{coursePct}%</span>
                    </div>
                    <div className="w-full bg-[#23252C] h-1 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-[#6E79F4] h-full rounded-full transition-all duration-300" style={{ width: `${coursePct}%` }} />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {loading ? (
                      <div className="flex flex-col gap-3">
                        <div className="h-10 bg-[#1A1C22] animate-pulse rounded-lg"></div>
                        <div className="h-10 bg-[#1A1C22] animate-pulse rounded-lg"></div>
                        <div className="h-10 bg-[#1A1C22] animate-pulse rounded-lg"></div>
                      </div>
                    ) : modules.length > 0 ? (
                      modules.map((mod) => (
                        <div key={mod.id} className="mb-4 last:mb-0">
                          <p className="bg-[#16171D] rounded-md px-2 py-1.5 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-[#C2C6D1] truncate">
                            Module {mod.position} · {mod.title}
                          </p>
                          <div className="space-y-1">
                            {mod.lessons && mod.lessons.length > 0 ? (
                              mod.lessons.map((les: any) => {
                                const progState = lessonProgressMap[les.id];
                                const isCompleted = progState?.status_code === "completed";
                                const isInProgress = progState?.status_code === "in_progress";
                                const isActive = activeLesson?.id === les.id;
                                return (
                                  <div
                                    key={les.id}
                                    onClick={() => {
                                      handleStartLesson(les);
                                      setIsSyllabusDrawerOpen(false);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open lesson ${les.title}${isCompleted ? " (completed)" : isInProgress ? " (in progress)" : ""}`}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleStartLesson(les);
                                        setIsSyllabusDrawerOpen(false);
                                      }
                                    }}
                                    className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6E79F4]/40 ${
                                      isActive
                                        ? "bg-[#6E79F4]/10 ring-1 ring-[#6E79F4]/20"
                                        : "hover:bg-[#16171D]"
                                    }`}
                                  >
                                    <div className="shrink-0" aria-hidden="true">
                                      {isCompleted ? (
                                        <CheckCircle2 size={15} className="text-[#2FBF71]" />
                                      ) : isInProgress ? (
                                        <Circle size={15} className="text-[#F5B04A] fill-[#F5B04A]/10 animate-pulse" />
                                      ) : (
                                        <Circle size={15} className="text-[#C9CDD8]" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-[11px] font-semibold truncate ${isActive ? "text-[#6E79F4]" : isCompleted ? "text-[#C2C6D1] line-through" : "text-[#EDEFF5]"}`}>
                                        {les.title}
                                      </p>
                                      <p className="text-[9px] text-[#C2C6D1] font-mono">{les.duration || 0} mins</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-[9px] text-[#C2C6D1] italic px-1.5 py-1">No lessons in this module.</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-[10px] text-[#C2C6D1] font-medium">
                        No curriculum modules have been defined for this course.
                      </div>
                    )}
                  </div>
                </>
              );

              return (
              <div className="w-full max-w-full">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <button
                    onClick={() => {
                      setSelectedCourse(null);
                      setActiveLesson(null);
                    }}
                    className="text-[#6E79F4] hover:underline flex items-center gap-1 font-bold cursor-pointer text-xs shrink-0"
                  >
                    <ChevronLeft size={14} /> Courses
                  </button>
                  <button
                    onClick={() => setIsSyllabusDrawerOpen(true)}
                    className="lg:hidden flex items-center gap-1.5 bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#EDEFF5] shadow-2xs cursor-pointer"
                  >
                    <Menu size={13} /> Syllabus ({completedCourseLessons}/{totalCourseLessons})
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 lg:items-start w-full max-w-full">

                  {/* Persistent left sidebar (desktop) */}
                  <div className="hidden lg:flex lg:flex-col w-[300px] shrink-0 bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm sticky top-4 max-h-[calc(100vh-32px)] overflow-hidden">
                    {syllabusPanel}
                  </div>

                  {/* Mobile drawer overlay */}
                  {isSyllabusDrawerOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                      <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setIsSyllabusDrawerOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-[#131418] shadow-xl flex flex-col overflow-hidden animate-fadeIn">
                        {syllabusPanel}
                      </div>
                    </div>
                  )}

                  {/* Main content area: lesson player */}
                  <div className="flex-1 min-w-0 w-full space-y-6">
                    {activeLesson ? (
                      <div className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm w-full overflow-hidden max-h-[calc(100vh-140px)] overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-[#131418]/95 backdrop-blur px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex items-center justify-between border-b border-[#23252C]">
                          <div className="min-w-0 flex-1">
                            <span className="bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/15 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                              {activeLesson.lesson_type?.description || "Theory Material"}
                            </span>
                            <h4 className="font-bold text-base text-[#EDEFF5] mt-2 tracking-tight truncate">{activeLesson.title}</h4>
                          </div>
                          {(() => {
                            const isCompleted = lessonProgressMap[activeLesson.id]?.status_code === "completed";
                            if (isCompleted) {
                              return (
                                <span className="bg-[#2FBF71]/15 text-[#2FBF71] border border-[#2FBF71]/25 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0 ml-3">
                                  <CheckCircle size={11} /> Completed
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="p-4 sm:p-6 pt-5 space-y-5">

                        {renderLessonMedia(activeLesson)}

                        {!activeLesson.video_url &&
                          !(activeLesson.content_json?.body || activeLesson.content_json?.text) &&
                          !(activeLesson.resources && activeLesson.resources.length > 0) &&
                          !["assignment", "assessment"].includes((activeLesson.lesson_type?.code || "").toLowerCase()) && (
                          <div className="bg-[#16171D]/50 border border-dashed border-[#23252C] rounded-xl p-6 text-center text-[#C2C6D1] font-medium text-xs">
                            No study material has been attached to this lesson yet. You can still mark it as completed once you've covered it with your instructor.
                          </div>
                        )}

                        {["assignment", "assessment"].includes((activeLesson.lesson_type?.code || "").toLowerCase()) && (
                          lessonProjectDetails ? (
                            <div className="border border-[#23252C] rounded-xl p-4 sm:p-5 space-y-4 bg-[#16171D]/20">
                              <h4 className="font-bold text-xs text-[#EDEFF5] flex items-center gap-1.5">
                                <FolderCode className="text-[#6E79F4]" size={14} /> Assignment Submission
                              </h4>

                              <div className="text-xs text-[#C2C6D1] leading-relaxed space-y-2">
                                {lessonProjectDetails.project_overview && <p>{lessonProjectDetails.project_overview}</p>}
                                {lessonProjectDetails.requirements && (
                                  <div>
                                    <p className="font-bold text-[#EDEFF5] text-[11px]">Requirements</p>
                                    <p className="whitespace-pre-line">{lessonProjectDetails.requirements}</p>
                                  </div>
                                )}
                                {lessonProjectDetails.deliverables && (
                                  <div>
                                    <p className="font-bold text-[#EDEFF5] text-[11px]">Deliverables</p>
                                    <p className="whitespace-pre-line">{lessonProjectDetails.deliverables}</p>
                                  </div>
                                )}
                              </div>

                              {lessonProjectSubmission && (
                                <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 text-[#2FBF71] rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                                  <CheckCircle2 size={12} />
                                  <span>Last Submitted: {new Date(lessonProjectSubmission.submitted_at).toLocaleString()}</span>
                                </div>
                              )}

                              {lessonProjectSubmission && !lessonProjectReview && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>
                                  <span>Your assignment has been submitted and is awaiting mentor review. Resubmission is locked until it's reviewed.</span>
                                </div>
                              )}

                              {lessonProjectReview?.review_status === "approved" && (
                                <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 text-[#2FBF71] rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                                  <CheckCircle2 size={13} />
                                  <span>This assignment has been approved — no resubmission needed.</span>
                                </div>
                              )}

                              {lessonProjectReview?.review_status === "revision_requested" && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                                  <AlertTriangle size={13} />
                                  <span>Your mentor requested revisions — see feedback below, then resubmit.</span>
                                </div>
                              )}

                              {(() => {
                                const locked = isProjectResubmitLocked(lessonProjectSubmission, lessonProjectReview);
                                return (
                                  <div className="space-y-3 text-xs">
                                    <div className="flex flex-col gap-1.5">
                                      <label htmlFor="lesson-github-url" className="font-bold text-[#EDEFF5]">GitHub Repository URL</label>
                                      <input
                                        id="lesson-github-url"
                                        type="text"
                                        value={lessonGithubUrl}
                                        onChange={(e) => setLessonGithubUrl(e.target.value)}
                                        disabled={locked}
                                        placeholder="https://github.com/username/repository"
                                        className="bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 w-full text-xs outline-none focus:border-[#6E79F4] transition-all disabled:bg-[#16171D] disabled:text-[#A3A9B6] disabled:cursor-not-allowed"
                                      />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                      <label htmlFor="lesson-submission-notes" className="font-bold text-[#EDEFF5]">Submission Notes (optional)</label>
                                      <textarea
                                        id="lesson-submission-notes"
                                        value={lessonSubmissionNotes}
                                        onChange={(e) => setLessonSubmissionNotes(e.target.value)}
                                        disabled={locked}
                                        placeholder="Write details or instructions for running the codebase here..."
                                        rows={3}
                                        className="bg-[#131418] border border-[#23252C] rounded-lg p-3 w-full text-xs outline-none focus:border-[#6E79F4] transition-all disabled:bg-[#16171D] disabled:text-[#A3A9B6] disabled:cursor-not-allowed"
                                      />
                                    </div>

                                    <button
                                      onClick={handleLessonSubmitProjectUrl}
                                      disabled={actionLoading || locked}
                                      className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#6E79F4]/95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {locked ? "Submission Locked" : "Submit Assignment"}
                                    </button>
                                  </div>
                                );
                              })()}

                              {lessonProjectReview && (() => {
                                const reviewColor = lessonProjectReview.review_status === "approved"
                                  ? "#2FBF71"
                                  : lessonProjectReview.review_status === "rejected"
                                  ? "#F0555D"
                                  : "#F5B04A";
                                return (
                                  <div className="border rounded-xl p-4 space-y-2" style={{ borderColor: `${reviewColor}33`, backgroundColor: `${reviewColor}0D` }}>
                                    <h4 className="font-bold text-[10px] uppercase tracking-wide" style={{ color: reviewColor }}>Mentor Review</h4>
                                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                                      <div>
                                        <span className="text-[9px] text-[#C2C6D1] block">Status</span>
                                        <span className="capitalize">{lessonProjectReview.review_status.replace(/_/g, " ")}</span>
                                      </div>
                                      <div>
                                        <span className="text-[9px] text-[#C2C6D1] block">Score</span>
                                        <span>{lessonProjectReview.score !== null ? `${lessonProjectReview.score} / ${lessonProjectDetails.max_score}` : "Not Graded"}</span>
                                      </div>
                                    </div>
                                    {lessonProjectReview.feedback && (
                                      <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C] text-[#C2C6D1]">
                                        <span className="text-[9px] font-bold text-[#EDEFF5] block mb-1">Mentor Feedback</span>
                                        <p className="italic">{lessonProjectReview.feedback}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="bg-[#16171D]/50 border border-dashed border-[#23252C] rounded-xl p-6 text-center text-[#C2C6D1] font-medium text-xs">
                              Preparing this assignment's submission form...
                            </div>
                          )
                        )}

                        {(activeLesson.content_json?.body || activeLesson.content_json?.text) && (
                          <div className="bg-[#131418] border border-[#23252C] p-4 sm:p-6 md:p-8 rounded-2xl shadow-subtle space-y-4">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5 border-b border-[#23252C] pb-3">
                              📖 Lesson Syllabus & Study Guide
                            </h4>
                            <div className="prose max-w-none text-[#E2E4EB] leading-relaxed text-[13px]">
                              <MarkdownRenderer content={activeLesson.content_json.body || activeLesson.content_json.text} />
                            </div>
                          </div>
                        )}

                        {activeLesson.resources && activeLesson.resources.length > 0 && (
                          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 space-y-3 shadow-2xs">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1">
                              <File size={11} className="text-[#A3A9B6]" /> Attached Reference Documents & Code blue prints
                            </p>
                            <div className="divide-y divide-[#23252C] text-xs">
                              {activeLesson.resources.map((res: any) => {
                                const downloadUrl = res.external_url || res.file_url || res.resource_url;
                                return (
                                  <div key={res.id} className="py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-[#EDEFF5]">{res.title}</span>
                                      <span className="px-1.5 py-0.2 bg-[#1A1C22] rounded text-[8px] text-[#C2C6D1] uppercase font-mono font-bold shrink-0">{res.resource_type || "File"}</span>
                                    </div>
                                    {downloadUrl && (
                                      <a 
                                        href={downloadUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[#6E79F4] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                                      >
                                        Open/Download <ExternalLink size={11} />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Lesson Completion Footer */}
                        <div className="border-t border-[#23252C] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                          <div>
                            <p className="text-[10px] text-[#C2C6D1] font-bold uppercase tracking-wider">Milestone Status</p>
                            <p className="text-xs text-[#EDEFF5] font-semibold mt-0.5">
                              {(() => {
                                const isCompleted = lessonProgressMap[activeLesson.id]?.status_code === "completed";
                                return isCompleted ? "You have successfully finished this lesson" : "Review the material above and mark it as completed";
                              })()}
                            </p>
                          </div>

                          <div>
                            {(() => {
                              const isCompleted = lessonProgressMap[activeLesson.id]?.status_code === "completed";
                              if (isCompleted) {
                                return (
                                  <span className="bg-[#2FBF71]/15 text-[#2FBF71] border border-[#2FBF71]/25 px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                                    <CheckCircle size={13} /> Lesson Completed
                                  </span>
                                );
                              }

                              return (
                                <button
                                  onClick={() => handleCompleteLesson(activeLesson)}
                                  disabled={actionLoading}
                                  className="bg-[#6E79F4] hover:bg-[#6E79F4]/95 text-white px-4.5 py-2.5 rounded-xl shadow-sm text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5 disabled:opacity-50 select-none"
                                >
                                  Mark Lesson as Completed
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Previous / Next lesson navigation */}
                        {(prevLesson || nextLesson) && (
                          <div className="flex items-center justify-between gap-3 border-t border-[#23252C] pt-4">
                            <button
                              onClick={() => prevLesson && handleStartLesson(prevLesson)}
                              disabled={!prevLesson}
                              className="flex items-center gap-1.5 text-[10px] font-bold text-[#C2C6D1] hover:text-[#6E79F4] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer min-w-0"
                            >
                              <ChevronLeft size={14} className="shrink-0" />
                              <span className="truncate max-w-[110px] sm:max-w-[180px]">{prevLesson?.title || "Previous"}</span>
                            </button>
                            <button
                              onClick={() => nextLesson && handleStartLesson(nextLesson)}
                              disabled={!nextLesson}
                              className="flex items-center gap-1.5 text-[10px] font-bold text-[#6E79F4] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer min-w-0"
                            >
                              <span className="truncate max-w-[110px] sm:max-w-[180px]">{nextLesson?.title || "Next"}</span>
                              <ChevronRight size={14} className="shrink-0" />
                            </button>
                          </div>
                        )}

                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-8 text-center shadow-sm text-[#C2C6D1] font-semibold w-full">
                        Please select a lesson from the syllabus outline to start learning.
                      </div>
                    )}
                  </div>

                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: QUIZZES */}
        {activeTab === "quizzes" && (
          <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedQuizActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#EDEFF5] border-b border-[#23252C] pb-3 flex items-center gap-2">
                  <FileQuestion className="text-[#6E79F4]" size={16} /> My Assigned Quizzes
                </h3>
                {loadingActivities ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                  </div>
                ) : programActivities.filter(a => a.activity_type_code === "quiz").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "quiz").map((act) => (
                      <div key={act.id} className="border border-[#23252C] rounded-xl p-4.5 bg-[#131418] flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-md hover:border-[#6E79F4]/15 transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#EDEFF5]">{act.title}</h4>
                          <p className="text-[#C2C6D1] text-[10px] mt-1.5 max-w-xl leading-relaxed">{act.description || "No description provided."}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[9px]">
                            <StatusBadge status={act.progress?.status_code} size="sm" />
                            {act.progress?.score !== null && (
                              <span className="bg-[#2FBF71]/10 text-[#2FBF71] px-2 py-0.5 rounded font-bold border border-[#2FBF71]/15">
                                Score: {act.progress?.score} / {act.progress?.max_score || 100}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterQuiz(act)}
                          className="bg-[#6E79F4] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center justify-center gap-1 text-[10px] shrink-0 w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Quiz <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-[#16171D]/30 rounded-xl border border-dashed border-[#23252C] text-[#C2C6D1] font-medium">
                    No quizzes assigned to your group yet.
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#23252C] pb-3">
                  <button
                    onClick={() => {
                      setSelectedQuizActivity(null);
                      setQuizDetails(null);
                      setQuizQuestions([]);
                    }}
                    className="text-[#6E79F4] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Quizzes
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedQuizActivity.title}</span>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-24 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-10 bg-[#1A1C22] animate-pulse rounded-xl w-1/3"></div>
                  </div>
                ) : quizDetails ? (
                  <div className="space-y-6">
                    {!activeAttempt && (
                      (() => {
                        const assignment = selectedQuizActivity.assignment;
                        const now = new Date();
                        const isNotOpenYet = assignment?.available_from ? new Date(assignment.available_from) > now : false;
                        const isPastDue = assignment?.available_until ? new Date(assignment.available_until) < now : false;

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C]">
                                <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Questions Count</span>
                                <span className="font-bold text-[#EDEFF5] text-xs">{quizQuestions.length} Questions</span>
                              </div>
                              <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C]">
                                <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Attempts Done</span>
                                <span className="font-bold text-[#EDEFF5] text-xs font-mono">{selectedQuizActivity.progress?.attempt_number || 0} / {quizDetails.max_attempts ?? "—"}</span>
                              </div>
                              {assignment?.available_from && (
                                <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C]">
                                  <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Available From</span>
                                  <span className="font-bold text-[#EDEFF5] text-[11px]">{new Date(assignment.available_from).toLocaleString()}</span>
                                </div>
                              )}
                              {assignment?.available_until && (
                                <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C]">
                                  <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Due Date</span>
                                  <span className={`font-bold text-[11px] ${isPastDue ? 'text-red-600' : 'text-[#EDEFF5]'}`}>{new Date(assignment.available_until).toLocaleString()}</span>
                                </div>
                              )}
                            </div>

                            {isNotOpenYet ? (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3.5 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} className="text-amber-600" />
                                <span>This quiz is not available yet. It will open on {new Date(assignment.available_from).toLocaleString()}.</span>
                              </div>
                            ) : isPastDue ? (
                              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3.5 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} className="text-red-600" />
                                <span>The due date for this quiz has passed. You cannot start a new attempt.</span>
                              </div>
                            ) : selectedQuizActivity.progress?.status_code === "completed" ? (
                              <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 text-[#2FBF71] rounded-lg p-3.5 text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 size={15} />
                                <span>You've already passed this quiz — no further attempts are needed.</span>
                              </div>
                            ) : (selectedQuizActivity.progress?.attempt_number || 0) >= quizDetails.max_attempts ? (
                              <div className="bg-[#F0555D]/5 border border-[#F0555D]/20 text-[#F0555D] rounded-lg p-3.5 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} />
                                <span>You have reached the maximum allowed attempts limit for this quiz. Retakes are locked.</span>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {quizDetails.strict_mode && (
                                  <div className="bg-[#F0555D]/5 border border-[#F0555D]/20 text-[#F0555D] rounded-lg p-3.5 text-xs font-semibold flex items-start gap-2">
                                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                    <span>This is a proctored quiz. It will open in fullscreen. Leaving fullscreen, switching tabs, or navigating back ends your attempt with a score of 0 — you get one warning.</span>
                                  </div>
                                )}
                                <button
                                  onClick={handleStartQuiz}
                                  disabled={actionLoading}
                                  className="bg-[#6E79F4] text-white px-5 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all text-xs flex items-center gap-1.5 disabled:opacity-50 font-sans"
                                >
                                  <Play size={13} fill="white" /> Start Quiz Attempt
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Quiz Questions List / Active Test screen */}
                    {activeAttempt && (
                      <div className="space-y-6">
                        <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/20 rounded-xl p-4 flex justify-between items-center">
                          <span className="font-semibold text-[#6E79F4] text-[10px] uppercase tracking-wider">Attempt #{activeAttempt.attempt_number} in progress...</span>
                          {timeLeft !== null ? (
                            <span className="bg-[#131418] border border-red-200 px-3 py-1.5 rounded font-mono font-bold text-xs text-red-600 flex items-center gap-1.5 animate-pulse">
                              <Clock size={13} /> Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          ) : (
                            <span className="bg-[#131418] border border-[#6E79F4]/30 px-3 py-1 rounded font-bold text-xs text-[#6E79F4]">Time Started: {new Date(activeAttempt.started_at).toLocaleTimeString()}</span>
                          )}
                        </div>

                        <div className="space-y-6">
                          {quizQuestions.map((q, idx) => (
                            <div key={q.id} className="border border-[#23252C] rounded-xl p-5 space-y-4">
                              <h4 className="font-bold text-xs text-[#EDEFF5] flex gap-2">
                                <span className="text-[#6E79F4]">Q{idx + 1}.</span> {q.question_text}
                                <span className="font-mono text-[9px] text-[#C2C6D1] bg-[#1A1C22] px-1.5 py-0.5 rounded">({q.points} pts)</span>
                              </h4>

                              <div className="grid grid-cols-1 gap-2.5">
                                {q.options?.map((opt: any) => {
                                  const isSelected = selectedAnswers[q.id]?.includes(opt.id) || false;
                                  return (
                                    <label
                                      key={opt.id}
                                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[#16171D] transition-all ${
                                        isSelected
                                          ? "border-[#6E79F4] bg-[#6E79F4]/5 font-semibold text-[#6E79F4]"
                                          : "border-[#23252C] bg-[#131418] text-[#C2C6D1]"
                                      }`}
                                    >
                                      <input
                                        type={q.question_type === "multiple_choice" ? "checkbox" : "radio"}
                                        name={q.id}
                                        value={opt.id}
                                        checked={isSelected}
                                        onChange={() => handleOptionSelect(q.id, opt.id, q.question_type)}
                                        className="accent-[#6E79F4]"
                                      />
                                      <span>{opt.option_text}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={handleSubmitQuiz}
                          disabled={actionLoading}
                          className="bg-[#2FBF71] text-white px-5 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#2FBF71]/95 transition-all text-xs flex items-center gap-1.5 disabled:opacity-50 w-full justify-center"
                        >
                          <Send size={13} /> Submit Quiz Answers
                        </button>
                      </div>
                    )}
                    {quizSubmittedResult && quizSubmittedResult.forfeited ? (
                      <div className="border border-[#F0555D]/20 bg-[#F0555D]/5 rounded-xl p-6 space-y-5 text-center">
                        <ShieldAlert size={48} className="text-[#F0555D] mx-auto" />
                        <div>
                          <h4 className="font-bold text-sm text-[#F0555D]">Attempt Forfeited — Score: 0</h4>
                          <p className="text-[#C2C6D1] text-xs mt-1">
                            {({
                              fullscreen_exit: "You exited fullscreen mode during a proctored quiz.",
                              tab_switch: "You switched away from the quiz tab during a proctored quiz.",
                              back_navigation: "You attempted to navigate back during a proctored quiz.",
                              grace_period_expired: "You did not return to the quiz environment within the warning period.",
                              left_quiz_environment: "You left the quiz environment without submitting.",
                              tab_closed: "The quiz tab was closed before submitting."
                            } as Record<string, string>)[quizSubmittedResult.forfeit_reason] || "This attempt was ended for leaving the quiz environment."}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto text-xs pt-2">
                          <div className="bg-[#131418] p-3 border border-[#23252C] rounded-xl">
                            <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wider">Score</span>
                            <span className="font-bold text-xs text-[#F0555D]">{quizSubmittedResult.score} / {quizSubmittedResult.max_score}</span>
                          </div>
                          <div className="bg-[#131418] p-3 border border-[#23252C] rounded-xl">
                            <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Passed</span>
                            <span className="font-bold text-xs uppercase text-[#F0555D]">No</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setQuizSubmittedResult(null);
                            setSelectedQuizActivity(null);
                          }}
                          className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] px-4 py-2 rounded-lg font-bold hover:bg-[#16171D] transition-all text-xs"
                        >
                          Return to Quiz List
                        </button>
                      </div>
                    ) : quizSubmittedResult && (
                      <div className={`border rounded-xl p-6 space-y-5 text-center ${
                        quizDetails.show_results_immediately
                          ? quizSubmittedResult.passed
                            ? "border-[#2FBF71]/20 bg-[#2FBF71]/5"
                            : "border-[#F0555D]/20 bg-[#F0555D]/5"
                          : "border-[#2FBF71]/20 bg-[#2FBF71]/5"
                      }`}>
                        {quizDetails.show_results_immediately ? (
                          <QuizResultBadge passed={!!quizSubmittedResult.passed} />
                        ) : (
                          <Award size={48} className="text-[#2FBF71] mx-auto" />
                        )}
                        <div>
                          <h4 className={`font-bold text-sm ${
                            quizDetails.show_results_immediately
                              ? quizSubmittedResult.passed ? "text-[#2FBF71]" : "text-[#F0555D]"
                              : "text-[#EDEFF5]"
                          }`}>
                            {quizDetails.show_results_immediately
                              ? quizSubmittedResult.passed
                                ? "Congratulations — You Passed!"
                                : "Quiz Submitted — Not Passed"
                              : "Quiz Submitted Successfully!"}
                          </h4>
                          <p className="text-[#C2C6D1] text-xs mt-1">
                            {quizDetails.show_results_immediately
                              ? "Your grading calculations have completed."
                              : "Your answers have been recorded. Grades will be released by the instructor."}
                          </p>
                        </div>

                        {quizDetails.show_results_immediately && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-md mx-auto text-xs pt-2">
                            <div className="bg-[#131418] p-3 border border-[#23252C] rounded-xl">
                              <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wider">Score</span>
                              <span className="font-bold text-xs text-[#EDEFF5]">{quizSubmittedResult.score} / {quizSubmittedResult.max_score}</span>
                            </div>
                            <div className="bg-[#131418] p-3 border border-[#23252C] rounded-xl">
                              <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Passed</span>
                              <span className={`font-bold text-xs uppercase ${quizSubmittedResult.passed ? "text-[#2FBF71]" : "text-[#F0555D]"}`}>
                                {quizSubmittedResult.passed ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="bg-[#131418] p-3 border border-[#23252C] rounded-xl">
                              <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wider">Duration</span>
                              <span className="font-bold text-xs text-[#EDEFF5]">{quizSubmittedResult.time_spent_seconds ?? "—"} Secs</span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setQuizSubmittedResult(null);
                            setSelectedQuizActivity(null);
                          }}
                          className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] px-4 py-2 rounded-lg font-bold hover:bg-[#16171D] transition-all text-xs"
                        >
                          Return to Quiz List
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-red-50/50 rounded-xl border border-dashed border-red-200 text-red-700 font-medium text-xs space-y-2">
                    <p>This quiz's details couldn't be loaded.</p>
                    <button
                      onClick={() => handleEnterQuiz(selectedQuizActivity)}
                      className="text-[#6E79F4] font-bold hover:underline cursor-pointer"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROJECTS */}
        {activeTab === "projects" && (
          <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedProjectActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#EDEFF5] border-b border-[#23252C] pb-3 flex items-center gap-2">
                  <FolderCode className="text-[#6E79F4]" size={16} /> My Assigned Projects & Assignments
                </h3>
                {loadingActivities ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                  </div>
                ) : programActivities.filter(a => a.activity_type_code === "project" || a.activity_type_code === "assignment").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "project" || a.activity_type_code === "assignment").map((act) => (
                      <div key={act.id} className="border border-[#23252C] rounded-xl p-4.5 bg-[#131418] flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-md hover:border-[#6E79F4]/15 transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#EDEFF5]">{act.title}</h4>
                          <p className="text-[#C2C6D1] text-[10px] mt-1.5 max-w-xl leading-relaxed">{act.description || "No description provided."}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[9px]">
                            <StatusBadge status={act.progress?.status_code} size="sm" />
                            {act.progress?.score !== null && (
                              <span className="bg-[#2FBF71]/10 text-[#2FBF71] px-2 py-0.5 rounded font-bold border border-[#2FBF71]/15">
                                Score: {act.progress?.score} / {act.progress?.max_score || 100}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterProject(act)}
                          className="bg-[#6E79F4] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center justify-center gap-1 text-[10px] shrink-0 w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Project <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-[#16171D]/30 rounded-xl border border-dashed border-[#23252C] text-[#C2C6D1] font-medium">
                    No projects or assignments assigned to your group yet.
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#23252C] pb-3">
                  <button
                    onClick={() => {
                      setSelectedProjectActivity(null);
                      setProjectDetails(null);
                    }}
                    className="text-[#6E79F4] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Projects
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedProjectActivity.title}</span>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-32 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-24 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                  </div>
                ) : projectDetails && (
                  <div className="space-y-6">
                    <div className="border border-[#23252C] rounded-xl p-5 bg-[#16171D]/20 space-y-4 text-xs">
                      <div>
                        <h4 className="font-bold text-[#EDEFF5] text-xs">Project Overview</h4>
                        <p className="text-[#C2C6D1] leading-relaxed mt-1">{projectDetails.project_overview}</p>
                      </div>

                      {projectDetails.requirements && (
                        <div>
                          <h4 className="font-bold text-[#EDEFF5] text-xs">Requirements</h4>
                          <p className="text-[#C2C6D1] leading-relaxed mt-1 whitespace-pre-line">{projectDetails.requirements}</p>
                        </div>
                      )}

                      {projectDetails.deliverables && (
                        <div>
                          <h4 className="font-bold text-[#EDEFF5] text-xs">Deliverables</h4>
                          <p className="text-[#C2C6D1] leading-relaxed mt-1 whitespace-pre-line">{projectDetails.deliverables}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-[#23252C]">
                        <div>
                          <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Difficulty</span>
                          <span className="font-bold text-[#EDEFF5] text-xs capitalize">{projectDetails.difficulty_level || "intermediate"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Estimated Hours</span>
                          <span className="font-bold text-[#EDEFF5] text-xs">{projectDetails.estimated_hours || 0} hrs</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#C2C6D1] font-bold block uppercase tracking-wide">Max Score</span>
                          <span className="font-bold text-[#EDEFF5] text-xs">{projectDetails.max_score} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* GitHub submission module */}
                    <div className="border border-[#23252C] rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-xs text-[#EDEFF5] flex items-center gap-1">
                        <FolderCode className="text-[#6E79F4]" size={14} /> Submission Form
                      </h4>

                      {projectSubmission && (
                        <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 text-[#2FBF71] rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                          <CheckCircle2 size={12} />
                          <span>Last Submitted: {new Date(projectSubmission.submitted_at).toLocaleString()}</span>
                        </div>
                      )}

                      {projectSubmission && !projectReview && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span>Your project has been submitted and is awaiting mentor review. Resubmission is locked until it's reviewed.</span>
                        </div>
                      )}

                      {projectReview?.review_status === "approved" && (
                        <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/20 text-[#2FBF71] rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                          <CheckCircle2 size={13} />
                          <span>This project has been approved — no resubmission needed.</span>
                        </div>
                      )}

                      {projectReview?.review_status === "revision_requested" && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                          <AlertTriangle size={13} />
                          <span>Your mentor requested revisions — see feedback below, then resubmit.</span>
                        </div>
                      )}

                      {(() => {
                        const locked = isProjectResubmitLocked(projectSubmission, projectReview);
                        return (
                          <div className="space-y-3 text-xs">
                            <div className="flex flex-col gap-1.5">
                              <label htmlFor="project-github-url" className="font-bold text-[#EDEFF5]">GitHub Repository URL</label>
                              <input
                                id="project-github-url"
                                type="text"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                disabled={locked}
                                placeholder="https://github.com/username/repository"
                                className="bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 w-full text-xs outline-none focus:border-[#6E79F4] transition-all disabled:bg-[#16171D] disabled:text-[#A3A9B6] disabled:cursor-not-allowed"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label htmlFor="project-submission-notes" className="font-bold text-[#EDEFF5]">Submission Notes (optional)</label>
                              <textarea
                                id="project-submission-notes"
                                value={submissionNotes}
                                onChange={(e) => setSubmissionNotes(e.target.value)}
                                disabled={locked}
                                placeholder="Write details or instructions for running the codebase here..."
                                rows={3}
                                className="bg-[#131418] border border-[#23252C] rounded-lg p-3 w-full text-xs outline-none focus:border-[#6E79F4] transition-all disabled:bg-[#16171D] disabled:text-[#A3A9B6] disabled:cursor-not-allowed"
                              />
                            </div>

                            <button
                              onClick={handleSubmitProjectUrl}
                              disabled={actionLoading || locked}
                              className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#6E79F4]/95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {locked ? "Submission Locked" : "Submit Project Repository"}
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Mentor review block */}
                    {projectReview && (() => {
                      const reviewColor = projectReview.review_status === "approved"
                        ? "#2FBF71"
                        : projectReview.review_status === "rejected"
                        ? "#F0555D"
                        : "#F5B04A";
                      return (
                        <div className="border rounded-xl p-5 space-y-3" style={{ borderColor: `${reviewColor}33`, backgroundColor: `${reviewColor}0D` }}>
                          <h4 className="font-bold text-xs uppercase tracking-wide" style={{ color: reviewColor }}>Mentor Review Output</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                            <div>
                              <span className="text-[9px] text-[#C2C6D1] block">Review Status</span>
                              <span className="capitalize">{projectReview.review_status.replace(/_/g, " ")}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-[#C2C6D1] block">Score Awarded</span>
                              <span>{projectReview.score !== null ? `${projectReview.score} / ${projectDetails.max_score}` : "Not Graded"}</span>
                            </div>
                          </div>
                          {projectReview.feedback && (
                            <div className="bg-[#131418] p-3 rounded-lg border border-[#23252C] text-[#C2C6D1] mt-2">
                              <span className="text-[9px] font-bold text-[#EDEFF5] block mb-1">Mentor Feedback</span>
                              <p className="italic">{projectReview.feedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PROGRAMMING CHALLENGES */}
        {activeTab === "challenges" && (
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedChallengeActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#EDEFF5] border-b border-[#23252C] pb-3 flex items-center gap-2">
                  <TerminalIcon className="text-[#6E79F4]" size={16} /> My Assigned Coding Challenges
                </h3>
                {loadingActivities ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-16 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                  </div>
                ) : programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming").map((act) => (
                      <div key={act.id} className="border border-[#23252C] rounded-xl p-4 bg-[#16171D]/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-sm transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#EDEFF5]">{act.title}</h4>
                          <p className="text-[#C2C6D1] text-[10px] mt-1 line-clamp-1">{act.description}</p>
                          <div className="flex flex-wrap gap-2 text-[9px] text-[#C2C6D1] font-semibold mt-2.5">
                            <StatusBadge status={act.progress?.status_code} size="sm" />
                            {act.progress?.score !== null && (
                              <span className="bg-[#2FBF71]/10 text-[#2FBF71] px-2 py-0.5 rounded font-bold border border-[#2FBF71]/20">Score: {act.progress?.score} / {act.progress?.max_score || 100}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterChallenge(act)}
                          className="bg-[#6E79F4] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/90 transition-all flex items-center justify-center gap-1 text-[10px] w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Challenge <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-[#16171D]/30 rounded-xl border border-dashed border-[#23252C] text-[#C2C6D1] font-medium">
                    No coding challenges assigned to your group yet.
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#23252C] pb-3">
                  <button
                    onClick={() => {
                      setSelectedChallengeActivity(null);
                      setChallengeDetails(null);
                      setSelectedSubmissionForResults(null);
                      setSubmissionResults(null);
                    }}
                    className="text-[#6E79F4] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Challenges
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedChallengeActivity.title}</span>
                </div>

                {/* Mobile: the code editor workspace needs a larger screen */}
                <div className="lg:hidden bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                  <TerminalIcon className="mx-auto text-amber-600" size={28} />
                  <p className="text-sm font-bold text-[#EDEFF5]">Desktop Required</p>
                  <p className="text-xs text-amber-800 leading-relaxed max-w-xs mx-auto">
                    Coding challenges need a full code editor that isn't available on mobile yet. Please switch to a laptop or desktop to attempt this challenge.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedChallengeActivity(null);
                      setChallengeDetails(null);
                      setSelectedSubmissionForResults(null);
                      setSubmissionResults(null);
                    }}
                    className="inline-flex items-center gap-1 bg-[#131418] border border-amber-300 text-amber-800 font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-100 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={13} /> Back to Challenges
                  </button>
                </div>

                <div className="hidden lg:block">
                {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-40 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                    <div className="h-40 bg-[#1A1C22] animate-pulse rounded-xl"></div>
                  </div>
                ) : challengeDetails && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* Left: Problem statement & Examples */}
                    <div className="space-y-6">
                      <div className="border border-[#23252C] rounded-xl p-5 bg-[#16171D]/20 space-y-4">
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-[#EDEFF5] text-xs">Problem Statement</h4>
                            <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-[#6E79F4]/15 text-[#6E79F4] border border-[#6E79F4]/20">
                              {challengeDetails.difficulty_level}
                            </span>
                          </div>
                          <p className="text-[#C2C6D1] leading-relaxed mt-2 whitespace-pre-line">{challengeDetails.problem_statement}</p>
                        </div>

                        {challengeDetails.instructions && (
                          <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/15 p-3 rounded-lg text-xs text-[#EDEFF5] space-y-1">
                            <span className="font-bold text-[#6E79F4] block text-[9px] uppercase tracking-wider">💡 Instructions & Hints</span>
                            <p className="leading-relaxed whitespace-pre-wrap">{challengeDetails.instructions}</p>
                          </div>
                        )}

                        {challengeDetails.input_format && (
                          <div>
                            <h4 className="font-bold text-[#EDEFF5] text-xs">Input Format</h4>
                            <p className="text-[#C2C6D1] leading-relaxed mt-1">{challengeDetails.input_format}</p>
                          </div>
                        )}

                        {challengeDetails.output_format && (
                          <div>
                            <h4 className="font-bold text-[#EDEFF5] text-xs">Output Format</h4>
                            <p className="text-[#C2C6D1] leading-relaxed mt-1">{challengeDetails.output_format}</p>
                          </div>
                        )}

                        {challengeDetails.constraints_text && (
                          <div>
                            <h4 className="font-bold text-[#EDEFF5] text-xs">Constraints</h4>
                            <p className="text-[#C2C6D1] font-mono leading-relaxed mt-1 text-[10px] bg-[#1A1C22] p-2 rounded">{challengeDetails.constraints_text}</p>
                          </div>
                        )}
                      </div>

                      {/* Examples */}
                      {challengeExamples.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wide">Visible Examples</h4>
                          {challengeExamples.map((ex) => (
                            <div key={ex.id} className="border border-[#23252C] rounded-xl p-4 bg-[#131418] space-y-2">
                              <p className="font-bold text-[#6E79F4] text-[10px]">Example {ex.example_number}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono bg-[#16171D] p-2 rounded border border-[#23252C] overflow-x-auto">
                                <div>
                                  <span className="font-bold text-[#EDEFF5] block mb-0.5">Input</span>
                                  <span className="text-[#C2C6D1]">{ex.input_example}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-[#EDEFF5] block mb-0.5">Output</span>
                                  <span className="text-[#C2C6D1]">{ex.output_example}</span>
                                </div>
                              </div>
                              {ex.explanation && <p className="text-[10px] text-[#C2C6D1] italic">Explanation: {ex.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Code editor & submissions list */}
                    <div className="space-y-6">
                      <div className="border border-[#23252C] rounded-xl p-5 bg-[#131418] space-y-4">
                        <div className="flex justify-between items-center border-b border-[#23252C] pb-3">
                          <h4 className="font-bold text-xs text-[#EDEFF5] flex items-center gap-1">
                            <Code size={14} className="text-[#6E79F4]" /> Code Editor
                          </h4>
                          <select
                            value={editorLanguage}
                            onChange={(e) => setEditorLanguage(e.target.value)}
                            aria-label="Programming language"
                            className="bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/30 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[#EDEFF5] outline-none focus:border-[#6E79F4] focus:ring-2 focus:ring-[#6E79F4]/15 transition-all cursor-pointer"
                          >
                            <option value="javascript">JavaScript (Node.js)</option>
                            <option value="python">Python 3</option>
                            <option value="java">Java (OpenJDK)</option>
                            <option value="cpp">C++ (GCC)</option>
                            <option value="c">C (GCC)</option>
                          </select>
                        </div>

                        <div className="flex rounded-xl border border-slate-800 overflow-hidden">
                          <div
                            ref={codeEditorGutterRef}
                            aria-hidden="true"
                            className="bg-[#6E79F4] text-[#C2C6D1] font-mono text-[10px] leading-normal py-4 pl-3 pr-2 text-right select-none overflow-hidden shrink-0"
                            style={{ height: "18rem" }}
                          >
                            {Array.from({ length: Math.max(editorCode.split("\n").length, 12) }, (_, i) => (
                              <div key={i}>{i + 1}</div>
                            ))}
                          </div>
                          <textarea
                            value={editorCode}
                            onChange={(e) => setEditorCode(e.target.value)}
                            onScroll={handleCodeEditorScroll}
                            spellCheck={false}
                            className="bg-[#6E79F4] text-emerald-400 font-mono p-4 w-full text-[10px] outline-none leading-normal resize-none"
                            style={{ height: "18rem" }}
                            placeholder="// Write your code solution here..."
                          />
                        </div>

                        <button
                          onClick={handleSubmitChallenge}
                          disabled={actionLoading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#6E79F4]/95 transition-all text-xs disabled:opacity-50 w-full flex justify-center items-center gap-1.5"
                        >
                          <Send size={12} /> Submit Solution
                        </button>
                      </div>

                      {/* Submissions list */}
                      <div className="border border-[#23252C] rounded-xl p-5 bg-[#131418] space-y-4">
                        <h4 className="font-bold text-xs text-[#EDEFF5] flex items-center gap-1">
                          <History size={14} className="text-[#6E79F4]" /> Submission History ({challengeSubmissions.length})
                        </h4>

                        <div className="divide-y divide-[#23252C] max-h-48 overflow-y-auto pr-1">
                          {challengeSubmissions.map((sub) => (
                            <div key={sub.id} className="py-2.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                              <div>
                                <span className="font-bold capitalize text-[#EDEFF5]">{sub.language}</span>
                                <span className="text-[10px] text-[#C2C6D1] ml-2">{new Date(sub.submitted_at).toLocaleTimeString()}</span>
                                <div className="mt-1 flex gap-2">
                                  <StatusBadge status={sub.submission_status_code} />
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewSubmissionResults(sub)}
                                className="text-[#6E79F4] hover:underline font-bold text-[10px]"
                              >
                                View Results
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detailed submission results */}
                      {selectedSubmissionForResults && submissionResults && (
                        <div className="border border-[#23252C] bg-[#16171D]/50 rounded-xl p-5 space-y-4 text-xs">
                          <div className="flex justify-between items-center border-b border-[#23252C] pb-2">
                            <h4 className="font-bold text-[#EDEFF5] text-xs">Grading & Execution Report</h4>
                            <span className="font-mono text-[9px] text-[#C2C6D1]">ID: {selectedSubmissionForResults.id.substring(0, 8)}</span>
                          </div>

                          {submissionResults.result ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                              <div className="bg-[#131418] p-2 border border-[#23252C] rounded-lg">
                                <span className="text-[9px] text-[#C2C6D1] block">Passed Cases</span>
                                <span className="font-bold text-[#2FBF71]">{submissionResults.result.passed_test_cases} / {submissionResults.result.total_test_cases}</span>
                              </div>
                              <div className="bg-[#131418] p-2 border border-[#23252C] rounded-lg">
                                <span className="text-[9px] text-[#C2C6D1] block">Time Spent</span>
                                <span className="font-bold">{submissionResults.result.execution_time_ms ?? 0} ms</span>
                              </div>
                              <div className="bg-[#131418] p-2 border border-[#23252C] rounded-lg">
                                <span className="text-[9px] text-[#C2C6D1] block">Memory Used</span>
                                <span className="font-bold">{submissionResults.result.memory_used_kb ?? 0} KB</span>
                              </div>
                              <div className="bg-[#131418] p-2 border border-[#23252C] rounded-lg">
                                <span className="text-[9px] text-[#C2C6D1] block">Score</span>
                                <span className="font-bold text-[#6E79F4]">{submissionResults.result.score ?? 0} pts</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[#F5B04A]/5 border border-[#F5B04A]/20 text-[#F5B04A] p-3 rounded-lg flex items-center gap-1.5 font-semibold">
                              <AlertTriangle size={14} />
                              <span>Submission is currently: {selectedSubmissionForResults.submission_status_code}. Grading results will update automatically.</span>
                            </div>
                          )}

                          {/* Logs list */}
                          {submissionResults.logs?.length > 0 && (
                            <div className="space-y-2">
                              <span className="font-bold text-[#EDEFF5] block">Execution Output Logs</span>
                              <div className="bg-[#0E0F13] border border-[#23252C] text-[#C2C6D1] p-3 rounded-xl font-mono text-[9px] max-h-32 overflow-y-auto space-y-1">
                                {submissionResults.logs.map((log: any) => (
                                  <div key={log.id}>
                                    <span className="text-amber-400">[{log.log_type}]</span> {log.log_message}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        </div>
      </AppShell>
    </>
  );
}
