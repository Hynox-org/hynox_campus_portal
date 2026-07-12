"use client";

import React, { useState, useEffect } from "react";
import { 
  listModulesAction, 
  listLessonsAction, 
  listLessonResourcesAction 
} from "@/app/actions/academic-actions";
import { 
  startOrUpdateLessonProgressAction,
  completeLessonProgressAction,
  getStudentDeliveryDataAction
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

interface StudentConsoleProps {
  studentEmail: string;
  fullName: string;
  primaryRole: string;
  institution: any;
  initialPrograms: any[];
  studentId: string;
}

export default function StudentConsole({ 
  studentEmail, 
  fullName, 
  primaryRole, 
  institution, 
  initialPrograms,
  studentId
}: StudentConsoleProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "academics" | "quizzes" | "projects" | "challenges">("overview");
  const [activeParentTab, setActiveParentTab] = useState<"overview" | "curriculum" | "assessments">("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Academics exploration state
  const [programs, setPrograms] = useState<any[]>(initialPrograms);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(initialPrograms[0] || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, any>>({});
  const [activeLesson, setActiveLesson] = useState<any | null>(null);

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
      const cohortId = selectedProgram?.cohorts?.[0]?.id;
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
  }, [selectedProgram, studentId]);

  // Load activities on mount or tab change
  const loadActivities = async () => {
    setLoadingActivities(true);
    const res = await getStudentAssignedActivitiesAction(studentId);
    if (res.activities) {
      setActivities(res.activities);
    } else if (res.error) {
      setError(res.error);
    }
    setLoadingActivities(false);
  };

  useEffect(() => {
    refreshStudentData();
  }, [studentId]);

  const refreshStudentData = async () => {
    const res = await getStudentDeliveryDataAction(studentId);
    if (res.programs) {
      setPrograms(res.programs);
      if (selectedProgram) {
        const updatedProg = res.programs.find(p => p.id === selectedProgram.id);
        if (updatedProg) {
          setSelectedProgram(updatedProg);
          if (selectedCourse) {
            const updatedCourse = updatedProg.courses.find((c: any) => c.id === selectedCourse.id);
            if (updatedCourse) {
              setSelectedCourse(updatedCourse);
            }
          }
        }
      } else if (res.programs.length > 0) {
        setSelectedProgram(res.programs[0]);
      }
    }
    await loadActivities();
  };

  const handleSelectProgram = (program: any) => {
    setSelectedProgram(program);
    setSelectedCourse(null);
    setModules([]);
    setActiveLesson(null);
  };

  const handleSelectCourse = async (course: any) => {
    setLoading(true);
    setError("");
    setActiveLesson(null);

    // Sync and fetch latest program delivery course details (forces real-time progress calculations)
    const deliverRes = await getStudentDeliveryDataAction(studentId);
    if (deliverRes.programs) {
      setPrograms(deliverRes.programs);
      if (selectedProgram) {
        const updatedProg = deliverRes.programs.find(p => p.id === selectedProgram.id);
        if (updatedProg) {
          setSelectedProgram(updatedProg);
          const updatedCourse = updatedProg.courses.find((c: any) => c.id === course.id);
          if (updatedCourse) {
            setSelectedCourse(updatedCourse);
          } else {
            setSelectedCourse(course);
          }
        } else {
          setSelectedCourse(course);
        }
      } else {
        setSelectedCourse(course);
      }
    } else {
      setSelectedCourse(course);
    }
    
    const mRes = await listModulesAction(course.id);
    if (mRes.error) {
      setError(mRes.error);
    } else if (mRes.modules) {
      const modulesWithLessons = await Promise.all(
        mRes.modules.map(async (m: any) => {
          const lRes = await listLessonsAction(m.id);
          const lessons = lRes.lessons || [];
          const lessonsWithResources = await Promise.all(
            lessons.map(async (l: any) => {
              const rRes = await listLessonResourcesAction(l.id);
              
              const progRes = await startOrUpdateLessonProgressAction(studentId, l.id, course.id);
              const progressData = progRes.progress;
              if (progressData) {
                setLessonProgressMap(prev => ({
                  ...prev,
                  [l.id]: progressData
                }));
              }

              return { ...l, resources: rRes.resources || [] };
            })
          );
          return { ...m, lessons: lessonsWithResources };
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
  const activeCohortIds = selectedProgram?.cohorts?.map((c: any) => c.id) || [];
  const programActivities = activities.filter(a => activeCohortIds.includes(a.assignment?.cohort_id));
  const activeCoursesList = selectedProgram?.courses || [];

  const totalEnrolledCourses = selectedProgram?.courses?.length || 0;
  const inProgressCourses = (selectedProgram?.courses || []).filter((c: any) => c.progress?.status_code === "in_progress").length;
  const completedCourses = (selectedProgram?.courses || []).filter((c: any) => c.progress?.status_code === "completed").length;

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

  return (
    <div className="flex flex-col gap-6 w-full">
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
                <span className="text-[9px] text-[#475569] font-bold uppercase tracking-wider">Active Learning Program</span>
                <span className="truncate max-w-[200px] sm:max-w-[320px] font-bold">
                  {selectedProgram ? selectedProgram.title : "No Active Program"}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#475569] ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1.5">
                <div className="px-4 py-1.5 border-b border-[#E2E8F0] text-[9px] font-bold text-[#475569] uppercase tracking-wider">
                  Switch Active Program
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {programs.length > 0 ? (
                    programs.map((prog) => (
                      <button
                        key={prog.id}
                        onClick={() => {
                          handleSelectProgram(prog);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-all flex items-center justify-between text-xs ${
                          selectedProgram?.id === prog.id ? "bg-[#2563EB]/5 text-[#2563EB] font-bold" : "text-[#475569]"
                        }`}
                      >
                        <span className="truncate pr-2">{prog.title}</span>
                        {selectedProgram?.id === prog.id && <CheckCircle2 size={13} className="text-[#2563EB]" />}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-[#475569]">No programs available.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {selectedProgram && selectedProgram.cohorts && (
          <div className="text-[10px] text-[#475569] font-medium flex items-center gap-2">
            <span className="bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">
              Cohort: {selectedProgram.cohorts.map((c: any) => c.code).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start text-xs">
        
        {/* GROUPED DUAL SIDEBAR */}
        <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
          
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
          <div className="space-y-6">
            
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="bg-[#2563EB]/10 text-[#2563EB] p-2.5 rounded-xl">
                  <BookOpen size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] block font-semibold uppercase tracking-wider">Program Progress</span>
                  <span className="text-sm font-bold text-[#0F172A]">
                    {activeCoursesList.length > 0 
                      ? `${Math.round(activeCoursesList.reduce((acc: number, c: any) => acc + (c.progress?.progress_percentage || 0), 0) / activeCoursesList.length)}% Completed`
                      : "0% Completed"}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="bg-[#F59E0B]/10 text-[#F59E0B] p-2.5 rounded-xl">
                  <Clock size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] block font-semibold uppercase tracking-wider">Courses In Progress</span>
                  <span className="text-sm font-bold text-[#0F172A]">{inProgressCourses} / {totalEnrolledCourses} Courses</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="bg-[#16A34A]/10 text-[#16A34A] p-2.5 rounded-xl">
                  <Award size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] block font-semibold uppercase tracking-wider">Tasks Done</span>
                  <span className="text-sm font-bold text-[#0F172A]">{completedActivities} Completed</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="bg-[#06B6D4]/10 text-[#06B6D4] p-2.5 rounded-xl">
                  <FileQuestion size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] block font-semibold uppercase tracking-wider">Pending Tasks</span>
                  <span className="text-sm font-bold text-[#0F172A]">{pendingActivities} Tasks</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Enrolled cohorts and continue learning */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Cohorts info */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                    <GraduationCap className="text-[#2563EB]" size={15} /> Program Cohort Details
                  </h3>
                  
                  {selectedProgram ? (
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-[#E2E8F0]">
                      <div>
                        <h4 className="font-bold text-[#0F172A] text-xs">{selectedProgram.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-[#475569]">
                          <span className="bg-[#2563EB]/15 text-[#2563EB] px-2 py-0.5 rounded font-bold">
                            Cohort: {selectedProgram.cohorts?.map((c: any) => c.code).join(", ") || "N/A"}
                          </span>
                          <span>•</span>
                          <span>{selectedProgram.courses?.length || 0} Assigned Courses</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCourse(null);
                          setActiveLesson(null);
                          setActiveTab("academics");
                        }}
                        className="bg-white border border-[#E2E8F0] text-[#0F172A] px-3 py-1.5 rounded-lg shadow-xs font-semibold hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 transition-all text-[10px] flex items-center gap-1 shrink-0"
                      >
                        Explore Curriculum <ChevronRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#475569] font-medium bg-slate-50/20 rounded-xl border border-dashed border-[#E2E8F0]">
                      No active cohort enrollment found.
                    </div>
                  )}
                </div>

                {/* Continue Learning */}
                {totalEnrolledCourses > 0 && (
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <BookOpenCheck className="text-[#2563EB]" size={15} /> Continue Learning
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(selectedProgram?.courses || []).map((course: any) => {
                        const percentage = course.progress?.progress_percentage || 0;
                        return (
                          <div key={course.id} className="border border-[#E2E8F0] rounded-xl p-4 bg-white hover:shadow-md hover:border-[#2563EB]/25 transition-all flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-50 text-[#475569] border-[#E2E8F0]">
                                  {course.course_type}
                                </span>
                                <span className="font-bold text-[10px] text-[#2563EB]">{percentage}% Complete</span>
                              </div>
                              
                              <h4 className="font-bold text-[#0F172A] text-xs mb-1 truncate">{course.title}</h4>
                              <p className="text-[10px] text-[#475569] line-clamp-2 leading-relaxed mb-4">{course.description || "No course description."}</p>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-[#2563EB] h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                              </div>

                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#475569] font-mono">
                                  {course.progress?.completed_lessons || 0} / {course.progress?.total_lessons || 0} Lessons
                                </span>
                                <button
                                  onClick={async () => {
                                    await handleSelectCourse(course);
                                    setActiveTab("academics");
                                  }}
                                  className="text-[#2563EB] hover:underline font-bold flex items-center gap-0.5"
                                >
                                  Resume <ArrowRight size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Pending Assessments list */}
              <div className="space-y-6">
                
                {/* Pending Tasks */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                    <FileQuestion className="text-[#2563EB]" size={15} /> Pending Activities
                  </h3>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
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
                          <div key={act.id} className="border border-[#E2E8F0] rounded-lg p-3 bg-slate-50/30 flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border capitalize ${typeColor}`}>
                                {typeLabel}
                              </span>
                              <h4 className="font-bold text-[#0F172A] text-xs truncate mt-1.5">{act.title}</h4>
                              <p className="text-[9px] text-[#475569] mt-0.5">Status: {act.progress?.status_code || "assigned"}</p>
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
                              className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 text-[#2563EB] px-2.5 py-1.5 rounded-md text-[9px] font-bold shrink-0 transition-all"
                            >
                              Open
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-[#E2E8F0]">
                        <CheckCircle className="text-emerald-500 mx-auto mb-2" size={20} />
                        <span className="text-[10px] text-[#475569] font-medium block">All tasks completed!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Challenge Stats */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                    <TerminalIcon className="text-[#2563EB]" size={15} /> Challenges Dashboard
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3.5 text-center text-xs">
                    <div className="bg-slate-50 border border-[#E2E8F0] rounded-lg p-2.5">
                      <span className="text-[9px] text-[#475569] block font-semibold uppercase tracking-wider">Assigned</span>
                      <span className="font-bold text-[#0F172A]">{assignedChallengesCount}</span>
                    </div>
                    <div className="bg-[#16A34A]/5 border border-[#16A34A]/10 rounded-lg p-2.5">
                      <span className="text-[9px] text-[#16A34A] block font-semibold uppercase tracking-wider">Completed</span>
                      <span className="font-bold text-[#16A34A]">{completedChallengesCount}</span>
                    </div>
                    <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded-lg p-2.5">
                      <span className="text-[9px] text-[#F59E0B] block font-semibold uppercase tracking-wider">Pending</span>
                      <span className="font-bold text-[#F59E0B]">{pendingChallengesCount}</span>
                    </div>
                    <div className="bg-[#2563EB]/5 border border-[#2563EB]/10 rounded-lg p-2.5">
                      <span className="text-[9px] text-[#2563EB] block font-semibold uppercase tracking-wider">Avg Score</span>
                      <span className="font-bold text-[#2563EB]">{averageChallengeScore}%</span>
                    </div>
                  </div>
                </div>

                {/* Attendance Standings Card */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar className="text-[#2563EB]" size={15} /> Attendance Stats
                  </h3>
                  
                  {loadingAttendance ? (
                    <div className="text-center py-4 text-[#475569] font-bold animate-pulse">Calculating stats...</div>
                  ) : attendancePercentage !== null ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-[#475569] block font-semibold uppercase tracking-wider">Attendance Rate</span>
                          <span className="text-xl font-black text-[#0F172A]">{attendancePercentage}%</span>
                        </div>
                        
                        {/* Attendance Warning Badge (>=70% is Good Standing, <70% is Warning) */}
                        {attendancePercentage >= 70 ? (
                          <span className="bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wide">
                            Good Standing
                          </span>
                        ) : (
                          <span className="bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wide animate-pulse">
                            Attendance Warning
                          </span>
                        )}
                      </div>

                      {/* Display recent logs */}
                      <div className="space-y-1.5 border-t border-[#E2E8F0] pt-3 max-h-[160px] overflow-y-auto pr-1">
                        <span className="text-[9px] font-bold text-[#475569] uppercase tracking-wider block mb-1">Recent Sessions Logs</span>
                        {attendanceLogs.length === 0 ? (
                          <span className="text-[10px] text-slate-400 block text-center py-2">No logs recorded yet.</span>
                        ) : (
                          attendanceLogs.slice(0, 5).map((log, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg text-[10px] border border-[#E2E8F0]">
                              <span className="font-semibold text-slate-700">{log.date}</span>
                              <span className={`px-1.5 py-0.5 rounded-[4px] font-bold uppercase text-[8px] ${
                                log.status === "present"
                                  ? "bg-[#16A34A]/10 text-[#16A34A]"
                                  : log.status === "absent"
                                  ? "bg-[#DC2626]/10 text-[#DC2626]"
                                  : log.status === "late"
                                  ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                                  : "bg-[#0066cc]/10 text-[#0066cc]"
                              }`}>
                                {log.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-[10px]">No active cohort attendance logs.</div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: ACADEMICS / SYLLABUS VIEWER */}
        {activeTab === "academics" && (
          <div className="space-y-6">
            {!selectedProgram ? (
              <div className="text-center py-8 text-[#475569] font-medium bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                You are not currently enrolled in any active cohorts. Please contact your administrator.
              </div>
            ) : !selectedCourse ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3 mb-3">
                  <span className="font-bold text-[#0F172A]">Courses under {selectedProgram.title}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedProgram.courses?.length > 0 ? (
                    selectedProgram.courses.map((course: any) => (
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
              <div className="space-y-6">
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 text-xs border-b border-[#E2E8F0] pb-3">
                    <button
                      onClick={() => {
                        setSelectedCourse(null);
                        setActiveLesson(null);
                      }}
                      className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold"
                    >
                      <ChevronLeft size={14} /> Courses
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="font-semibold text-[#0F172A] truncate max-w-[200px]">{selectedCourse.title}</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 border border-[#E2E8F0] rounded-xl p-4">
                    <div>
                      <h4 className="font-bold text-[#0F172A]">{selectedCourse.title}</h4>
                      <p className="text-[#475569] text-[10px] mt-1">{selectedCourse.description || "No description set."}</p>
                    </div>
                    <div className="bg-white px-3 py-2 rounded-lg border border-[#E2E8F0] text-center shrink-0">
                      <p className="font-bold text-[#0F172A] text-xs font-mono">{selectedCourse.progress?.progress_percentage || 0}%</p>
                      <p className="text-[8px] text-[#475569] font-bold uppercase tracking-wider mt-0.5">COMPLETED</p>
                    </div>
                  </div>

                  {activeLesson && (
                    <div className="border border-[#2563EB]/20 bg-[#2563EB]/5 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-[#2563EB] uppercase tracking-wider">ACTIVE LESSON PLAYER</p>
                          <h4 className="font-bold text-sm text-[#0F172A] mt-0.5">{activeLesson.title}</h4>
                        </div>
                         <div className="flex gap-2">
                          {(() => {
                            const isAssignment = activeLesson.lesson_type?.code?.toLowerCase() === "assignment" || activeLesson.lesson_type?.code?.toLowerCase() === "assessment";
                            const isCompleted = lessonProgressMap[activeLesson.id]?.status_code === "completed";
                            const hasSubmitted = !!lessonProjectSubmission;

                            if (isAssignment) {
                              if (isCompleted || hasSubmitted) {
                                return (
                                  <span className="bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                    <CheckCircle size={12} /> Assignment Submitted
                                  </span>
                                );
                              }
                              return (
                                <span className="bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                  <AlertTriangle size={12} /> Pending Submission
                                </span>
                              );
                            }

                            if (isCompleted) {
                              return (
                                <span className="bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle size={12} /> Completed
                                </span>
                              );
                            }

                            return (
                              <button
                                onClick={() => handleCompleteLesson(activeLesson)}
                                disabled={actionLoading}
                                className="bg-[#2563EB] text-white px-3.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all text-[10px] flex items-center gap-1 disabled:opacity-50"
                              >
                                Mark as Completed
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {(() => {
                        // Check if it's a PDF lesson or has a PDF file
                        const hasPdfUrl = activeLesson.video_url?.toLowerCase().endsWith(".pdf") || 
                                          activeLesson.lesson_type?.code?.toLowerCase() === "pdf";
                        
                        if (hasPdfUrl) {
                          // Try to resolve the PDF URL from video_url or from resources
                          const pdfUrl = activeLesson.video_url || 
                            activeLesson.resources?.find((r: any) => 
                              r.resource_type === "pdf" || 
                              r.external_url?.toLowerCase().endsWith(".pdf") ||
                              r.file_url?.toLowerCase().endsWith(".pdf") ||
                              r.resource_url?.toLowerCase().endsWith(".pdf")
                            )?.external_url ||
                            activeLesson.resources?.find((r: any) => 
                              r.resource_type === "pdf" || 
                              r.external_url?.toLowerCase().endsWith(".pdf") ||
                              r.file_url?.toLowerCase().endsWith(".pdf") ||
                              r.resource_url?.toLowerCase().endsWith(".pdf")
                            )?.file_url ||
                            activeLesson.resources?.find((r: any) => 
                              r.resource_type === "pdf" || 
                              r.external_url?.toLowerCase().endsWith(".pdf") ||
                              r.file_url?.toLowerCase().endsWith(".pdf") ||
                              r.resource_url?.toLowerCase().endsWith(".pdf")
                            )?.resource_url;

                          if (pdfUrl) {
                            return (
                              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm h-[600px] w-full flex flex-col mb-4">
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
                        }

                        if (!activeLesson.video_url) return null;

                        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                        const ytMatch = activeLesson.video_url.match(ytRegex);
                        const vimeoRegex = /vimeo\.com\/(?:video\/)?([0-9]+)/;
                        const vimeoMatch = activeLesson.video_url.match(vimeoRegex);
                        
                        if (ytMatch && ytMatch[1]) {
                          return (
                            <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-805 shadow-sm mb-4">
                              <iframe
                                src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={activeLesson.title}
                              />
                            </div>
                          );
                        } else if (vimeoMatch && vimeoMatch[1]) {
                          return (
                            <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-805 shadow-sm mb-4">
                              <iframe
                                src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                                className="w-full h-full border-0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                title={activeLesson.title}
                              />
                            </div>
                          );
                        } else if (activeLesson.video_url.match(/\.(mp4|webm|ogg)/i) || activeLesson.video_url.includes("storage.googleapis.com") || activeLesson.video_url.includes("amazonaws.com")) {
                          return (
                            <div className="bg-black aspect-video rounded-xl overflow-hidden border border-slate-805 shadow-sm mb-4">
                              <video
                                src={activeLesson.video_url}
                                className="w-full h-full"
                                controls
                                preload="metadata"
                              />
                            </div>
                          );
                        } else {
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
                        <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl text-xs leading-relaxed text-[#0F172A] whitespace-pre-wrap">
                          {activeLesson.content_json.body || activeLesson.content_json.text}
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
                                      className="text-[#2563EB] font-bold flex items-center gap-0.5 hover:underline"
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

                      {/* Embedded Assignment/Project Submission Form directly in the lesson view */}
                      {lessonProjectDetails && (() => {
                        const isSubmitted = !!lessonProjectSubmission;
                        const isReviewed = !!lessonProjectReview;
                        
                        return (
                          <div className="border border-[#2563EB]/15 bg-slate-50/50 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                              <h4 className="font-bold text-xs text-[#0f172a] flex items-center gap-1.5 uppercase tracking-wider">
                                <FolderCode className="text-[#2563EB]" size={14} /> Assignment Submission Drawer
                              </h4>
                              {isSubmitted && (
                                <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                                  lessonProjectReview?.review_status === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : lessonProjectReview?.review_status === "revision_requested"
                                    ? "bg-rose-50 text-rose-700 border-rose-100"
                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                }`}>
                                  {lessonProjectReview?.review_status ? `Status: ${lessonProjectReview.review_status.replace('_', ' ')}` : "Pending Grade"}
                                </span>
                              )}
                            </div>

                            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2.5">
                              <div>
                                <h5 className="font-bold text-[#0F172A] text-[11px]">Submission Specifications</h5>
                                <p className="text-[#475569] mt-0.5 whitespace-pre-line leading-relaxed">{lessonProjectDetails.project_overview}</p>
                              </div>
                              {lessonProjectDetails.requirements && (
                                <div>
                                  <h5 className="font-bold text-[#0F172A] text-[11px]">Rubric Requirements</h5>
                                  <p className="text-[#475569] mt-0.5 whitespace-pre-line leading-relaxed">{lessonProjectDetails.requirements}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-[#E2E8F0] text-[10px] text-[#475569]">
                                <div>Estimated Work: <span className="font-bold text-[#0F172A]">{lessonProjectDetails.estimated_hours || 0} hrs</span></div>
                                <div>Max Score: <span className="font-bold text-[#0F172A]">{lessonProjectDetails.max_score} pts</span></div>
                              </div>
                            </div>

                            {/* Form Input fields */}
                            <div className="space-y-3.5">
                              <div className="flex flex-col gap-1.5 text-xs">
                                <label className="font-bold text-[#0f172a]">GitHub Project Repository Link *</label>
                                <input
                                  type="text"
                                  value={lessonGithubUrl}
                                  onChange={(e) => setLessonGithubUrl(e.target.value)}
                                  placeholder="e.g. https://github.com/yourprofile/ml-regression-estimator"
                                  className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 w-full text-xs outline-none focus:border-[#2563EB] transition-all text-[#0F172A]"
                                  disabled={isReviewed}
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 text-xs">
                                <label className="font-bold text-[#0f172a]">Submission Documentation / Notes</label>
                                <textarea
                                  value={lessonSubmissionNotes}
                                  onChange={(e) => setLessonSubmissionNotes(e.target.value)}
                                  placeholder="Paste testing commands, libraries installed, and summary of the evaluations..."
                                  rows={3}
                                  className="bg-white border border-[#E2E8F0] rounded-lg p-3 w-full text-xs outline-none focus:border-[#2563EB] transition-all text-[#0F172A]"
                                  disabled={isReviewed}
                                />
                              </div>

                              {!isReviewed ? (
                                <button
                                  onClick={handleLessonSubmitProjectUrl}
                                  disabled={actionLoading || !lessonGithubUrl.trim()}
                                  className="bg-[#2563EB] text-white px-4 py-2.5 rounded-lg font-bold hover:bg-[#2563EB]/95 transition-all text-xs disabled:opacity-50"
                                >
                                  {actionLoading ? "Submitting..." : isSubmitted ? "Resubmit Repository Link" : "Submit Assignment Link"}
                                </button>
                              ) : (
                                <div className="bg-[#16A34A]/5 border border-[#16A34A]/25 rounded-xl p-4 space-y-2">
                                  <h5 className="font-bold text-xs text-[#16A34A] uppercase tracking-wide">Teacher Grade & Review Report</h5>
                                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                                    <div>
                                      <span className="text-[9px] text-[#475569] block font-normal">Score Awarded</span>
                                      <span className="text-sm font-mono text-[#0F172A]">{lessonProjectReview.score !== null ? `${lessonProjectReview.score} / ${lessonProjectDetails.max_score} pts` : "Pending Points"}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-[#475569] block font-normal">Review Date</span>
                                      <span className="text-[11px] text-[#0F172A]">{new Date(lessonProjectReview.created_at || lessonProjectReview.updated_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  {lessonProjectReview.feedback && (
                                    <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] text-xs text-[#475569] leading-relaxed">
                                      <span className="font-bold text-[#0F172A] block text-[10px] uppercase mb-1">Teacher Feedback</span>
                                      {lessonProjectReview.feedback}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wide pt-2">Course Syllabus & Curriculum</h3>
                  
                  {loading ? (
                    <div className="flex flex-col gap-4">
                      <div className="h-12 bg-slate-100 animate-pulse rounded-xl"></div>
                      <div className="h-12 bg-slate-100 animate-pulse rounded-xl"></div>
                    </div>
                  ) : modules.length > 0 ? (
                    <div className="space-y-4">
                      {modules.map((mod) => (
                        <div key={mod.id} className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs bg-white">
                          <div className="bg-slate-50/70 px-4 py-3.5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <p className="font-bold text-xs text-[#0F172A] tracking-tight">
                                Module {mod.position}: {mod.title}
                              </p>
                              {mod.description && <p className="text-[10px] text-[#475569] mt-0.5 font-medium">{mod.description}</p>}
                            </div>
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

                                return (
                                  <div 
                                    key={les.id} 
                                    className={`border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all duration-150 ${
                                      isCompleted 
                                        ? "border-emerald-100 bg-emerald-50/10" 
                                        : isInProgress 
                                        ? "border-[#2563EB]/20 bg-[#2563EB]/5/10" 
                                        : "border-[#E2E8F0] bg-white hover:border-[#2563EB]/15 hover:bg-slate-50/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="shrink-0">
                                        {isCompleted ? (
                                          <CheckCircle2 size={16} className="text-[#16A34A] fill-[#16A34A]/5" />
                                        ) : isInProgress ? (
                                          <Circle size={16} className="text-[#F59E0B] fill-[#F59E0B]/10 animate-pulse" />
                                        ) : (
                                          <Circle size={16} className="text-[#94A3B8]" />
                                        )}
                                      </div>
                                      
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`font-semibold text-xs tracking-tight ${isCompleted ? 'text-[#475569] line-through' : 'text-[#0F172A]'}`}>
                                            {les.title}
                                          </span>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border ${typeBadge}`}>
                                            {les.lesson_type?.code || "lesson"}
                                          </span>
                                        </div>
                                        <div className="text-[9px] text-[#475569] font-mono mt-0.5 flex items-center gap-1">
                                          <Clock size={9} /> {les.duration || 0} mins
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      <button
                                        onClick={() => handleStartLesson(les)}
                                        className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 px-3 py-1.5 rounded-lg font-bold text-[#0F172A] text-[10px] shadow-2xs transition-all"
                                      >
                                        Open Lesson
                                      </button>
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
            )}
          </div>
        )}

        {/* TAB 3: QUIZZES */}
        {activeTab === "quizzes" && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
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
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4.5 bg-white flex justify-between items-center hover:shadow-md hover:border-[#2563EB]/15 transition-all">
                        <div>
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
                          className="bg-[#2563EB] text-white px-3.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center gap-1 text-[10px] shrink-0"
                        >
                          Enter Quiz <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No quizzes assigned to your cohort.</p>
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
                            <div className="grid grid-cols-2 gap-4">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
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
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4.5 bg-white flex justify-between items-center hover:shadow-md hover:border-[#2563EB]/15 transition-all">
                        <div>
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
                          className="bg-[#2563EB] text-white px-3.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center gap-1 text-[10px] shrink-0"
                        >
                          Enter Project <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No projects assigned to your cohort.</p>
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

                      <div className="grid grid-cols-3 gap-4 text-xs pt-2 border-t border-[#E2E8F0]">
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
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
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
                      <div key={act.id} className="border border-[#E2E8F0] rounded-xl p-4 bg-slate-50/20 flex justify-between items-center hover:shadow-sm transition-all">
                        <div>
                          <h4 className="font-bold text-xs text-[#0F172A]">{act.title}</h4>
                          <p className="text-[#475569] text-[10px] mt-1 line-clamp-1">{act.description}</p>
                          <div className="flex gap-3 text-[9px] text-[#475569] font-semibold mt-2.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded uppercase font-bold border text-slate-700">Status: {act.progress?.status_code}</span>
                            {act.progress?.score !== null && (
                              <span className="bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded font-bold border border-[#16A34A]/20">Score: {act.progress?.score} / {act.progress?.max_score || 100}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnterChallenge(act)}
                          className="bg-[#2563EB] text-white px-3.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/90 transition-all flex items-center gap-1 text-[10px]"
                        >
                          Enter Challenge <ChevronRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-500 font-medium">No challenges assigned to your cohort.</p>
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
                              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono bg-slate-50 p-2 rounded border border-[#E2E8F0]">
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
                            <div key={sub.id} className="py-2.5 flex justify-between items-center text-xs">
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
  );
}
