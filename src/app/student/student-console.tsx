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
  ensureLessonProjectActivityAction
} from "@/app/actions/learning-actions";
import { getStudentAttendanceLogsAction } from "@/app/actions/attendance-actions";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCache } from "@/components/cache-provider";
import { useQueryClient } from "@tanstack/react-query";
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
  Code
} from "lucide-react";

import { useStudentDeliveryData } from "@/hooks/use-delivery";
import { useAcademicPrefetchData } from "@/hooks/use-academics";
import { DashboardLoader } from "@/components/dashboard-loader";

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hoveredCourseIdx, setHoveredCourseIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

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
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, any>>({});
  const [activeLesson, setActiveLesson] = useState<any | null>(null);

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const res = await getStudentAttendanceLogsAction(cohortId, studentId);
      if (res.logs) {
        setAttendancePercentage(res.logs.percentage);
        setAttendanceLogs(res.logs.logs);
      }
      setLoadingAttendance(false);
    };
    loadAttendance();
  }, [selectedCohort, studentId]);

  // Load activities on mount or tab change
  const loadActivities = async () => {
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
    } else if (res.error) {
      setError(res.error);
    }
    setLoadingActivities(false);
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
      setError(fetchError instanceof Error ? fetchError.message : "Unable to refresh your dashboard.");
      return;
    }
    if (res.programs) {
      set(`student-delivery-data-${studentId}`, res);
      applyData(res);
    }
    await loadActivities();
    await loadLessonProgress();
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
  };

  const handleSelectCourse = async (course: any) => {
    setSelectedCourse(course);
    setActiveLesson(null);
    setError("");

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
    const mRes = await listModulesAction(course.id);
    if (mRes.error) {
      setError(mRes.error);
      setLoading(false);
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
    setLoading(false);
  };

  const handleStartLesson = async (lesson: any) => {
    setActiveLesson(lesson);
    if (!selectedCourse) return;
    
    setActionLoading(true);
    const res = await startOrUpdateLessonProgressAction(studentId, lesson.id, selectedCourse.id);
    if (res.progress) {
      setLessonProgressMap(prev => ({
        ...prev,
        [lesson.id]: res.progress
      }));
    }
    setActionLoading(false);
  };

  const handleCompleteLesson = async (lesson: any) => {
    if (!selectedCourse) return;
    setActionLoading(true);

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

    const res = await completeLessonProgressAction(studentId, lesson.id, selectedCourse.id);
    if (res.progress) {
      setLessonProgressMap(prev => ({
        ...prev,
        [lesson.id]: res.progress
      }));
      setSuccess(`Completed lesson: ${lesson.title}`);
      setTimeout(() => setSuccess(""), 3000);
      await refreshStudentData();
    }
    setActionLoading(false);
  };

  // Quiz interactive flows
  const handleEnterQuiz = async (activity: any) => {
    setSelectedQuizActivity(activity);
    setQuizSubmittedResult(null);
    setActiveAttempt(null);
    setSelectedAnswers({});
    setLoading(true);
    setError("");

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
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load quiz details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!quizDetails) return;
    setActionLoading(true);
    setError("");
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
      setSuccess("Quiz attempt started. Good luck!");
      setTimeout(() => setSuccess(""), 3000);
    } else if (res.error) {
      setError(res.error);
    }
    setActionLoading(false);
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
    if (!activeAttempt) return;
    setActionLoading(true);
    setError("");
    const payload = Object.entries(selectedAnswers).flatMap(([qId, optIds]) =>
      optIds.map(optId => ({
        questionId: qId,
        selectedOptionId: optId
      }))
    );

    const res = await submitQuizAnswersAction(activeAttempt.id, payload);
    if (res.attempt) {
      setQuizSubmittedResult(res.attempt);
      setActiveAttempt(null);
      setSuccess("Quiz submitted successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await refreshStudentData();
    } else if (res.error) {
      setError(res.error);
    }
    setActionLoading(false);
  };

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
        // Auto-submit when timer expires
        setActionLoading(true);
        const payload = Object.entries(selectedAnswers).flatMap(([qId, optIds]) =>
          optIds.map(optId => ({
            questionId: qId,
            selectedOptionId: optId
          }))
        );
        submitQuizAnswersAction(activeAttempt.id, payload).then((res) => {
          if (res.attempt) {
            setQuizSubmittedResult(res.attempt);
            setActiveAttempt(null);
            setSuccess("Time limit reached. Quiz automatically submitted.");
            setTimeout(() => setSuccess(""), 4000);
            refreshStudentData();
          } else if (res.error) {
            setError(res.error);
            setActiveAttempt(null);
          }
          setActionLoading(false);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAttempt, quizDetails, selectedAnswers]);

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
      setError("Please provide a valid GitHub repository URL (starts with https://github.com/).");
      setTimeout(() => setError(""), 4000);
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

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
        
        // Auto-complete the lesson progress in syllabus
        if (selectedCourse) {
          await completeLessonProgressAction(studentId, activeLesson.id, selectedCourse.id);
        }
        
        setSuccess("Assignment submitted successfully and marked as completed!");
        setTimeout(() => setSuccess(""), 4000);
        await refreshStudentData();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit assignment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Project interactive flows
  const handleEnterProject = async (activity: any) => {
    setSelectedProjectActivity(activity);
    setLoading(true);
    const res = await getProjectDetailsAction(activity.id, studentId);
    if (res && "project" in res) {
      setProjectDetails(res.project);
      setProjectSubmission(res.submission);
      setProjectReview(res.review);
      setGithubUrl(res.submission?.github_url || "");
      setSubmissionNotes(res.submission?.submission_notes || "");
    } else if (res && "error" in res) {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleSubmitProjectUrl = async () => {
    if (!projectDetails) return;
    if (!githubUrl.trim().startsWith("https://github.com/")) {
      setError("Please provide a valid GitHub repository URL (starts with https://github.com/).");
      setTimeout(() => setError(""), 4000);
      return;
    }
    setActionLoading(true);
    const res = await submitProjectAction(
      projectDetails.id,
      studentId,
      selectedProjectActivity.progress?.id || "new",
      githubUrl,
      submissionNotes
    );
    if (res.submission) {
      setProjectSubmission(res.submission);
      setSuccess("Project submitted successfully for mentor review!");
      setTimeout(() => setSuccess(""), 4000);
      await refreshStudentData();
    } else if (res.error) {
      setError(res.error);
    }
    setActionLoading(false);
  };

  // Programming challenge flows
  const handleEnterChallenge = async (activity: any) => {
    setSelectedChallengeActivity(activity);
    setSelectedSubmissionForResults(null);
    setSubmissionResults(null);
    setLoading(true);
    const res = await getProgrammingChallengeDetailsAction(activity.id, studentId);
    if (res && "challenge" in res) {
      setChallengeDetails(res.challenge);
      setChallengeExamples(res.examples || []);
      setChallengeSubmissions(res.submissions || []);
      setEditorCode(res.challenge.starter_code || "");
    } else if (res && "error" in res) {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleSubmitChallenge = async () => {
    if (!challengeDetails) return;
    if (!editorCode.trim()) {
      setError("Source code cannot be blank.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setActionLoading(true);
    const res = await submitChallengeCodeAction(
      challengeDetails.id,
      studentId,
      selectedChallengeActivity.progress?.id || "new",
      editorLanguage,
      editorCode
    );
    if (res.submission) {
      setSuccess("Code submitted successfully. Added to execution queue!");
      setTimeout(() => setSuccess(""), 4000);
      // Reload submissions list
      const updatedData = await getProgrammingChallengeDetailsAction(selectedChallengeActivity.id, studentId);
      if (updatedData && "submissions" in updatedData) {
        setChallengeSubmissions(updatedData.submissions || []);
      }
      await refreshStudentData();
    } else if (res.error) {
      setError(res.error);
    }
    setActionLoading(false);
  };

  const handleViewSubmissionResults = async (sub: any) => {
    setSelectedSubmissionForResults(sub);
    setLoading(true);
    const res = await getChallengeSubmissionResultsAction(sub.id);
    setSubmissionResults(res);
    setLoading(false);
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

  if (studentDeliveryError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load your student dashboard. {studentDeliveryError.message}</div>;
  }

  return (
    <>
      <DashboardLoader loading={loadingStudentDelivery} message="Setting up your Student Hub..." />
      <div className="flex flex-col gap-6 w-full" style={{ animation: "hc-dashFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
      {/* Global Program Selector Bar */}
      <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 bg-white border border-[#E2E8F0] px-4 py-2.5 rounded-xl hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 transition-all text-xs font-semibold text-[#0F172A] shadow-xs"
            >
              <div className="bg-[#2563EB]/10 text-[#2563EB] p-1.5 rounded-lg">
                <GraduationCap size={15} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-[#475569] font-bold uppercase tracking-wider">Active Group / Cohort</span>
                <span className="truncate max-w-[150px] sm:max-w-[320px] font-bold">
                  {selectedCohort ? `${selectedCohort.name} (${selectedCohort.code})` : "No Active Group"}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#475569] ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-[calc(100vw-2.5rem)] max-w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1.5 animate-fadeIn">
                <div className="px-4 py-1.5 border-b border-[#E2E8F0] text-[9px] font-bold text-[#475569] uppercase tracking-wider">
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
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-all flex flex-col gap-0.5 text-xs ${
                            selectedCohort?.id === coh.id ? "bg-[#2563EB]/5 text-[#2563EB] font-bold" : "text-[#475569]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate pr-2">{coh.name} ({coh.code})</span>
                            {selectedCohort?.id === coh.id && <CheckCircle2 size={13} className="text-[#2563EB]" />}
                          </div>
                          <span className="text-[9px] text-[#475569] truncate font-medium">Program: {coh.programTitle}</span>
                        </button>
                      ));
                    }
                    return <div className="px-4 py-3 text-xs text-[#475569]">No groups available.</div>;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {selectedCohort && (
          <div className="text-[10px] text-[#475569] font-medium flex items-center gap-2">
            <span className="bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">
              Program: {selectedCohort.programTitle}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start text-xs">

        {/* MOBILE TAB STRIP (below md) */}
        <div className="md:hidden w-full -mx-0 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            <button
              onClick={() => {
                setActiveParentTab("overview");
                setActiveTab("overview");
                setSelectedCourse(null);
                setActiveLesson(null);
              }}
              className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                activeParentTab === "overview"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] text-[#475569]"
              }`}
            >
              <Building size={16} /> Overview
            </button>
            <button
              onClick={() => {
                setActiveParentTab("curriculum");
                setActiveTab("academics");
                setSelectedCourse(null);
                setActiveLesson(null);
              }}
              className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                activeParentTab === "curriculum"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] text-[#475569]"
              }`}
            >
              <BookOpen size={16} /> Syllabus
            </button>
            <button
              onClick={() => {
                setActiveParentTab("assessments");
                setActiveTab("quizzes");
                setSelectedQuizActivity(null);
                setSelectedProjectActivity(null);
                setSelectedChallengeActivity(null);
              }}
              className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                activeParentTab === "assessments"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] text-[#475569]"
              }`}
            >
              <Award size={16} /> Assessments
            </button>
          </div>

          {activeParentTab === "assessments" && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-[#E2E8F0] -mx-1 px-1 no-scrollbar">
              <button
                onClick={() => {
                  setActiveTab("quizzes");
                  setSelectedQuizActivity(null);
                  setSelectedProjectActivity(null);
                  setSelectedChallengeActivity(null);
                }}
                className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "quizzes" ? "bg-[#2563EB]/10 text-[#2563EB]" : "text-[#475569] bg-slate-50"
                }`}
              >
                Quizzes <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{quizCount}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("projects");
                  setSelectedQuizActivity(null);
                  setSelectedProjectActivity(null);
                  setSelectedChallengeActivity(null);
                }}
                className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "projects" ? "bg-[#2563EB]/10 text-[#2563EB]" : "text-[#475569] bg-slate-50"
                }`}
              >
                Projects <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projectCount}</span>
              </button>
              <Link
                href="/student/programming"
                className="shrink-0 min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-[#475569] bg-slate-50"
              >
                Code Challenges <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{challengeCount}</span>
              </Link>
            </div>
          )}
        </div>

        {/* GROUPED DUAL SIDEBAR (md and up) */}
        <div className="hidden md:flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">

          {/* PRIMARY ICON BAR */}
          <div className="flex sm:flex-col gap-2 shrink-0 bg-white border border-[#E2E8F0] p-2.5 rounded-2xl shadow-sm justify-between sm:justify-start">
            <button
              onClick={() => {
                setActiveParentTab("overview");
                setActiveTab("overview");
                setSelectedCourse(null);
                setActiveLesson(null);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "overview"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]"
              }`}
              title="Overview space"
            >
              <Building size={18} />
            </button>
            
            <button
              onClick={() => {
                setActiveParentTab("curriculum");
                setActiveTab("academics");
                setSelectedCourse(null);
                setActiveLesson(null);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "curriculum"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]"
              }`}
              title="Academics & Syllabus"
            >
              <BookOpen size={18} />
            </button>
            
            <button
              onClick={() => {
                setActiveParentTab("assessments");
                setActiveTab("quizzes");
                setSelectedQuizActivity(null);
                setSelectedProjectActivity(null);
                setSelectedChallengeActivity(null);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "assessments"
                  ? "bg-[#2563EB] text-white shadow-sm border-[#2563EB]"
                  : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]"
              }`}
              title="Assessments & Tasks"
            >
              <Award size={18} />
            </button>
          </div>

          {/* SECONDARY SIDEBAR */}
          {isSidebarOpen && (
            <div className="w-full sm:w-52 shrink-0 flex flex-col gap-2 border border-[#E2E8F0] bg-white p-4 rounded-2xl shadow-sm">
              <h4 className="text-[10px] font-bold text-[#475569] uppercase tracking-wider px-2 mb-2">
                {activeParentTab === "overview" && "Overview space"}
                {activeParentTab === "curriculum" && "Syllabus Hub"}
                {activeParentTab === "assessments" && "Auditing space"}
              </h4>
              
              {activeParentTab === "overview" && (
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-[#2563EB]/10 text-[#2563EB]"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  }`}
                >
                  Dashboard Overview
                </button>
              )}

              {activeParentTab === "curriculum" && (
                <button
                  onClick={() => {
                    setActiveTab("academics");
                    setSelectedCourse(null);
                    setActiveLesson(null);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "academics"
                      ? "bg-[#2563EB]/10 text-[#2563EB]"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <span>Syllabus Lessons</span>
                  <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {selectedProgram?.courses?.length || 0}
                  </span>
                </button>
              )}

              {activeParentTab === "assessments" && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTab("quizzes");
                      setSelectedQuizActivity(null);
                      setSelectedProjectActivity(null);
                      setSelectedChallengeActivity(null);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                      activeTab === "quizzes"
                        ? "bg-[#2563EB]/10 text-[#2563EB]"
                        : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span>Quizzes</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{quizCount}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("projects");
                      setSelectedQuizActivity(null);
                      setSelectedProjectActivity(null);
                      setSelectedChallengeActivity(null);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                      activeTab === "projects"
                        ? "bg-[#2563EB]/10 text-[#2563EB]"
                        : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span>Projects</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projectCount}</span>
                  </button>

                  <Link
                    href="/student/programming"
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <span>Code Challenges</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{challengeCount}</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
        
        {error && (
          <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 text-xs flex items-center gap-2 font-semibold">
            <CheckCircle2 size={14} />
            {success}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Elegant Header Greeting Block */}
            <div className="relative overflow-hidden bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-subtle flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#2563EB]/5 to-transparent pointer-events-none rounded-r-2xl" />
              <div className="relative z-10 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/15 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    Student Hub
                  </span>
                  {selectedCohort && (
                    <span className="text-[10px] text-[#64748B] font-semibold">
                      • {selectedCohort.name} ({selectedCohort.code})
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-[#0F172A] tracking-tight pt-1">
                  Welcome back, {fullName}! 👋
                </h1>
                <p className="text-xs text-[#64748B] font-medium max-w-xl">
                  Ready to resume your academic journey? Track your modules, review pending assignments, and explore your batch curriculum.
                </p>
              </div>

              {selectedCohort && (
                <button
                  onClick={() => {
                    setSelectedCourse(null);
                    setActiveLesson(null);
                    setActiveTab("academics");
                  }}
                  className="relative z-10 flex items-center gap-2 bg-[#2563EB] hover:bg-[#2563EB]/95 text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shrink-0"
                >
                  <span>Go to Curriculum</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>

            {/* Glowing Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Stat 1: Overall Progress */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Program Progress</span>
                  <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl">
                    <BookOpen size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] leading-tight">
                    {activeCoursesList.length > 0 
                      ? `${Math.round(activeCoursesList.reduce((acc: number, c: any) => acc + (c.progress?.progress_percentage || 0), 0) / activeCoursesList.length)}%`
                      : "0%"}
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Overall Completion Rate</p>
                </div>
              </div>

              {/* Stat 2: Active Courses */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Active Courses</span>
                  <div className="bg-[#F59E0B]/10 text-[#F59E0B] p-2 rounded-xl">
                    <Clock size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] leading-tight">
                    {inProgressCourses} / {totalEnrolledCourses}
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Courses in Progress</p>
                </div>
              </div>

              {/* Stat 3: Tasks Done */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Completed Tasks</span>
                  <div className="bg-[#10B981]/10 text-[#10B981] p-2 rounded-xl">
                    <Award size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] leading-tight">
                    {completedActivities} Done
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Assessments Completed</p>
                </div>
              </div>

              {/* Stat 4: Pending Tasks */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Pending Work</span>
                  <div className="bg-[#06B6D4]/10 text-[#06B6D4] p-2 rounded-xl">
                    <FileQuestion size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] leading-tight">
                    {pendingActivities} Tasks
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Awaiting Submission</p>
                </div>
              </div>

            </div>

            {/* Split Grid Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Enrolled Courses & Progress Details */}
              <div className="lg:col-span-2 space-y-6">

                {/* Course Grid Path */}
                {totalEnrolledCourses > 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-subtle space-y-5 relative">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                      <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                        <BookOpenCheck className="text-[#2563EB]" size={14} /> Curriculum Progress Graph
                      </h3>
                      <span className="text-[10px] text-[#64748B] font-bold">
                        {totalEnrolledCourses} Enrolled Course{totalEnrolledCourses > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Mobile-friendly simplified progress list (below md) */}
                    <div className="md:hidden space-y-3">
                      {activeCoursesList.map((course: any) => {
                        const pct = course.progress?.progress_percentage || 0;
                        return (
                          <button
                            key={course.id}
                            onClick={async () => {
                              await handleSelectCourse(course);
                              setActiveTab("academics");
                            }}
                            className="w-full text-left border border-[#E2E8F0] rounded-xl p-3 space-y-2 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#0F172A] truncate">{course.title}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${pct === 100 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct === 100 ? "bg-[#10B981]" : "bg-[#2563EB]"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-[#64748B] font-semibold">
                              <span>{(course.progress?.status_code || "Not Started").replace("_", " ")}</span>
                              <span>{course.progress?.completed_lessons || 0} / {course.progress?.total_lessons || 0} Lessons</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Interactive SVG Bar Chart (md and up) */}
                    <div className="relative pt-2 hidden md:block">
                      <svg className="w-full h-auto" viewBox="0 0 600 260" fill="none">
                        <defs>
                          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.85" />
                          </linearGradient>
                          <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
                          </linearGradient>
                        </defs>

                        {/* Y-Axis Grid Lines & Labels */}
                        {[
                          { pct: 100, y: 35 },
                          { pct: 75, y: 76.25 },
                          { pct: 50, y: 117.5 },
                          { pct: 25, y: 158.75 },
                          { pct: 0, y: 200 }
                        ].map((grid) => (
                          <g key={grid.pct}>
                            <line 
                              x1="55" 
                              y1={grid.y} 
                              x2="575" 
                              y2={grid.y} 
                              stroke={grid.pct === 0 ? "#CBD5E1" : "#F1F5F9"} 
                              strokeWidth={grid.pct === 0 ? "1.5" : "1"} 
                              strokeDasharray={grid.pct === 0 ? undefined : "4 4"} 
                            />
                            <text 
                              x="45" 
                              y={grid.y + 3.5} 
                              fill="#94A3B8" 
                              fontSize="9" 
                              textAnchor="end" 
                              fontWeight="bold"
                              className="font-mono"
                            >
                              {grid.pct}%
                            </text>
                          </g>
                        ))}

                        {/* X-Axis Data Bars */}
                        {activeCoursesList.map((course: any, idx: number) => {
                          const segW = 520 / activeCoursesList.length;
                          const centerX = 55 + segW * idx + segW / 2;
                          const barW = Math.min(segW * 0.42, 38);
                          const barX = centerX - barW / 2;
                          
                          const pct = course.progress?.progress_percentage || 0;
                          const barH = (pct / 100) * 165; // Max height 165px (from Y=35 to Y=200)
                          const barY = 200 - barH;

                          return (
                            <g key={course.id}>
                              {/* Background trace bar */}
                              <rect 
                                x={barX} 
                                y="35" 
                                width={barW} 
                                height="165" 
                                rx="5" 
                                fill="#F8FAFC" 
                                stroke="#F1F5F9" 
                                strokeWidth="1" 
                              />

                              {/* Progress fill bar */}
                              {pct > 0 && (
                                <rect 
                                  x={barX} 
                                  y={barY} 
                                  width={barW} 
                                  height={barH} 
                                  rx="5" 
                                  fill={pct === 100 ? "url(#emeraldGrad)" : "url(#blueGrad)"}
                                  className="transition-all duration-300"
                                />
                              )}

                              {/* Glowing border if hovered */}
                              {hoveredCourseIdx === idx && (
                                <rect 
                                  x={barX - 2} 
                                  y={barY - 2} 
                                  width={barW + 4} 
                                  height={barH + (pct > 0 ? 2 : 0) + 2} 
                                  rx="7" 
                                  fill="none" 
                                  stroke={pct === 100 ? "#10B981" : "#2563EB"} 
                                  strokeWidth="1.5" 
                                  className="animate-pulse"
                                />
                              )}

                              {/* Label course title below bar */}
                              <text 
                                x={centerX} 
                                y="222" 
                                fill={hoveredCourseIdx === idx ? "#2563EB" : "#64748B"} 
                                fontSize="9" 
                                textAnchor="middle" 
                                fontWeight="bold" 
                                className="transition-colors cursor-pointer select-none"
                                onClick={async () => {
                                  await handleSelectCourse(course);
                                  setActiveTab("academics");
                                }}
                              >
                                {course.title.length > 14 ? course.title.slice(0, 12) + "..." : course.title}
                              </text>

                              {/* Interactive full-height hit area block */}
                              <rect
                                x={55 + segW * idx}
                                y="30"
                                width={segW}
                                height="198"
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredCourseIdx(idx)}
                                onMouseLeave={() => {
                                  setHoveredCourseIdx(null);
                                  setTooltipPos(null);
                                }}
                                onMouseMove={(e) => {
                                  const rect = e.currentTarget.parentNode?.parentElement?.getBoundingClientRect();
                                  if (rect) {
                                    setTooltipPos({
                                      x: e.clientX - rect.left + 12,
                                      y: e.clientY - rect.top - 85,
                                    });
                                  }
                                }}
                                onClick={async () => {
                                  await handleSelectCourse(course);
                                  setActiveTab("academics");
                                }}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Tooltip Overlay */}
                      {hoveredCourseIdx !== null && tooltipPos && activeCoursesList[hoveredCourseIdx] && (
                        <div 
                          className="absolute z-30 bg-[#0F172A]/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 pointer-events-none text-xs space-y-1.5 min-w-[220px] backdrop-blur-xs"
                          style={{ left: tooltipPos.x, top: tooltipPos.y }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold truncate max-w-[130px]">{activeCoursesList[hoveredCourseIdx].title}</span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              activeCoursesList[hoveredCourseIdx].progress?.progress_percentage === 100 
                                ? "bg-emerald-500/20 text-emerald-300" 
                                : "bg-blue-500/20 text-blue-300"
                            }`}>
                              {activeCoursesList[hoveredCourseIdx].course_type || "CORE"}
                            </span>
                          </div>
                          <div className="h-[1px] bg-slate-800 w-full" />
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Milestone Progress:</span>
                            <span className="font-bold text-[#60A5FA] text-xs font-mono">{activeCoursesList[hoveredCourseIdx].progress?.progress_percentage || 0}%</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Completed Syllabus:</span>
                            <span className="font-semibold text-slate-200">{activeCoursesList[hoveredCourseIdx].progress?.completed_lessons || 0} / {activeCoursesList[hoveredCourseIdx].progress?.total_lessons || 0} Lessons</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Current Status:</span>
                            <span className={`font-bold capitalize text-[10px] ${
                              activeCoursesList[hoveredCourseIdx].progress?.progress_percentage === 100 
                                ? "text-emerald-400" 
                                : "text-amber-400"
                            }`}>
                              {(activeCoursesList[hoveredCourseIdx].progress?.status_code || "Not Started").replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hidden md:flex pt-2 items-center justify-between text-[10px] text-[#64748B] font-semibold border-t border-[#E2E8F0] flex-wrap gap-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#2563EB]" />
                          <span>In Progress</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#10B981]" />
                          <span>Completed</span>
                        </div>
                      </div>
                      <span className="italic flex items-center gap-1">
                        💡 Click on any bar or title to resume your lessons
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center shadow-subtle space-y-2">
                    <p className="text-sm font-semibold text-[#0F172A]">No study curriculum found</p>
                    <p className="text-xs text-[#64748B]">You are not currently enrolled in any active cohorts.</p>
                  </div>
                )}
              </div>

              {/* Right Column: Pending tasks, attendance & performance */}
              <div className="space-y-6">

                {/* Pending Tasks card */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-subtle space-y-4">
                  <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3 flex items-center gap-2 uppercase tracking-wider">
                    <FileQuestion className="text-[#2563EB]" size={14} /> Pending Activities
                  </h3>

                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {programActivities.filter(a => a.progress?.status_code !== "completed" && a.progress?.status_code !== "reviewed").length > 0 ? (
                      programActivities.filter(a => a.progress?.status_code !== "completed" && a.progress?.status_code !== "reviewed").map((act) => {
                        const isProjectOrAssignment = act.activity_type_code === "project" || act.activity_type_code === "assignment";
                        const typeLabel = act.activity_type_code === "quiz" ? "Quiz" : isProjectOrAssignment ? "Assignment" : "Challenge";
                        const typeColor = 
                          act.activity_type_code === "quiz" 
                            ? "bg-purple-50 text-purple-700 border-purple-100" 
                            : isProjectOrAssignment
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-cyan-50 text-cyan-700 border-cyan-100";
                        
                        return (
                          <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-3 bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="min-w-0">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border capitalize ${typeColor}`}>
                                {typeLabel}
                              </span>
                              <h4 className="font-bold text-[#0F172A] text-xs truncate mt-1.5">{act.title}</h4>
                              <p className="text-[9px] text-[#64748B] mt-0.5 font-medium">Status: {act.progress?.status_code || "assigned"}</p>
                            </div>

                            <button
                              onClick={() => {
                                if (act.activity_type_code === "quiz") {
                                  setActiveTab("quizzes");
                                  handleEnterQuiz(act);
                                } else if (isProjectOrAssignment) {
                                  setActiveTab("projects");
                                  handleEnterProject(act);
                                } else {
                                  setActiveTab("challenges");
                                  handleEnterChallenge(act);
                                }
                              }}
                              className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 text-[#2563EB] px-3 py-2 sm:py-1.5 rounded-lg text-[9px] font-bold shrink-0 transition-all cursor-pointer shadow-2xs w-full sm:w-auto min-h-[36px]"
                            >
                              Open
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 bg-slate-50/20 rounded-xl border border-dashed border-[#E2E8F0] space-y-1">
                        <CheckCircle className="text-emerald-500 mx-auto" size={18} />
                        <span className="text-[10px] text-[#64748B] font-bold block">All activities completed!</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: ACADEMICS / SYLLABUS VIEWER */}
        {activeTab === "academics" && (
          <div className="space-y-6 w-full max-w-full overflow-hidden">
            {!selectedCohort ? (
              <div className="text-center py-8 text-[#475569] font-medium bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                You are not currently enrolled in any active groups. Please contact your administrator.
              </div>
            ) : !selectedCourse ? (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 w-full max-w-full overflow-hidden">
                <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3 mb-3">
                  <span className="font-bold text-[#0F172A]">Courses under {selectedCohort.name} ({selectedCohort.code})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeCoursesList.length > 0 ? (
                    activeCoursesList.map((course: any) => (
                      <div
                        key={course.id}
                        onClick={() => handleSelectCourse(course)}
                        className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#2563EB]/20 transition-all flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-lg">
                              <BookOpen size={16} />
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-50 text-[#475569] border-[#E2E8F0]">
                              {course.course_type}
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-xs text-[#0F172A] mb-1">{course.title}</h3>
                          <p className="text-[10px] text-[#475569] line-clamp-2 leading-relaxed mb-4">
                            {course.description || "No course description provided."}
                          </p>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-[10px] text-[#475569]">
                            <span>Progress</span>
                            <span className="font-bold">{course.progress?.progress_percentage || 0}%</span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] h-1 rounded-full overflow-hidden">
                            <div className="bg-[#2563EB] h-full rounded-full" style={{ width: `${course.progress?.progress_percentage || 0}%` }}></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] text-[10px] text-[#475569]">
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {course.duration_minutes || 0} mins
                          </span>
                          <span className="flex items-center gap-0.5 font-bold text-[#2563EB] hover:underline">
                            Start Learning <ArrowRight size={11} />
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-[#475569] font-medium bg-slate-50/20 rounded-xl">
                      No assigned courses registered under this program.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 w-full max-w-full">
                {/* Course Header Bar */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 w-full">
                  <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-2.5">
                    <button
                      onClick={() => {
                        setSelectedCourse(null);
                        setActiveLesson(null);
                      }}
                      className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Courses
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="font-semibold text-[#0F172A] truncate max-w-[140px] sm:max-w-[300px] md:max-w-[420px]">{selectedCourse.title}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50 border border-[#E2E8F0] rounded-xl p-4">
                    <div className="min-w-0">
                      <h4 className="font-bold text-[#0F172A] text-sm break-words">{selectedCourse.title}</h4>
                      <p className="text-[#475569] text-[10px] mt-1">{selectedCourse.description || "No description set."}</p>
                    </div>
                    <div className="bg-white px-3 py-2 rounded-lg border border-[#E2E8F0] text-center shrink-0 self-start sm:self-auto">
                      <p className="font-bold text-[#0F172A] text-xs font-mono">{selectedCourse.progress?.progress_percentage || 0}%</p>
                      <p className="text-[8px] text-[#475569] font-bold uppercase tracking-wider mt-0.5">COMPLETED</p>
                    </div>
                  </div>
                </div>

                {/* 2-Column Workspace Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full max-w-full">
                  
                  {/* Left Column: Lesson Player */}
                  <div className="lg:col-span-2 space-y-6 w-full min-w-0">
                    {activeLesson ? (
                      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 w-full overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                          <div>
                            <span className="bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/15 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                              {activeLesson.lesson_type?.description || "Theory Material"}
                            </span>
                            <h4 className="font-bold text-base text-[#0F172A] mt-2 tracking-tight">{activeLesson.title}</h4>
                          </div>
                          {(() => {
                            const isCompleted = lessonProgressMap[activeLesson.id]?.status_code === "completed";
                            if (isCompleted) {
                              return (
                                <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0">
                                  <CheckCircle size={11} /> Completed
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {activeLesson.video_url && (() => {
                          const ytMatch = activeLesson.video_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
                          if (ytMatch && ytMatch[1]) {
                            return (
                              <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-855 shadow-sm mb-4">
                                <iframe
                                  src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={activeLesson.title}
                                />
                              </div>
                            );
                          } else if (activeLesson.video_url.match(/\.(mp4|webm|ogg)/i) || activeLesson.video_url.includes("storage.googleapis.com") || activeLesson.video_url.includes("amazonaws.com")) {
                            return (
                              <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-855 shadow-sm mb-4">
                                <video
                                  src={activeLesson.video_url}
                                  className="w-full h-full"
                                  controls
                                  preload="metadata"
                                />
                              </div>
                            );
                          } else {
                            const pdfUrl = activeLesson.video_url;
                            const isPdf = pdfUrl.toLowerCase().includes(".pdf") || pdfUrl.toLowerCase().includes("/object/public/") || pdfUrl.toLowerCase().includes("supabase") || pdfUrl.toLowerCase().includes("drive.google.com");
                            if (isPdf) {
                              return (
                                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm h-[380px] sm:h-[480px] md:h-[600px] w-full flex flex-col mb-4">
                                  <div className="bg-slate-50 border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                                      <File size={13} className="text-[#2563EB]" /> Embedded PDF Study Material
                                    </span>
                                    <a 
                                      href={pdfUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-[#2563EB] hover:underline font-bold flex items-center gap-0.5"
                                    >
                                      Open in New Tab <ExternalLink size={10} />
                                    </a>
                                  </div>
                                  <iframe
                                    src={pdfUrl}
                                    className="w-full h-full border-0"
                                    title={activeLesson.title}
                                  />
                                </div>
                              );
                            }

                            return (
                              <div className="bg-slate-900 aspect-video rounded-xl flex flex-col items-center justify-center text-white p-6 text-center border border-slate-800 shadow-sm mb-4">
                                <Play size={32} className="text-[#2563EB] mb-2 fill-[#2563EB]" />
                                <p className="text-xs font-semibold mb-3">External Video Resource</p>
                                <a
                                  href={activeLesson.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-bold text-[11px] px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                  Play Video External Link <ExternalLink size={10} />
                                </a>
                              </div>
                            );
                          }
                        })()}

                        {(activeLesson.content_json?.body || activeLesson.content_json?.text) && (
                          <div className="bg-white border border-[#E2E8F0] p-4 sm:p-6 md:p-8 rounded-2xl shadow-subtle space-y-4">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-3">
                              📖 Lesson Syllabus & Study Guide
                            </h4>
                            <div className="prose max-w-none text-slate-700 leading-relaxed text-[13px]">
                              <MarkdownRenderer content={activeLesson.content_json.body || activeLesson.content_json.text} />
                            </div>
                          </div>
                        )}

                        {activeLesson.resources && activeLesson.resources.length > 0 && (
                          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-2xs">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                              <File size={11} className="text-slate-400" /> Attached Reference Documents & Code blue prints
                            </p>
                            <div className="divide-y divide-[#E2E8F0] text-xs">
                              {activeLesson.resources.map((res: any) => {
                                const downloadUrl = res.external_url || res.file_url || res.resource_url;
                                return (
                                  <div key={res.id} className="py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-[#0f172a]">{res.title}</span>
                                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[8px] text-[#475569] uppercase font-mono font-bold shrink-0">{res.resource_type || "File"}</span>
                                    </div>
                                    {downloadUrl && (
                                      <a 
                                        href={downloadUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[#2563EB] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
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
                        <div className="border-t border-[#E2E8F0] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                          <div>
                            <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Milestone Status</p>
                            <p className="text-xs text-[#0F172A] font-semibold mt-0.5">
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
                                  <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                                    <CheckCircle size={13} /> Lesson Completed
                                  </span>
                                );
                              }

                              return (
                                <button
                                  onClick={() => handleCompleteLesson(activeLesson)}
                                  disabled={actionLoading}
                                  className="bg-[#2563EB] hover:bg-[#2563EB]/95 text-white px-4.5 py-2.5 rounded-xl shadow-sm text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5 disabled:opacity-50 select-none"
                                >
                                  Mark Lesson as Completed
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center shadow-sm text-slate-500 font-semibold w-full">
                        Please select a lesson from the syllabus outline to start learning.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Syllabus Curriculum outline */}
                  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 w-full min-w-0">
                    <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wide border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5">
                      <BookOpenCheck size={14} className="text-[#2563EB]" /> Course Syllabus
                    </h3>
                    
                    {loading ? (
                      <div className="flex flex-col gap-4">
                        <div className="h-12 bg-slate-100 animate-pulse rounded-xl"></div>
                        <div className="h-12 bg-slate-100 animate-pulse rounded-xl"></div>
                      </div>
                    ) : modules.length > 0 ? (
                      <div className="space-y-4">
                        {modules.map((mod) => (
                          <div key={mod.id} className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs bg-white">
                            <div className="bg-slate-50/70 px-4 py-3.5 border-b border-[#E2E8F0] flex flex-col gap-1">
                              <p className="font-bold text-xs text-[#0F172A] tracking-tight">
                                Module {mod.position}: {mod.title}
                              </p>
                              {mod.description && <p className="text-[10px] text-[#475569] mt-0.5 font-medium">{mod.description}</p>}
                            </div>

                            <div className="p-4 space-y-3 bg-white">
                              {mod.lessons && mod.lessons.length > 0 ? (
                                mod.lessons.map((les: any) => {
                                  const progState = lessonProgressMap[les.id];
                                  const isCompleted = progState?.status_code === "completed";
                                  const isInProgress = progState?.status_code === "in_progress";
                                  
                                  const typeCode = (les.lesson_type?.code || "lesson").toLowerCase();
                                  const typeBadge = 
                                    typeCode.includes("video") 
                                      ? "bg-purple-50 text-purple-700 border-purple-100"
                                      : typeCode.includes("interactive") || typeCode.includes("code")
                                      ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                                      : "bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/15";

                                  const isActive = activeLesson?.id === les.id;
                                    
                                  return (
                                    <div 
                                      key={les.id} 
                                      onClick={() => handleStartLesson(les)}
                                      className={`border rounded-xl p-3 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer select-none ${
                                        isActive
                                          ? "border-[#2563EB] ring-2 ring-[#2563EB]/10 bg-[#2563EB]/5"
                                          : isCompleted 
                                          ? "border-emerald-100 bg-emerald-50/10" 
                                          : isInProgress 
                                          ? "border-[#2563EB]/20 bg-[#2563EB]/5" 
                                          : "border-[#E2E8F0] bg-white hover:border-[#2563EB]/15 hover:bg-slate-50/50"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="shrink-0">
                                          {isCompleted ? (
                                            <CheckCircle2 size={16} className="text-[#16A34A] fill-[#16A34A]/5" />
                                          ) : isInProgress ? (
                                            <Circle size={16} className="text-[#F59E0B] fill-[#F59E0B]/10 animate-pulse" />
                                          ) : (
                                            <Circle size={16} className="text-[#94A3B8]" />
                                          )}
                                        </div>
                                        
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`font-semibold text-xs tracking-tight truncate max-w-[140px] sm:max-w-xs ${isCompleted ? 'text-[#475569] line-through' : 'text-[#0F172A]'}`}>
                                              {les.title}
                                            </span>
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border shrink-0 ${typeBadge}`}>
                                              {les.lesson_type?.code || "lesson"}
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-[#475569] font-mono mt-0.5 flex items-center gap-1">
                                            <Clock size={9} /> {les.duration || 0} mins
                                          </div>
                                        </div>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartLesson(les);
                                          }}
                                          className="hidden sm:inline-block bg-white border border-[#E2E8F0] hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 px-3 py-1.5 rounded-lg font-bold text-[#0F172A] text-[10px] shadow-2xs transition-all cursor-pointer"
                                        >
                                          Open Lesson
                                        </button>
                                        <ChevronRight size={14} className="text-slate-400 sm:hidden shrink-0" />
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-[10px] text-[#475569] font-medium text-center py-2 bg-slate-50/50 rounded-lg border border-dashed border-[#E2E8F0]">
                                  No lessons in this module.
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-slate-50/30 rounded-xl border border-dashed border-[#E2E8F0] text-[#475569] font-medium">
                        No curriculum modules have been defined for this course.
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUIZZES */}
        {activeTab === "quizzes" && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedQuizActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
                  <FileQuestion className="text-[#2563EB]" size={16} /> My Assigned Quizzes
                </h3>
                {loadingActivities ? (
                  <p className="text-slate-500 animate-pulse py-4 font-semibold text-center">Loading quizzes...</p>
                ) : programActivities.filter(a => a.activity_type_code === "quiz").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "quiz").map((act) => (
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4.5 bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-md hover:border-[#2563EB]/15 transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#0F172A]">{act.title}</h4>
                          <p className="text-[#475569] text-[10px] mt-1.5 max-w-xl leading-relaxed">{act.description || "No description provided."}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[9px]">
                            <span className={`px-2 py-0.5 rounded font-bold border uppercase ${
                              act.progress?.status_code === "completed" || act.progress?.status_code === "passed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : act.progress?.status_code === "started"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-slate-50 text-[#475569] border-[#E2E8F0]"
                            }`}>
                              Status: {act.progress?.status_code || "assigned"}
                            </span>
                            {act.progress?.score !== null && (
                              <span className="bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded font-bold border border-[#16A34A]/15">
                                Score: {act.progress?.score} / {act.progress?.max_score || 100}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterQuiz(act)}
                          className="bg-[#2563EB] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center justify-center gap-1 text-[10px] shrink-0 w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Quiz <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No quizzes assigned to your group.</p>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3">
                  <button
                    onClick={() => {
                      setSelectedQuizActivity(null);
                      setQuizDetails(null);
                      setQuizQuestions([]);
                    }}
                    className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Quizzes
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#0F172A]">{selectedQuizActivity.title}</span>
                </div>

                {loading ? (
                  <p className="text-slate-500 animate-pulse text-center py-8">Loading quiz details...</p>
                ) : (
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
                              <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                                <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Questions Count</span>
                                <span className="font-bold text-[#0F172A] text-xs">{quizQuestions.length} Questions</span>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                                <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Attempts Done</span>
                                <span className="font-bold text-[#0F172A] text-xs font-mono">{selectedQuizActivity.progress?.attempt_number || 0} / {quizDetails.max_attempts}</span>
                              </div>
                              {assignment?.available_from && (
                                <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                                  <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Available From</span>
                                  <span className="font-bold text-[#0F172A] text-[11px]">{new Date(assignment.available_from).toLocaleString()}</span>
                                </div>
                              )}
                              {assignment?.available_until && (
                                <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                                  <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Due Date</span>
                                  <span className={`font-bold text-[11px] ${isPastDue ? 'text-red-600' : 'text-[#0F172A]'}`}>{new Date(assignment.available_until).toLocaleString()}</span>
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
                            ) : (selectedQuizActivity.progress?.attempt_number || 0) >= quizDetails.max_attempts ? (
                              <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-lg p-3.5 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} />
                                <span>You have reached the maximum allowed attempts limit for this quiz. Retakes are locked.</span>
                              </div>
                            ) : (
                              <button
                                onClick={handleStartQuiz}
                                disabled={actionLoading}
                                className="bg-[#2563EB] text-white px-5 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all text-xs flex items-center gap-1.5 disabled:opacity-50 font-sans"
                              >
                                <Play size={13} fill="white" /> Start Quiz Attempt
                              </button>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Quiz Questions List / Active Test screen */}
                    {activeAttempt && (
                      <div className="space-y-6">
                        <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-xl p-4 flex justify-between items-center">
                          <span className="font-semibold text-[#2563EB] text-[10px] uppercase tracking-wider">Attempt #{activeAttempt.attempt_number} in progress...</span>
                          {timeLeft !== null ? (
                            <span className="bg-white border border-red-200 px-3 py-1.5 rounded font-mono font-bold text-xs text-red-600 flex items-center gap-1.5 animate-pulse">
                              <Clock size={13} /> Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          ) : (
                            <span className="bg-white border border-[#2563EB]/30 px-3 py-1 rounded font-bold text-xs text-[#2563EB]">Time Started: {new Date(activeAttempt.started_at).toLocaleTimeString()}</span>
                          )}
                        </div>

                        <div className="space-y-6">
                          {quizQuestions.map((q, idx) => (
                            <div key={q.id} className="border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                              <h4 className="font-bold text-xs text-[#0f172a] flex gap-2">
                                <span className="text-[#2563EB]">Q{idx + 1}.</span> {q.question_text}
                                <span className="font-mono text-[9px] text-[#475569] bg-slate-100 px-1.5 py-0.5 rounded">({q.points} pts)</span>
                              </h4>

                              <div className="grid grid-cols-1 gap-2.5">
                                {q.options?.map((opt: any) => {
                                  const isSelected = selectedAnswers[q.id]?.includes(opt.id) || false;
                                  return (
                                    <label
                                      key={opt.id}
                                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-all ${
                                        isSelected
                                          ? "border-[#2563EB] bg-[#2563EB]/5 font-semibold text-[#2563EB]"
                                          : "border-[#E2E8F0] bg-white text-[#475569]"
                                      }`}
                                    >
                                      <input
                                        type={q.question_type === "multiple_choice" ? "checkbox" : "radio"}
                                        name={q.id}
                                        value={opt.id}
                                        checked={isSelected}
                                        onChange={() => handleOptionSelect(q.id, opt.id, q.question_type)}
                                        className="accent-[#2563EB]"
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
                          className="bg-[#16A34A] text-white px-5 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#16A34A]/95 transition-all text-xs flex items-center gap-1.5 disabled:opacity-50 w-full justify-center"
                        >
                          <Send size={13} /> Submit Quiz Answers
                        </button>
                      </div>
                    )}
                    {quizSubmittedResult && (
                      <div className="border border-[#16A34A]/20 bg-[#16A34A]/5 rounded-xl p-6 space-y-5 text-center">
                        <Award size={48} className="text-[#16A34A] mx-auto" />
                        <div>
                          <h4 className="font-bold text-sm text-[#0F172A]">Quiz Submitted Successfully!</h4>
                          <p className="text-[#475569] text-xs mt-1">
                            {quizDetails.show_results_immediately 
                              ? "Your grading calculations have completed." 
                              : "Your answers have been recorded. Grades will be released by the instructor."}
                          </p>
                        </div>

                        {quizDetails.show_results_immediately && (
                          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-xs pt-2">
                            <div className="bg-white p-3 border border-[#E2E8F0] rounded-xl">
                              <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wider">Score</span>
                              <span className="font-bold text-xs text-[#0F172A]">{quizSubmittedResult.score} / {quizSubmittedResult.max_score}</span>
                            </div>
                            <div className="bg-white p-3 border border-[#E2E8F0] rounded-xl">
                              <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Passed</span>
                              <span className={`font-bold text-xs uppercase ${quizSubmittedResult.passed ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                                {quizSubmittedResult.passed ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="bg-white p-3 border border-[#E2E8F0] rounded-xl">
                              <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wider">Duration</span>
                              <span className="font-bold text-xs text-[#0F172A]">{quizSubmittedResult.time_spent_seconds} Secs</span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setQuizSubmittedResult(null);
                            setSelectedQuizActivity(null);
                          }}
                          className="bg-white border border-[#E2E8F0] text-[#0F172A] px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all text-xs"
                        >
                          Return to Quiz List
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROJECTS */}
        {activeTab === "projects" && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedProjectActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
                  <FolderCode className="text-[#2563EB]" size={16} /> My Assigned Projects & Assignments
                </h3>
                {loadingActivities ? (
                  <p className="text-slate-500 animate-pulse py-4 font-semibold text-center">Loading projects & assignments...</p>
                ) : programActivities.filter(a => a.activity_type_code === "project" || a.activity_type_code === "assignment").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "project" || a.activity_type_code === "assignment").map((act) => (
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4.5 bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-md hover:border-[#2563EB]/15 transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#0F172A]">{act.title}</h4>
                          <p className="text-[#475569] text-[10px] mt-1.5 max-w-xl leading-relaxed">{act.description || "No description provided."}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[9px]">
                            <span className={`px-2 py-0.5 rounded font-bold border uppercase ${
                              act.progress?.status_code === "completed" || act.progress?.status_code === "reviewed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : act.progress?.status_code === "submitted"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : act.progress?.status_code === "started"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-slate-50 text-[#475569] border-[#E2E8F0]"
                            }`}>
                              Status: {act.progress?.status_code || "assigned"}
                            </span>
                            {act.progress?.score !== null && (
                              <span className="bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded font-bold border border-[#16A34A]/15">
                                Score: {act.progress?.score} / {act.progress?.max_score || 100}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterProject(act)}
                          className="bg-[#2563EB] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center justify-center gap-1 text-[10px] shrink-0 w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Project <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No projects assigned to your group.</p>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3">
                  <button
                    onClick={() => {
                      setSelectedProjectActivity(null);
                      setProjectDetails(null);
                    }}
                    className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Projects
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#0F172A]">{selectedProjectActivity.title}</span>
                </div>

                {loading ? (
                  <p className="text-slate-500 animate-pulse text-center py-8">Loading details...</p>
                ) : projectDetails && (
                  <div className="space-y-6">
                    <div className="border border-[#E2E8F0] rounded-xl p-5 bg-slate-50/20 space-y-4 text-xs">
                      <div>
                        <h4 className="font-bold text-[#0F172A] text-xs">Project Overview</h4>
                        <p className="text-[#475569] leading-relaxed mt-1">{projectDetails.project_overview}</p>
                      </div>

                      {projectDetails.requirements && (
                        <div>
                          <h4 className="font-bold text-[#0F172A] text-xs">Requirements</h4>
                          <p className="text-[#475569] leading-relaxed mt-1 whitespace-pre-line">{projectDetails.requirements}</p>
                        </div>
                      )}

                      {projectDetails.deliverables && (
                        <div>
                          <h4 className="font-bold text-[#0F172A] text-xs">Deliverables</h4>
                          <p className="text-[#475569] leading-relaxed mt-1 whitespace-pre-line">{projectDetails.deliverables}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-[#E2E8F0]">
                        <div>
                          <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Difficulty</span>
                          <span className="font-bold text-[#0F172A] text-xs capitalize">{projectDetails.difficulty_level || "intermediate"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Estimated Hours</span>
                          <span className="font-bold text-[#0F172A] text-xs">{projectDetails.estimated_hours || 0} hrs</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#475569] font-bold block uppercase tracking-wide">Max Score</span>
                          <span className="font-bold text-[#0F172A] text-xs">{projectDetails.max_score} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* GitHub submission module */}
                    <div className="border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-xs text-[#0f172a] flex items-center gap-1">
                        <FolderCode className="text-[#2563EB]" size={14} /> Submission Form
                      </h4>

                      {projectSubmission && (
                        <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-lg p-3 text-[10px] font-semibold flex items-center gap-2">
                          <CheckCircle2 size={12} />
                          <span>Last Submitted: {new Date(projectSubmission.submitted_at).toLocaleString()}</span>
                        </div>
                      )}

                      <div className="space-y-3 text-xs">
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-[#0f172a]">GitHub Repository URL</label>
                          <input
                            type="text"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            placeholder="https://github.com/username/repository"
                            className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 w-full text-xs outline-none focus:border-[#2563EB] transition-all"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-[#0f172a]">Submission Notes (optional)</label>
                          <textarea
                            value={submissionNotes}
                            onChange={(e) => setSubmissionNotes(e.target.value)}
                            placeholder="Write details or instructions for running the codebase here..."
                            rows={3}
                            className="bg-white border border-[#E2E8F0] rounded-lg p-3 w-full text-xs outline-none focus:border-[#2563EB] transition-all"
                          />
                        </div>

                        <button
                          onClick={handleSubmitProjectUrl}
                          disabled={actionLoading}
                          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2563EB]/95 transition-all text-xs disabled:opacity-50"
                        >
                          Submit Project Repository
                        </button>
                      </div>
                    </div>

                    {/* Mentor review block */}
                    {projectReview && (
                      <div className="border border-[#F59E0B]/20 bg-[#F59E0B]/5 rounded-xl p-5 space-y-3">
                        <h4 className="font-bold text-xs text-[#F59E0B] uppercase tracking-wide">Mentor Review Output</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                          <div>
                            <span className="text-[9px] text-[#475569] block">Review Status</span>
                            <span className="capitalize">{projectReview.review_status}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#475569] block">Score Awarded</span>
                            <span>{projectReview.score !== null ? `${projectReview.score} / ${projectDetails.max_score}` : "Not Graded"}</span>
                          </div>
                        </div>
                        {projectReview.feedback && (
                          <div className="bg-white p-3 rounded-lg border border-[#e2e8f0] text-[#475569] mt-2">
                            <span className="text-[9px] font-bold text-[#0f172a] block mb-1">Mentor Feedback</span>
                            <p className="italic">{projectReview.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PROGRAMMING CHALLENGES */}
        {activeTab === "challenges" && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
            {!selectedChallengeActivity ? (
              <>
                <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
                  <TerminalIcon className="text-[#2563EB]" size={16} /> My Assigned Coding Challenges
                </h3>
                {loadingActivities ? (
                  <p className="text-slate-500 animate-pulse py-4 font-semibold text-center">Loading challenges...</p>
                ) : programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming").length > 0 ? (
                  <div className="space-y-4">
                    {programActivities.filter(a => a.activity_type_code === "programming_challenge" || a.activity_type_code === "programming").map((act) => (
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4 bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-sm transition-all">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#0F172A]">{act.title}</h4>
                          <p className="text-[#475569] text-[10px] mt-1 line-clamp-1">{act.description}</p>
                          <div className="flex flex-wrap gap-2 text-[9px] text-[#475569] font-semibold mt-2.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded uppercase font-bold border text-slate-700">Status: {act.progress?.status_code}</span>
                            {act.progress?.score !== null && (
                              <span className="bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded font-bold border border-[#16A34A]/20">Score: {act.progress?.score} / {act.progress?.max_score || 100}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterChallenge(act)}
                          className="bg-[#2563EB] text-white px-3.5 py-2 sm:py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/90 transition-all flex items-center justify-center gap-1 text-[10px] w-full sm:w-auto min-h-[36px]"
                        >
                          Enter Challenge <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No challenges assigned to your group.</p>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3">
                  <button
                    onClick={() => {
                      setSelectedChallengeActivity(null);
                      setChallengeDetails(null);
                      setSelectedSubmissionForResults(null);
                      setSubmissionResults(null);
                    }}
                    className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft size={14} /> Challenges
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-[#0F172A]">{selectedChallengeActivity.title}</span>
                </div>

                {loading ? (
                  <p className="text-slate-500 animate-pulse text-center py-8">Loading details...</p>
                ) : challengeDetails && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* Left: Problem statement & Examples */}
                    <div className="space-y-6">
                      <div className="border border-[#E2E8F0] rounded-xl p-5 bg-slate-50/20 space-y-4">
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-[#0F172A] text-xs">Problem Statement</h4>
                            <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/20">
                              {challengeDetails.difficulty_level}
                            </span>
                          </div>
                          <p className="text-[#475569] leading-relaxed mt-2 whitespace-pre-line">{challengeDetails.problem_statement}</p>
                        </div>

                        {challengeDetails.instructions && (
                          <div className="bg-[#2563EB]/5 border border-[#2563EB]/15 p-3 rounded-lg text-xs text-[#0f172a] space-y-1">
                            <span className="font-bold text-[#2563EB] block text-[9px] uppercase tracking-wider">💡 Instructions & Hints</span>
                            <p className="leading-relaxed whitespace-pre-wrap">{challengeDetails.instructions}</p>
                          </div>
                        )}

                        {challengeDetails.input_format && (
                          <div>
                            <h4 className="font-bold text-[#0F172A] text-xs">Input Format</h4>
                            <p className="text-[#475569] leading-relaxed mt-1">{challengeDetails.input_format}</p>
                          </div>
                        )}

                        {challengeDetails.output_format && (
                          <div>
                            <h4 className="font-bold text-[#0F172A] text-xs">Output Format</h4>
                            <p className="text-[#475569] leading-relaxed mt-1">{challengeDetails.output_format}</p>
                          </div>
                        )}

                        {challengeDetails.constraints_text && (
                          <div>
                            <h4 className="font-bold text-[#0F172A] text-xs">Constraints</h4>
                            <p className="text-[#475569] font-mono leading-relaxed mt-1 text-[10px] bg-slate-100 p-2 rounded">{challengeDetails.constraints_text}</p>
                          </div>
                        )}
                      </div>

                      {/* Examples */}
                      {challengeExamples.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-xs text-[#0F172A] uppercase tracking-wide">Visible Examples</h4>
                          {challengeExamples.map((ex) => (
                            <div key={ex.id} className="border border-[#E2E8F0] rounded-xl p-4 bg-white space-y-2">
                              <p className="font-bold text-[#2563EB] text-[10px]">Example {ex.example_number}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono bg-slate-50 p-2 rounded border border-[#E2E8F0] overflow-x-auto">
                                <div>
                                  <span className="font-bold text-[#0f172a] block mb-0.5">Input</span>
                                  <span className="text-[#475569]">{ex.input_example}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-[#0f172a] block mb-0.5">Output</span>
                                  <span className="text-[#475569]">{ex.output_example}</span>
                                </div>
                              </div>
                              {ex.explanation && <p className="text-[10px] text-[#475569] italic">Explanation: {ex.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Code editor & submissions list */}
                    <div className="space-y-6">
                      <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white space-y-4">
                        <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                          <h4 className="font-bold text-xs text-[#0f172a] flex items-center gap-1">
                            <Code size={14} className="text-[#2563EB]" /> Code Editor
                          </h4>
                          <select
                            value={editorLanguage}
                            onChange={(e) => setEditorLanguage(e.target.value)}
                            className="bg-slate-50 border border-[#E2E8F0] rounded-md px-2 py-1 text-[10px] font-semibold text-[#0F172A] outline-none"
                          >
                            <option value="javascript">JavaScript (Node.js)</option>
                            <option value="python">Python 3</option>
                            <option value="java">Java (OpenJDK)</option>
                            <option value="cpp">C++ (GCC)</option>
                            <option value="c">C (GCC)</option>
                          </select>
                        </div>

                        <textarea
                          value={editorCode}
                          onChange={(e) => setEditorCode(e.target.value)}
                          rows={12}
                          className="bg-[#0F172A] text-emerald-400 font-mono p-4 rounded-xl w-full text-[10px] outline-none border border-slate-800 leading-normal"
                          placeholder="// Write your code solution here..."
                        />

                        <button
                          onClick={handleSubmitChallenge}
                          disabled={actionLoading}
                          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2563EB]/95 transition-all text-xs disabled:opacity-50 w-full flex justify-center items-center gap-1.5"
                        >
                          <Send size={12} /> Submit Solution
                        </button>
                      </div>

                      {/* Submissions list */}
                      <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white space-y-4">
                        <h4 className="font-bold text-xs text-[#0f172a] flex items-center gap-1">
                          <History size={14} className="text-[#2563EB]" /> Submission History ({challengeSubmissions.length})
                        </h4>

                        <div className="divide-y divide-[#E2E8F0] max-h-48 overflow-y-auto pr-1">
                          {challengeSubmissions.map((sub) => (
                            <div key={sub.id} className="py-2.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                              <div>
                                <span className="font-bold capitalize text-[#0F172A]">{sub.language}</span>
                                <span className="text-[10px] text-[#475569] ml-2">{new Date(sub.submitted_at).toLocaleTimeString()}</span>
                                <div className="mt-1 flex gap-2">
                                  <span className={`px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] uppercase border ${
                                    sub.submission_status_code === "accepted"
                                      ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                                      : sub.submission_status_code === "pending" || sub.submission_status_code === "running"
                                      ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                                      : "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                                  }`}>
                                    {sub.submission_status_code}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewSubmissionResults(sub)}
                                className="text-[#2563EB] hover:underline font-bold text-[10px]"
                              >
                                View Results
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detailed submission results */}
                      {selectedSubmissionForResults && submissionResults && (
                        <div className="border border-[#E2E8F0] bg-slate-50/50 rounded-xl p-5 space-y-4 text-xs">
                          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                            <h4 className="font-bold text-[#0F172A] text-xs">Grading & Execution Report</h4>
                            <span className="font-mono text-[9px] text-[#475569]">ID: {selectedSubmissionForResults.id.substring(0, 8)}</span>
                          </div>

                          {submissionResults.result ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                              <div className="bg-white p-2 border border-[#E2E8F0] rounded-lg">
                                <span className="text-[9px] text-[#475569] block">Passed Cases</span>
                                <span className="font-bold text-[#16A34A]">{submissionResults.result.passed_test_cases} / {submissionResults.result.total_test_cases}</span>
                              </div>
                              <div className="bg-white p-2 border border-[#E2E8F0] rounded-lg">
                                <span className="text-[9px] text-[#475569] block">Time Spent</span>
                                <span className="font-bold">{submissionResults.result.execution_time_ms ?? 0} ms</span>
                              </div>
                              <div className="bg-white p-2 border border-[#E2E8F0] rounded-lg">
                                <span className="text-[9px] text-[#475569] block">Memory Used</span>
                                <span className="font-bold">{submissionResults.result.memory_used_kb ?? 0} KB</span>
                              </div>
                              <div className="bg-white p-2 border border-[#E2E8F0] rounded-lg">
                                <span className="text-[9px] text-[#475569] block">Score</span>
                                <span className="font-bold text-[#2563EB]">{submissionResults.result.score ?? 0} pts</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 text-[#F59E0B] p-3 rounded-lg flex items-center gap-1.5 font-semibold">
                              <AlertTriangle size={14} />
                              <span>Submission is currently: {selectedSubmissionForResults.submission_status_code}. Grading results will update automatically.</span>
                            </div>
                          )}

                          {/* Logs list */}
                          {submissionResults.logs?.length > 0 && (
                            <div className="space-y-2">
                              <span className="font-bold text-[#0F172A] block">Execution Output Logs</span>
                              <div className="bg-[#0F172A] text-[#E2E8F0] p-3 rounded-xl font-mono text-[9px] max-h-32 overflow-y-auto space-y-1">
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
            )}
          </div>
        )}
      </div>

    </div>
  </div>
    </>
  );
}
