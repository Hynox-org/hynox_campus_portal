"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import AttendanceModule from "@/components/attendance-register/attendance-module";
import ChallengeEditor from "@/app/teacher/challenge-editor";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useQueryClient } from "@tanstack/react-query";
import { useDeliveryData, useLearningData } from "@/hooks/use-delivery";
import { useAcademicPrefetchData } from "@/hooks/use-academics";
import { useToast } from "@/components/toast";
import { 
  Users, 
  BookOpen, 
  CheckSquare, 
  Terminal, 
  Calendar, 
  Search, 
  ExternalLink, 
  Star, 
  Clock, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Code2,
  FileCode,
  Layers,
  Activity,
  Plus,
  Video,
  FileText,
  Trash2,
  HelpCircle,
  Save,
  ChevronRight,
  ShieldAlert,
  Menu,
  Award,
  X,
  RefreshCw,
  Edit,
  Eye,
  File,
  FolderCode,
  Settings,
  GraduationCap,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Building2,
  MapPin
} from "lucide-react";
import { 
  reviewProjectSubmissionAction,
  assignActivityToCohortAction,
  createActivityAndSubclassAction,
  createQuizQuestionAndOptionsAction,
  createChallengeExampleAction,
  createChallengeTestCaseAction,
  getQuizDetailsAction,
  getQuizSessionDetailsAction,
  getProgrammingChallengeDetailsAction,
  listProjectSubmissionsAction,
  listChallengeSubmissionsAction,
  listAllActivitiesAction,
  listQuizAttemptsAction,
  updateActivityAndSubclassAction,
  deleteChallengeExampleAction,
  deleteChallengeTestCaseAction,
  getActivityDetailsNoStudentAction,
  listCohortProjectSubmissionsAction,
  listCohortChallengeSubmissionsAction,
  listCohortActivitiesAction,
  listCohortQuizAttemptsAction,
  approveQuizRetakeAction
} from "@/app/actions/learning-actions";
import {
  listTenantCoursesAction,
  listLessonsForCourseAction,
  listModulesAction,
  listLessonsAction,
  createLessonAction,
  updateLessonAction,
  createLessonResourceAction,
  deleteLessonResourceAction,
  listLessonResourcesAction,
  listProgramsAction,
  createModuleAction,
  deleteModuleAction,
  deleteLessonAction,
  getAcademicLookupsAction
} from "@/app/actions/academic-actions";
import {
  listCohortsAction,
  listEnrollmentsAction,
  getStudentDeliveryDataAction,
  listStudentLessonProgressAction,
  listCohortEnrollmentsAction,
  listCohortCourseAssignmentsAction
} from "@/app/actions/delivery-actions";
import LearningManager from "@/app/admin/learning-manager";
import AppShell from "@/components/app-shell";
import { CustomSelect } from "@/components/custom-select";

function formatDatetimeLocal(isoString?: string) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const date = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${date}T${h}:${min}`;
  } catch {
    return "";
  }
}

import { DashboardLoader } from "@/components/dashboard-loader";
import { SecondaryLoader } from "@/components/secondary-loader";

// A module-level fallback keeps effect dependencies stable before the first
// query result arrives. Creating `[]` during render turns it into a new
// dependency every render and can create a state-update loop.
const EMPTY_LIST: never[] = [];

interface TeacherConsoleProps {
  teacherId: string;
  tenantId: string;
  initialCohortId: string;
  initialCohorts: any[];
  assignedInstitutions: any[];
  teacherEmail: string;
  teacherName: string;
  primaryRole: string;
}

export default function TeacherConsole({
  teacherId,
  tenantId,
  initialCohortId,
  initialCohorts,
  assignedInstitutions,
  teacherEmail,
  teacherName,
  primaryRole,
}: TeacherConsoleProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // React Query Prefetching - one shot for all academic data
  const { data: deliveryData, isLoading: loadingDelivery, error: deliveryError } = useDeliveryData(tenantId);
  const { data: learningData, isLoading: loadingLearning, error: learningError } = useLearningData(tenantId);
  const { data: academicPrefetch, isLoading: loadingPrograms, error: academicError } = useAcademicPrefetchData(tenantId);
  const acadPrograms = academicPrefetch?.programs;
  const acadCourses = academicPrefetch?.courses ?? EMPTY_LIST;
  const acadLessons = academicPrefetch?.lessons ?? EMPTY_LIST;

  const [activeTab, setActiveTab] = useState<"overview" | "roster" | "projects" | "challenges" | "activities-manager" | "view_activities" | "syllabus" | "quiz-auditor" | "attendance">("overview");
  const [activeParentTab, setActiveParentTab] = useState<"overview" | "students" | "assessments" | "curriculum" | "attendance">("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCohortDropdownOpen, setIsCohortDropdownOpen] = useState(false);
  const [openingStudentId, setOpeningStudentId] = useState<string | null>(null);

  // Sync state with URL params after hydration on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const validTabs = ["overview", "roster", "projects", "challenges", "activities-manager", "view_activities", "syllabus", "quiz-auditor", "attendance"];
      if (tab && validTabs.includes(tab)) {
        setActiveTab(tab as any);
      }
      const parent = params.get("parentTab");
      const validParents = ["overview", "students", "assessments", "curriculum", "attendance"];
      if (parent && validParents.includes(parent)) {
        setActiveParentTab(parent as any);
      }
    }
  }, []);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);
  
  // Unified Auditor states
  const [selectedQuizAttempt, setSelectedQuizAttempt] = useState<any>(null);
  const [auditorFilter, setAuditorFilter] = useState<"all" | "quiz" | "project" | "programming">("all");
  const [quizAttemptSession, setQuizAttemptSession] = useState<any>(null);
  const [loadingQuizSession, setLoadingQuizSession] = useState(false);

  // Search & Date filters for Auditors
  const [quizSearch, setQuizSearch] = useState("");
  const [quizDateFilter, setQuizDateFilter] = useState("all");
  const [isQuizDateDropdownOpen, setIsQuizDateDropdownOpen] = useState(false);

  const [projectSearch, setProjectSearch] = useState("");
  const [projectDateFilter, setProjectDateFilter] = useState("all");
  const [isProjectDateDropdownOpen, setIsProjectDateDropdownOpen] = useState(false);

  const [challengeSearch, setChallengeSearch] = useState("");
  const [challengeDateFilter, setChallengeDateFilter] = useState("all");
  const [isChallengeDateDropdownOpen, setIsChallengeDateDropdownOpen] = useState(false);

  const dateFilterLabels: Record<string, string> = {
    all: "All Time",
    today: "Today",
    yesterday: "Yesterday",
    "day-before": "Day Before Yesterday",
    "last-7-days": "Last 7 Days"
  };

  useEffect(() => {
    if (selectedQuizAttempt) {
      setLoadingQuizSession(true);
      getQuizSessionDetailsAction(selectedQuizAttempt.id).then(res => {
        setQuizAttemptSession(res);
        setLoadingQuizSession(false);
      });
    } else {
      setQuizAttemptSession(null);
    }
  }, [selectedQuizAttempt]);

  // Syllabus Editor State
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModulePosition, setNewModulePosition] = useState(1);
  const [newLessonPosition, setNewLessonPosition] = useState(1);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);

  // Active selected cohort as the primary driver
  const [selectedCohortId, setSelectedCohortId] = useState<string>(initialCohortId || initialCohorts?.[0]?.id || "");
  const [selectedInstId, setSelectedInstId] = useState<string>(assignedInstitutions[0]?.id || "");
  const [programsList, setProgramsList] = useState<any[]>(acadPrograms || []);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(acadPrograms?.[0]?.id || "");
  const [tenantCourses, setTenantCourses] = useState<any[]>(acadCourses || []);

  // Main collections derived from React Query instantly
  const cohorts = deliveryData?.cohorts || initialCohorts;
  const enrollments = deliveryData?.enrollments || [];
  const activities = learningData?.activities || [];
  const projectSubmissions = learningData?.projectSubmissions || [];
  const challengeSubmissions = learningData?.challengeSubmissions || [];
  const quizAttempts = learningData?.quizAttempts || [];
  const assignments = deliveryData?.assignments || [];

  const cohortOptions = cohorts.map(c => ({
    id: c.id,
    name: `${c.name} (${c.code}) - ${c.institution?.name || "Global"}`
  }));

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);

  // Guard: restore from URL only once – prevents background React Query refetches
  // from overriding the user's in-session selections.
  const hasRestoredFromUrl = useRef(false);

  // Sync state values from indices in URL query params on initial load/mount
  useEffect(() => {
    if (hasRestoredFromUrl.current) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      let restored = false;

      const cohortIndexStr = params.get("c");
      if (cohortIndexStr !== null && cohorts.length > 0) {
        const idx = parseInt(cohortIndexStr, 10);
        if (!isNaN(idx) && idx >= 0 && idx < cohorts.length) {
          const cId = cohorts[idx]?.id;
          if (cId && cId !== selectedCohortId) { setSelectedCohortId(cId); restored = true; }
        }
      }

      const instIndexStr = params.get("i");
      if (instIndexStr !== null && assignedInstitutions.length > 0) {
        const idx = parseInt(instIndexStr, 10);
        if (!isNaN(idx) && idx >= 0 && idx < assignedInstitutions.length) {
          const iId = assignedInstitutions[idx]?.id;
          if (iId && iId !== selectedInstId) { setSelectedInstId(iId); restored = true; }
        }
      }

      const programIndexStr = params.get("p");
      if (programIndexStr !== null && programsList.length > 0) {
        const idx = parseInt(programIndexStr, 10);
        if (!isNaN(idx) && idx >= 0 && idx < programsList.length) {
          const pId = programsList[idx]?.id;
          if (pId && pId !== selectedProgramId) { setSelectedProgramId(pId); restored = true; }
        }
      }

      // Mark as restored only once all required lists are non-empty
      if (cohorts.length > 0 && assignedInstitutions.length > 0 && programsList.length > 0) {
        hasRestoredFromUrl.current = true;
      }
    }
  }, [cohorts, assignedInstitutions, programsList]);

  // Sync state modifications back to clean index-based query parameters
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

      // Cleanup old UUID query parameter keys to prevent cluttering
      if (params.has("cohortId")) { params.delete("cohortId"); changed = true; }
      if (params.has("instId")) { params.delete("instId"); changed = true; }
      if (params.has("programId")) { params.delete("programId"); changed = true; }

      const cIdx = cohorts.findIndex((c: any) => c.id === selectedCohortId);
      if (cIdx !== -1) {
        if (params.get("c") !== String(cIdx)) {
          params.set("c", String(cIdx));
          changed = true;
        }
      } else if (params.has("c")) {
        params.delete("c");
        changed = true;
      }

      const iIdx = assignedInstitutions.findIndex((i: any) => i.id === selectedInstId);
      if (iIdx !== -1) {
        if (params.get("i") !== String(iIdx)) {
          params.set("i", String(iIdx));
          changed = true;
        }
      } else if (params.has("i")) {
        params.delete("i");
        changed = true;
      }

      const pIdx = programsList.findIndex((p: any) => p.id === selectedProgramId);
      if (pIdx !== -1) {
        if (params.get("p") !== String(pIdx)) {
          params.set("p", String(pIdx));
          changed = true;
        }
      } else if (params.has("p")) {
        params.delete("p");
        changed = true;
      }

      if (changed) {
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? "?" + newSearch : ""}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [activeTab, activeParentTab, selectedCohortId, selectedInstId, selectedProgramId, cohorts, assignedInstitutions, programsList]);

  const currentSelectedInst = assignedInstitutions.find(i => i.id === selectedInstId);
  const isSelectedInstDisabled = currentSelectedInst && (currentSelectedInst.status === "inactive" || currentSelectedInst.status === "suspended");

  const currentSelectedProg = programsList.find(p => p.id === selectedProgramId);
  const isSelectedProgDisabled = currentSelectedProg && (currentSelectedProg.status?.code === "suspended" || currentSelectedProg.status?.code === "disabled");


  const studentsList = React.useMemo(() => {
    const list: any[] = [];
    enrollments.forEach((e: any) => {
      if (e.student && !list.some((s: any) => s.id === e.student.id)) {
        list.push(e.student);
      }
    });
    return list;
  }, [enrollments]);

  const [selectedProjectSub, setSelectedProjectSub] = useState<any>(null);
  const [selectedChallengeSub, setSelectedChallengeSub] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [activeStudentProgress, setActiveStudentProgress] = useState<any[]>([]);
  const [activeStudentLessonsProgress, setActiveStudentLessonsProgress] = useState<any[]>([]);
  const [drawerLessonsCache, setDrawerLessonsCache] = useState<Record<string, any[]>>({});
  const [studentDetailTab, setStudentDetailTab] = useState<"overview" | "syllabus" | "quizzes" | "projects" | "challenges">("overview");
  const [rosterSearchQuery, setRosterSearchQuery] = useState("");
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Transition & status
  const [isPending, startTransition] = useTransition();

  // 1. PROJECT GRADING STATE
  const [score, setScore] = useState<number>(100);
  const [feedback, setFeedback] = useState<string>("");
  const [reviewStatus, setReviewStatus] = useState<string>("approved");

  // 2. ACTIVITY BUILDER & ASSIGNMENT STATE
  const [coursesList, setCoursesList] = useState<any[]>(acadCourses || []);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(acadCourses?.[0]?.id || "");

  // Sync data when academic prefetch lands
  useEffect(() => {
    if (academicPrefetch?.programs && academicPrefetch.programs.length > 0) {
      setProgramsList(academicPrefetch.programs);
      if (!selectedProgramId) setSelectedProgramId(academicPrefetch.programs[0].id);
    }
    if (academicPrefetch?.courses && academicPrefetch.courses.length > 0) {
      setTenantCourses(academicPrefetch.courses);
      setCoursesList(academicPrefetch.courses);
      // Resync if unset, or if the current selection belongs to a course list
      // from a different institution context and no longer exists in this one
      // (this was the root cause of the course dropdown appearing "stuck").
      const stillValid = academicPrefetch.courses.some((c: any) => c.id === selectedCourseId);
      if (!selectedCourseId || !stillValid) {
        setSelectedCourseId(academicPrefetch.courses[0].id);
      }
    }
    // Keep deep course-module queries separate: their result includes lesson
    // resources, which the lightweight prefetch intentionally does not load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicPrefetch]);
  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const [activityType, setActivityType] = useState<"quiz" | "project" | "programming">("quiz");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [passingScore, setPassingScore] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);

  // Quiz details
  const [quizTimeLimit, setQuizTimeLimit] = useState(30);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(1);
  const [quizShuffleQ, setQuizShuffleQ] = useState(false);
  const [quizShuffleO, setQuizShuffleO] = useState(false);
  const [quizStrictMode, setQuizStrictMode] = useState(false);

  // Project details
  const [projOverview, setProjOverview] = useState("");
  const [projRequirements, setProjRequirements] = useState("");
  const [projDeliverables, setProjDeliverables] = useState("");
  const [projDifficulty, setProjDifficulty] = useState("intermediate");
  const [projHours, setProjHours] = useState(10);

  // Challenge details
  const [chalDifficulty, setChalDifficulty] = useState("easy");
  const [chalStatement, setChalStatement] = useState("");
  const [chalInput, setChalInput] = useState("");
  const [chalOutput, setChalOutput] = useState("");
  const [chalConstraints, setChalConstraints] = useState("");
  const [chalStrictMode, setChalStrictMode] = useState(false);

  // Subclass creation ids
  const [createdActivityId, setCreatedActivityId] = useState("");
  const [createdQuizId, setCreatedQuizId] = useState("");
  const [createdChallengeId, setCreatedChallengeId] = useState("");

  // Drawer states
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [activityDetails, setActivityDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"config" | "performance">("config");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    title: "",
    description: "",
    instructions: "",
    max_score: 100,
    passing_score: 0,
    is_mandatory: true,
    quiz_time_limit: 30,
    quiz_max_attempts: 1,
    quiz_shuffle_questions: false,
    quiz_shuffle_options: false,
    quiz_show_results_immediately: true,
    quiz_strict_mode: false,
    project_overview: "",
    project_requirements: "",
    project_deliverables: "",
    project_submission_instructions: "",
    project_difficulty: "intermediate",
    project_estimated_hours: 10,
    chal_difficulty: "easy",
    chal_problem_statement: "",
    chal_input_format: "",
    chal_output_format: "",
    chal_constraints: "",
    chal_starter_code: "",
    chal_time_limit: 1000,
    chal_memory_limit: 256,
    chal_strict_mode: false,
    assignments: []
  });

  // Children helpers
  const [quizQuestionsList, setQuizQuestionsList] = useState<any[]>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("single_choice");
  const [newQuestionPoints, setNewQuestionPoints] = useState(10);
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(["", "", "", ""]);
  const [newQuestionCorrectIndices, setNewQuestionCorrectIndices] = useState<number[]>([0]);

  const [examplesList, setExamplesList] = useState<any[]>([]);
  const [testCasesList, setTestCasesList] = useState<any[]>([]);
  const [newExInput, setNewExInput] = useState("");
  const [newExOutput, setNewExOutput] = useState("");
  const [newExExpl, setNewExExpl] = useState("");
  const [newTcInput, setNewTcInput] = useState("");
  const [newTcOutput, setNewTcOutput] = useState("");
  const [newTcHidden, setNewTcHidden] = useState(true);

  // Scheduling State
  const [assignmentCohortId, setAssignmentCohortId] = useState<string>("");
  const [availableFrom, setAvailableFrom] = useState<string>("");
  const [availableUntil, setAvailableUntil] = useState<string>("");

  // 3. SYLLABUS & STUDY MATERIALS STATE
  const [syllabusCourseId, setSyllabusCourseId] = useState<string>("");
  const [syllabusModuleId, setSyllabusModuleId] = useState<string>("");
  const [syllabusLessonId, setSyllabusLessonId] = useState<string>("");
  const [syllabusModules, setSyllabusModules] = useState<any[]>([]);
  const [syllabusLessons, setSyllabusLessons] = useState<any[]>([]);
  const [syllabusResources, setSyllabusResources] = useState<any[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);

  // Add Lesson Form
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState(30);
  const [newLessonContentText, setNewLessonContentText] = useState("");
  const [newLessonTypeId, setNewLessonTypeId] = useState("");
  const [newLessonPositionOrder, setNewLessonPositionOrder] = useState(1);
  const [newLessonIsPreview, setNewLessonIsPreview] = useState(false);
  const [lessonStatuses, setLessonStatuses] = useState<any[]>([]);

  // Prefetch seeding is now handled by the useAcademicPrefetchData sync effect above
  const [lessonTypes, setLessonTypes] = useState<any[]>([]);
  const [defaultLessonTypeId, setDefaultLessonTypeId] = useState("");
  const [syllabusViewMode, setSyllabusViewMode] = useState<"preview" | "edit">("preview");

  // Resource Form
  const [resType, setResType] = useState("pdf");
  const [resTitle, setResTitle] = useState("");
  const [resExternalUrl, setResExternalUrl] = useState("");

  useEffect(() => {
    async function loadLookups() {
      const res = await getAcademicLookupsAction();
      if (res.success && res.lookups) {
        setLessonTypes(res.lookups.lessonTypes || []);
        const textType = res.lookups.lessonTypes?.find((t: any) => t.code === "text") || res.lookups.lessonTypes?.[0];
        if (textType) setDefaultLessonTypeId(textType.id);
      }
    }
    loadLookups();
  }, []);

  // Removed the huge cohort data loading useEffect block.
  // The UI will just use the pre-fetched global collections and filter them locally.
  const loadingCohortData = false;

  const filteredCohorts = cohorts;
  const filteredCohortIds = cohorts.map(c => c.id);

  // Load lessons whenever course is selected for activity builder. A course with
  // no modules/lessons yet used to leave this dropdown silently empty with no
  // way to proceed — auto-provision a default module + lesson in that case,
  // mirroring the same fallback already used in admin/learning-manager.tsx.
  useEffect(() => {
    setSelectedLessonId("");
    if (!selectedCourseId) {
      setLessonsList([]);
      return;
    }

    let cancelled = false;
    setLessonsLoading(true);

    (async () => {
      try {
        const res = await listLessonsForCourseAction(selectedCourseId);
        let courseLessons = res.lessons || [];

        if (courseLessons.length === 0) {
          const modRes = await listModulesAction(selectedCourseId);
          let moduleId = modRes.modules?.[0]?.id || "";

          if (!moduleId) {
            const newMod = await createModuleAction({
              course_id: selectedCourseId,
              title: "Default Module",
              description: "Auto-generated module for activity placement",
              position: 1,
              tenant_id: selectedInstId,
              institution_id: selectedInstId
            });
            moduleId = newMod.module?.id || "";
          }

          if (moduleId) {
            const newLes = await createLessonAction({
              module_id: moduleId,
              title: "Default Lesson",
              position: 1,
              tenant_id: selectedInstId,
              institution_id: selectedInstId
            });
            if (newLes.lesson) {
              courseLessons = [newLes.lesson];
            }
          }
        }

        if (!cancelled) {
          setLessonsList(courseLessons);
          if (courseLessons.length > 0) setSelectedLessonId(courseLessons[0].id);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLessonsList([]);
          showError(err.message || "Failed to load lessons for the selected course.");
        }
      } finally {
        if (!cancelled) setLessonsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedCourseId, selectedInstId]);

  // Load modules & lessons for syllabus manager - use prefetch cache first
  useEffect(() => {
    if (syllabusCourseId) {
      // Try cache first (populated by prefetch)
      const cachedModules = queryClient.getQueryData<any[]>(["course-modules", syllabusCourseId]);
      if (cachedModules && cachedModules.length > 0) {
        setSyllabusModules(cachedModules);
        // Get lessons from prefetch data
        const courseModuleIds = cachedModules.map((m: any) => m.id);
        const cachedLessons = acadLessons.filter((l: any) => courseModuleIds.includes(l.module_id));
        if (cachedLessons.length > 0) {
          setSyllabusLessons(cachedLessons);
          setSyllabusModuleId("");
          setSyllabusLessonId("");
          setSyllabusResources([]);
          return;
        }
      }
      // Fallback: fetch from API
      setSyllabusLoading(true);
      Promise.all([
        listModulesAction(syllabusCourseId).then(res => setSyllabusModules(res.modules || [])),
        listLessonsForCourseAction(syllabusCourseId).then(res => setSyllabusLessons(res.lessons || []))
      ]).finally(() => setSyllabusLoading(false));
      setSyllabusModuleId("");
      setSyllabusLessonId("");
      setSyllabusResources([]);
    } else {
      // Preserve the existing empty arrays so a render without prefetch data
      // cannot keep retriggering this effect.
      setSyllabusModules(previous => previous.length === 0 ? previous : []);
      setSyllabusLessons(previous => previous.length === 0 ? previous : []);
    }
  }, [syllabusCourseId, acadLessons, queryClient]);

  // Load resources when lesson is selected
  useEffect(() => {
    if (syllabusLessonId) {
      listLessonResourcesAction(syllabusLessonId).then(res => setSyllabusResources(res.resources || []));
      
      // Load current lesson video details to form
      const lesObj = syllabusLessons.find(l => l.id === syllabusLessonId);
      if (lesObj) {
        setNewLessonTitle(lesObj.title || "");
        setNewLessonVideoUrl(lesObj.video_url || "");
        setNewLessonDuration(lesObj.duration || 30);
        setNewLessonContentText(lesObj.content_json?.text || lesObj.content_json?.body || "");
        setNewLessonTypeId(lesObj.lesson_type_id || "");
        setNewLessonPositionOrder(lesObj.position || 1);
        setNewLessonIsPreview(lesObj.is_preview || false);
      }
    } else {
      setSyllabusResources([]);
      setNewLessonTitle("");
      setNewLessonVideoUrl("");
      setNewLessonContentText("");
      setNewLessonTypeId("");
      setNewLessonPositionOrder(1);
      setNewLessonIsPreview(false);
    }
  }, [syllabusLessonId, syllabusLessons]);

  // Fetch real progress data for selected student
  // Clear cached progress when the drawer closes
  useEffect(() => {
    if (!selectedStudent) {
      setActiveStudentProgress([]);
      setActiveStudentLessonsProgress([]);
    }
  }, [selectedStudent]);

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

  // Sync grading form inputs when a project submission is selected
  useEffect(() => {
    if (selectedProjectSub) {
      setScore(selectedProjectSub.review?.score ?? selectedProjectSub.max_score ?? 100);
      setFeedback(selectedProjectSub.review?.feedback_comments ?? "");
      setReviewStatus(selectedProjectSub.review?.review_status ?? "approved");
    }
  }, [selectedProjectSub]);

  // Filter enrollments and submissions to program-scoped cohorts
  const filteredEnrollments = enrollments.filter(e => filteredCohortIds.includes(e.cohort_id));
  const activeStudentsCount = filteredEnrollments.filter(e => e.status_code === "active").length;
  
  const matchesDateFilter = (dateVal: string | Date, filter: string) => {
    if (filter === "all") return true;
    if (!dateVal) return false;
    const date = new Date(dateVal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - compareDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (filter === "today") return diffDays === 0;
    if (filter === "yesterday") return diffDays === 1;
    if (filter === "day-before") return diffDays === 2;
    if (filter === "last-7-days") return diffDays >= 0 && diffDays <= 7;
    return true;
  };

  const baseProjectSubmissions = projectSubmissions.filter(sub => 
    filteredEnrollments.some(e => e.user_id === sub.student_id)
  );

  const filteredProjectSubmissions = React.useMemo(() => {
    return baseProjectSubmissions.filter(sub => {
      const studentName = (sub.student?.full_name || sub.student?.email || "").toLowerCase();
      if (projectSearch && !studentName.includes(projectSearch.toLowerCase())) return false;
      if (!matchesDateFilter(sub.submitted_at, projectDateFilter)) return false;
      return true;
    });
  }, [baseProjectSubmissions, projectSearch, projectDateFilter]);

  const pendingProjectCount = baseProjectSubmissions.filter(p => !p.review || p.review.review_status === "pending").length;
  
  const baseChallengeSubmissions = challengeSubmissions.filter(sub => 
    filteredEnrollments.some(e => e.user_id === sub.student_id)
  );

  const filteredChallengeSubmissions = React.useMemo(() => {
    return baseChallengeSubmissions.filter(sub => {
      const studentName = (sub.student?.full_name || sub.student?.email || "").toLowerCase();
      if (challengeSearch && !studentName.includes(challengeSearch.toLowerCase())) return false;
      if (!matchesDateFilter(sub.submitted_at, challengeDateFilter)) return false;
      return true;
    });
  }, [baseChallengeSubmissions, challengeSearch, challengeDateFilter]);

  const filteredQuizAttemptsList = React.useMemo(() => {
    return quizAttempts.filter(att => {
      const isStudentInCohort = filteredEnrollments.some(e => e.user_id === att.student_id);
      if (!isStudentInCohort) return false;
      const studentName = (att.student?.full_name || att.student?.email || "").toLowerCase();
      if (quizSearch && !studentName.includes(quizSearch.toLowerCase())) return false;
      const submissionDate = att.submitted_at || att.started_at;
      if (!matchesDateFilter(submissionDate, quizDateFilter)) return false;
      return true;
    });
  }, [quizAttempts, filteredEnrollments, quizSearch, quizDateFilter]);

  const currentCohortEnrollments = filteredEnrollments.filter(e => e.cohort_id === selectedCohortId);

  // Filter courses list to selected program  
  const filteredCourses = tenantCourses;

  const combinedSubmissions = React.useMemo(() => {
    const list: any[] = [];
    
    // Add Projects
    filteredProjectSubmissions.forEach(sub => {
      list.push({
        id: sub.id,
        type: "project",
        title: sub.project_title,
        studentName: sub.student?.full_name || sub.student?.email || "Unknown Student",
        submittedAt: new Date(sub.submitted_at),
        score: sub.review?.score,
        maxScore: sub.max_score,
        status: sub.review ? sub.review.review_status : "pending",
        original: sub
      });
    });

    // Add Challenges
    filteredChallengeSubmissions.forEach(sub => {
      list.push({
        id: sub.id,
        type: "programming",
        title: sub.challenge_title,
        studentName: sub.student?.full_name || sub.student?.email || "Unknown Student",
        submittedAt: new Date(sub.submitted_at),
        score: sub.result?.score,
        maxScore: sub.max_score,
        status: sub.submission_status_code,
        original: sub
      });
    });

    // Add Quiz attempts
    quizAttempts.forEach(att => {
      const isStudentInCohort = filteredEnrollments.some(e => e.user_id === att.student_id);
      if (!isStudentInCohort) return;
      
      list.push({
        id: att.id,
        type: "quiz",
        title: att.quiz_title,
        studentName: att.student?.full_name || att.student?.email || "Unknown Student",
        submittedAt: att.submitted_at ? new Date(att.submitted_at) : new Date(att.started_at),
        score: att.score,
        maxScore: att.max_score,
        status: att.submitted_at ? "submitted" : "in_progress",
        original: att
      });
    });

    // Sort by submission date (newest first)
    list.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

    // Filter by type
    if (auditorFilter !== "all") {
      return list.filter(item => item.type === auditorFilter);
    }
    return list;
  }, [filteredProjectSubmissions, filteredChallengeSubmissions, quizAttempts, filteredEnrollments, auditorFilter]);

  // Form submit: project grading
  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectSub) return;

    startTransition(async () => {
      const result = await reviewProjectSubmissionAction({
        submissionId: selectedProjectSub.id,
        reviewerId: teacherId,
        status: reviewStatus,
        score: Number(score),
        feedback
      });

      if (result.review) {
        queryClient.invalidateQueries({ queryKey: ["learning-prefetch", tenantId] });
        setSelectedProjectSub(null);
        setFeedback("");
        showSuccess("Project submission graded successfully!");
      } else {
        showError(result.error || "Failed to submit review.");
      }
    });
  };

  // Form submit: activity building
  const handleCreateActivityBase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedLessonId) {
      showError(!selectedCourseId ? "Please select a course." : "Still preparing this course for activities — please wait a moment and try again.");
      return;
    }
    if (activityType === "quiz" && quizStrictMode && !quizTimeLimit) {
      showError("Strict/Proctored Mode requires a time limit to be set.");
      return;
    }

    startTransition(async () => {
      const res = await createActivityAndSubclassAction({
        tenant_id: selectedInstId,
        institution_id: selectedInstId,
        lesson_id: selectedLessonId,
        activity_type_code: activityType,
        status_code: "published",
        title,
        description,
        instructions,
        max_score: maxScore,
        passing_score: passingScore,
        is_mandatory: isMandatory,

        quiz_time_limit: quizTimeLimit,
        quiz_max_attempts: quizMaxAttempts,
        quiz_shuffle_questions: quizShuffleQ,
        quiz_shuffle_options: quizShuffleO,
        quiz_strict_mode: quizStrictMode,

        project_overview: projOverview,
        project_requirements: projRequirements,
        project_deliverables: projDeliverables,
        project_difficulty: projDifficulty,
        project_estimated_hours: projHours,

        chal_difficulty: chalDifficulty,
        chal_problem_statement: chalStatement,
        chal_input_format: chalInput,
        chal_output_format: chalOutput,
        chal_constraints: chalConstraints,
        chal_strict_mode: chalStrictMode
      });

      if (res.error) {
        showError(res.error);
      } else if (res.activity) {
        showSuccess(`Base activity "${title}" created successfully!`);
        setCreatedActivityId(res.activity.id);

        if (activityType === "quiz") {
          const details = await getQuizDetailsAction(res.activity.id);
          if (details && "quiz" in details && details.quiz) {
            setCreatedQuizId(details.quiz.id);
          }
        } else if (activityType === "programming") {
          const details = await getProgrammingChallengeDetailsAction(res.activity.id, "00000000-0000-0000-0000-000000000000");
          if (details && "challenge" in details && details.challenge) {
            setCreatedChallengeId(details.challenge.id);
          }
        }
        
        // Refresh local activity list
        queryClient.invalidateQueries({ queryKey: ["learning-prefetch", tenantId] });
        setTitle("");
        setDescription("");
        setInstructions("");
      }
    });
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdQuizId) return;

    startTransition(async () => {
      const optionsPayload = newQuestionOptions.filter(o => o.trim()).map((o, idx) => ({
        optionText: o,
        isCorrect: newQuestionCorrectIndices.includes(idx),
        position: idx + 1
      }));

      const res = await createQuizQuestionAndOptionsAction(
        createdQuizId,
        newQuestionText,
        newQuestionType,
        newQuestionPoints,
        quizQuestionsList.length + 1,
        optionsPayload
      );

      if (res.question) {
        setQuizQuestionsList(prev => [...prev, res.question]);
        showSuccess("Quiz question appended successfully!");
        setNewQuestionText("");
        setNewQuestionOptions(["", "", "", ""]);
        setNewQuestionCorrectIndices([0]);
      } else {
        showError(res.error || "Failed to append question.");
      }
    });
  };

  const handleAddExample = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdChallengeId) return;

    startTransition(async () => {
      const res = await createChallengeExampleAction({
        challenge_id: createdChallengeId,
        example_number: examplesList.length + 1,
        input_example: newExInput,
        output_example: newExOutput,
        explanation: newExExpl
      });

      if (res.example) {
        setExamplesList(prev => [...prev, res.example]);
        showSuccess("Coding example added!");
        setNewExInput("");
        setNewExOutput("");
        setNewExExpl("");
      }
    });
  };

  const handleAddTestCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdChallengeId) return;

    startTransition(async () => {
      const res = await createChallengeTestCaseAction({
        challenge_id: createdChallengeId,
        input_data: newTcInput,
        expected_output: newTcOutput,
        is_hidden: newTcHidden,
        position: testCasesList.length + 1
      });

      if (res.testCase) {
        setTestCasesList(prev => [...prev, res.testCase]);
        showSuccess("Internal validation test case added!");
        setNewTcInput("");
        setNewTcOutput("");
      }
    });
  };

  const handleViewActivityClick = async (activity: any) => {
    setSelectedActivity(activity);
    setActivityDetails(null);
    setDetailsLoading(true);
    setActiveDrawerTab("config");
    setIsEditing(false);

    // Load details
    const detRes = await getActivityDetailsNoStudentAction(activity.id, activity.activity_type_code);
    setActivityDetails(detRes);

    // Set edit form values
    setEditForm({
      title: activity.title || "",
      description: activity.description || "",
      instructions: activity.instructions || "",
      max_score: activity.max_score ?? 100,
      passing_score: activity.passing_score ?? 0,
      is_mandatory: activity.is_mandatory ?? true,

      // Quiz
      quiz_time_limit: detRes?.quiz?.time_limit_minutes ?? 30,
      quiz_max_attempts: detRes?.quiz?.max_attempts ?? 1,
      quiz_shuffle_questions: detRes?.quiz?.shuffle_questions ?? false,
      quiz_shuffle_options: detRes?.quiz?.shuffle_options ?? false,
      quiz_show_results_immediately: detRes?.quiz?.show_results_immediately ?? true,
      quiz_strict_mode: detRes?.quiz?.strict_mode ?? false,

      // Project
      project_overview: detRes?.project?.project_overview ?? "",
      project_requirements: detRes?.project?.requirements ?? "",
      project_deliverables: detRes?.project?.deliverables ?? "",
      project_submission_instructions: detRes?.project?.submission_instructions ?? "",
      project_difficulty: detRes?.project?.difficulty_level ?? "intermediate",
      project_estimated_hours: detRes?.project?.estimated_hours ?? 10,

      // Challenge
      chal_difficulty: detRes?.challenge?.difficulty_level ?? "easy",
      chal_problem_statement: detRes?.challenge?.problem_statement ?? "",
      chal_input_format: detRes?.challenge?.input_format ?? "",
      chal_output_format: detRes?.challenge?.output_format ?? "",
      chal_constraints: detRes?.challenge?.constraints_text ?? "",
      chal_starter_code: detRes?.challenge?.starter_code ?? "",
      chal_time_limit: detRes?.challenge?.time_limit_ms ?? 1000,
      chal_memory_limit: detRes?.challenge?.memory_limit_mb ?? 256,
      chal_strict_mode: detRes?.challenge?.strict_mode ?? false,

      // Assignments
      assignments: (detRes?.assignments || []).map((a: any) => ({
        id: a.id,
        cohort_id: a.cohort_id,
        available_from: formatDatetimeLocal(a.available_from),
        available_until: formatDatetimeLocal(a.available_until),
        is_required: a.is_required ?? true
      }))
    });

    if (activity.activity_type_code === "programming" && detRes) {
      setExamplesList(detRes.examples || []);
      setTestCasesList(detRes.testCases || []);
      setCreatedChallengeId(detRes.challenge?.id || "");
    } else {
      setExamplesList([]);
      setTestCasesList([]);
      setCreatedChallengeId("");
    }

    setDetailsLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    if (selectedActivity.activity_type_code === "quiz" && editForm.quiz_strict_mode && !editForm.quiz_time_limit) {
      showError("Strict/Proctored Mode requires a time limit to be set.");
      return;
    }

    startTransition(async () => {
      const res = await updateActivityAndSubclassAction(selectedActivity.id, {
        activity_type_code: selectedActivity.activity_type_code,
        title: editForm.title,
        description: editForm.description,
        instructions: editForm.instructions,
        max_score: Number(editForm.max_score),
        passing_score: Number(editForm.passing_score),
        is_mandatory: editForm.is_mandatory,

        // Quiz
        quiz_time_limit: Number(editForm.quiz_time_limit),
        quiz_max_attempts: Number(editForm.quiz_max_attempts),
        quiz_shuffle_questions: editForm.quiz_shuffle_questions,
        quiz_shuffle_options: editForm.quiz_shuffle_options,
        quiz_show_results_immediately: editForm.quiz_show_results_immediately,
        quiz_strict_mode: editForm.quiz_strict_mode,

        // Project
        project_overview: editForm.project_overview,
        project_requirements: editForm.project_requirements,
        project_deliverables: editForm.project_deliverables,
        project_submission_instructions: editForm.project_submission_instructions,
        project_difficulty: editForm.project_difficulty,
        project_estimated_hours: Number(editForm.project_estimated_hours),

        // Challenge
        chal_difficulty: editForm.chal_difficulty,
        chal_problem_statement: editForm.chal_problem_statement,
        chal_input_format: editForm.chal_input_format,
        chal_output_format: editForm.chal_output_format,
        chal_constraints: editForm.chal_constraints,
        chal_starter_code: editForm.chal_starter_code,
        chal_time_limit: Number(editForm.chal_time_limit),
        chal_memory_limit: Number(editForm.chal_memory_limit),
        chal_strict_mode: editForm.chal_strict_mode,

        // Assignments
        assignments: editForm.assignments.map((a: any) => ({
          id: a.id,
          cohort_id: a.cohort_id,
          available_from: a.available_from ? new Date(a.available_from).toISOString() : undefined,
          available_until: a.available_until ? new Date(a.available_until).toISOString() : undefined,
          is_required: a.is_required
        }))
      });

      if (res.error) {
        showError(res.error);
      } else if (res.activity) {
        showSuccess("Learning activity updated successfully!");
        // Refresh local activity list
        queryClient.invalidateQueries({ queryKey: ["learning-prefetch", tenantId] });
        const updatedActivity = {
          ...selectedActivity,
          title: editForm.title,
          description: editForm.description,
          instructions: editForm.instructions,
          max_score: Number(editForm.max_score),
          passing_score: Number(editForm.passing_score),
          is_mandatory: editForm.is_mandatory
        };
        setSelectedActivity(updatedActivity);

        const detRes = await getActivityDetailsNoStudentAction(updatedActivity.id, updatedActivity.activity_type_code);
        setActivityDetails(detRes);

        setIsEditing(false);
      }
    });
  };

  const handleDeleteExample = async (id: string) => {
    startTransition(async () => {
      const res = await deleteChallengeExampleAction(id);
      if (res.success) {
        setExamplesList(prev => prev.filter(ex => ex.id !== id));
        showSuccess("Visible Example deleted!");
      } else {
        showError(res.error || "Failed to delete example");
      }
    });
  };

  const handleDeleteTestCase = async (id: string) => {
    startTransition(async () => {
      const res = await deleteChallengeTestCaseAction(id);
      if (res.success) {
        setTestCasesList(prev => prev.filter(tc => tc.id !== id));
        showSuccess("Test Case deleted!");
      } else {
        showError(res.error || "Failed to delete test case");
      }
    });
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actId = createdActivityId;
    const targetCohortId = selectedCohortId;
    if (!actId || !targetCohortId) {
      showError("Please select activity base details to schedule assignment.");
      return;
    }

    startTransition(async () => {
      const result = await assignActivityToCohortAction({
        activity_id: actId,
        cohort_id: targetCohortId,
        is_required: true,
        available_from: availableFrom ? new Date(availableFrom).toISOString() : undefined,
        available_until: availableUntil ? new Date(availableUntil).toISOString() : undefined,
        created_by: teacherId
      });

      if (result.assignment) {
        showSuccess("Activity successfully scheduled and assigned to class cohort!");
        setCreatedActivityId("");
        setCreatedQuizId("");
        setCreatedChallengeId("");
        setQuizQuestionsList([]);
        setExamplesList([]);
        setTestCasesList([]);
      } else {
        showError(result.error || "Failed to schedule activity assignment.");
      }
    });
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabusCourseId) return;

    startTransition(async () => {
      const res = await createModuleAction({
        course_id: syllabusCourseId,
        title: newModuleTitle,
        position: Number(newModulePosition),
        tenant_id: selectedInstId,
        institution_id: selectedInstId
      });

      if (res.success && res.module) {
        showSuccess("New module created successfully!");
        setSyllabusModules(prev => [...prev, res.module].sort((a, b) => a.position - b.position));
        setNewModuleTitle("");
        setNewModulePosition(prev => prev + 1);
        setModuleFormOpen(false);
      } else {
        showError(res.error || "Failed to create module.");
      }
    });
  };

  const handleDeleteModule = (modId: string) => {
    if (!window.confirm("Are you sure you want to delete this module and all its lessons?")) return;

    startTransition(async () => {
      const res = await deleteModuleAction(modId);
      if (res.success) {
        showSuccess("Module deleted successfully.");
        setSyllabusModules(prev => prev.filter(m => m.id !== modId));
        setSyllabusLessons(prev => prev.filter(l => l.module_id !== modId));
        setSyllabusModuleId("");
        setSyllabusLessonId("");
      } else {
        showError(res.error || "Failed to delete module.");
      }
    });
  };

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabusModuleId) return;

    startTransition(async () => {
      const res = await createLessonAction({
        module_id: syllabusModuleId,
        title: newLessonTitle,
        duration: Number(newLessonDuration),
        position: Number(newLessonPosition),
        tenant_id: selectedInstId,
        institution_id: selectedInstId
      });

      if (res.success && res.lesson) {
        showSuccess("New lesson created successfully!");
        setSyllabusLessons(prev => [...prev, res.lesson].sort((a, b) => a.position - b.position));
        setNewLessonTitle("");
        setNewLessonDuration(30);
        setNewLessonPosition(prev => prev + 1);
        setLessonFormOpen(false);
      } else {
        showError(res.error || "Failed to create lesson.");
      }
    });
  };

  const handleDeleteLesson = (lesId: string) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) return;

    startTransition(async () => {
      const res = await deleteLessonAction(lesId);
      if (res.success) {
        showSuccess("Lesson deleted successfully.");
        setSyllabusLessons(prev => prev.filter(l => l.id !== lesId));
        setSyllabusLessonId("");
      } else {
        showError(res.error || "Failed to delete lesson.");
      }
    });
  };

  // Form submit: Update Lesson details (video URL etc)
  const handleUpdateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabusLessonId) return;

    startTransition(async () => {
      const res = await updateLessonAction(syllabusLessonId, {
        title: newLessonTitle,
        video_url: newLessonVideoUrl,
        duration: Number(newLessonDuration),
        content_json: newLessonContentText ? { text: newLessonContentText, body: newLessonContentText } : {},
        lesson_type_id: newLessonTypeId || undefined,
        position: Number(newLessonPositionOrder),
        is_preview: newLessonIsPreview
      });

      if (res.success) {
        showSuccess("Lesson video and content details updated!");
        // Refresh local syllabus lessons
        setSyllabusLessons(prev => 
          prev.map(l => l.id === syllabusLessonId ? { 
            ...l, 
            title: newLessonTitle, 
            video_url: newLessonVideoUrl, 
            duration: Number(newLessonDuration),
            content_json: newLessonContentText ? { text: newLessonContentText, body: newLessonContentText } : {},
            lesson_type_id: newLessonTypeId,
            position: Number(newLessonPositionOrder),
            is_preview: newLessonIsPreview,
            lesson_type: lessonTypes.find(t => t.id === newLessonTypeId) || l.lesson_type
          } : l)
        );
      } else {
        showError(res.error || "Failed to update lesson content.");
      }
    });
  };

  // Form submit: Add resource study material
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabusLessonId) return;

    startTransition(async () => {
      const res = await createLessonResourceAction({
        lesson_id: syllabusLessonId,
        resource_type: resType,
        title: resTitle,
        external_url: resExternalUrl,
        tenant_id: selectedInstId,
        institution_id: selectedInstId
      });

      if (res.resource) {
        setSyllabusResources(prev => [...prev, res.resource]);
        setResTitle("");
        setResExternalUrl("");
        showSuccess("Study material resource appended to lesson successfully!");
      } else {
        showError(res.error || "Failed to add resource study material.");
      }
    });
  };

  // Action click: Delete resource
  const handleDeleteResource = (id: string) => {
    if (!confirm("Are you sure you want to delete this study material resource?")) return;

    startTransition(async () => {
      const res = await deleteLessonResourceAction(id);
      if (res.success) {
        setSyllabusResources(prev => prev.filter(r => r.id !== id));
        showSuccess("Resource removed.");
      } else {
        showError(res.error || "Failed to delete resource.");
      }
    });
  };

  const renderActivityConsoleDrawer = () => {
    if (!selectedActivity) return null;

    return (
      <>
        {/* Drawer backdrop */}
        <div 
          onClick={() => setSelectedActivity(null)}
          className="fixed inset-0 z-40 bg-[#23252D]/30 backdrop-blur-xs transition-opacity duration-300"
        />

        {/* Slide-over Drawer */}
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col text-xs text-[#EDEFF5]">
          
          {/* Header */}
          <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                <Award size={16} className="text-[#6E79F4]" /> Activity Console
              </h3>
              <p className="text-[10px] text-[#C2C6D1] mt-0.5">{selectedActivity.title}</p>
            </div>
            <button 
              onClick={() => setSelectedActivity(null)}
              className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab navigation inside drawer */}
          <div className="flex border-b border-[#23252C] shrink-0 bg-[#16171D]/30">
            <button
              onClick={() => setActiveDrawerTab("config")}
              className={`flex-1 py-3 text-center font-bold border-b-2 transition-all ${
                activeDrawerTab === "config" 
                  ? "border-[#6E79F4] text-[#6E79F4]" 
                  : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
              }`}
            >
              Configuration Details
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {detailsLoading ? (
              <SecondaryLoader variant="spinner" message="Loading details..." />
            ) : activeDrawerTab === "config" ? (
              isEditing ? (
                // EDIT FORM
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Activity Title *</label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Description</label>
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Guidelines / Hint</label>
                    <textarea
                      rows={3}
                      value={editForm.instructions}
                      onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Max Score *</label>
                      <input
                        type="number"
                        required
                        value={editForm.max_score}
                        onChange={(e) => setEditForm({ ...editForm, max_score: Number(e.target.value) })}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Passing Score *</label>
                      <input
                        type="number"
                        required
                        value={editForm.passing_score}
                        onChange={(e) => setEditForm({ ...editForm, passing_score: Number(e.target.value) })}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="edit_is_mandatory"
                      checked={editForm.is_mandatory}
                      onChange={(e) => setEditForm({ ...editForm, is_mandatory: e.target.checked })}
                      className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                    />
                    <label htmlFor="edit_is_mandatory" className="font-semibold text-xs text-[#EDEFF5]">Mandatory Required Activity</label>
                  </div>

                  {/* Subclass: Coding Challenge */}
                  {selectedActivity.activity_type_code === "programming" && (
                    <div className="border-t border-[#23252C] pt-4 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1]">Coding Challenge Configuration</h4>
                      <div className="space-y-1">
                        <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Problem Statement *</label>
                        <textarea
                          rows={4}
                          required
                          value={editForm.chal_problem_statement}
                          onChange={(e) => setEditForm({ ...editForm, chal_problem_statement: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Input Format</label>
                          <textarea
                            rows={2}
                            value={editForm.chal_input_format}
                            onChange={(e) => setEditForm({ ...editForm, chal_input_format: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Output Format</label>
                          <textarea
                            rows={2}
                            value={editForm.chal_output_format}
                            onChange={(e) => setEditForm({ ...editForm, chal_output_format: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Constraints</label>
                        <textarea
                          rows={2}
                          value={editForm.chal_constraints}
                          onChange={(e) => setEditForm({ ...editForm, chal_constraints: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Legacy Starter Code (fallback, language-agnostic)</label>
                        <textarea
                          rows={3}
                          value={editForm.chal_starter_code}
                          onChange={(e) => setEditForm({ ...editForm, chal_starter_code: e.target.value })}
                          className="w-full bg-slate-900 text-slate-100 border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                        />
                      </div>
                      {createdChallengeId && (
                        <ChallengeEditor
                          challengeId={createdChallengeId}
                          initialStarterCode={activityDetails?.starterCodeByLanguage}
                          strictMode={editForm.chal_strict_mode}
                          onStrictModeChange={(value) => setEditForm({ ...editForm, chal_strict_mode: value })}
                        />
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Difficulty</label>
                          <CustomSelect
                            options={[
                              { id: "easy", name: "Easy" },
                              { id: "medium", name: "Medium" },
                              { id: "hard", name: "Hard" },
                            ]}
                            value={editForm.chal_difficulty}
                            onChange={(value) => setEditForm({ ...editForm, chal_difficulty: value })}
                            searchable={false}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Time Limit (ms)</label>
                          <input
                            type="number"
                            value={editForm.chal_time_limit}
                            onChange={(e) => setEditForm({ ...editForm, chal_time_limit: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Memory Limit (MB)</label>
                          <input
                            type="number"
                            value={editForm.chal_memory_limit}
                            onChange={(e) => setEditForm({ ...editForm, chal_memory_limit: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" id="edit-activity-form-submit-teacher" className="hidden" />
                </form>
              ) : (
                // VIEW MODE
                <div className="space-y-5">
                  <div className="bg-[#16171D] border border-[#23252C] p-4 rounded-xl space-y-3.5">
                    <h4 className="font-bold text-[#EDEFF5] border-b border-[#23252C] pb-1.5 text-xs">General Metrics</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-[#C2C6D1] block">Max Score</span>
                        <strong className="text-xs font-mono text-[#EDEFF5]">{selectedActivity.max_score} Points</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#C2C6D1] block">Passing Threshold</span>
                        <strong className="text-xs font-mono text-[#EDEFF5]">{selectedActivity.passing_score} Points</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#C2C6D1] block">Mandatory Required</span>
                        <strong className="text-xs text-[#EDEFF5]">{selectedActivity.is_mandatory ? "Yes" : "No (Optional)"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#C2C6D1] block">Activity Engine</span>
                        <strong className="text-xs uppercase text-[#EDEFF5]">{selectedActivity.activity_type_code}</strong>
                      </div>
                    </div>
                  </div>

                  {selectedActivity.description && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Description</span>
                      <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] leading-relaxed">
                        {selectedActivity.description}
                      </p>
                    </div>
                  )}

                  {selectedActivity.instructions && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Guidelines & Hint</span>
                      <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] font-mono leading-relaxed whitespace-pre-wrap">
                        {selectedActivity.instructions}
                      </p>
                    </div>
                  )}

                  {selectedActivity.activity_type_code === "programming" && activityDetails?.challenge && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Problem Statement</span>
                        <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] font-mono leading-relaxed whitespace-pre-wrap">
                          {activityDetails.challenge.problem_statement}
                        </p>
                      </div>

                      {activityDetails.challenge.starter_code && (
                        <div className="space-y-1">
                          <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Starter Template Outline</span>
                          <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed">
                            {activityDetails.challenge.starter_code}
                          </pre>
                        </div>
                      )}

                      {activityDetails.examples && activityDetails.examples.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Visible Examples</span>
                          {activityDetails.examples.map((ex: any) => (
                            <div key={ex.id} className="border border-[#23252C] rounded-lg p-2.5 bg-[#16171D]/30 font-mono text-[10px] space-y-1">
                              <div><span className="text-[#C2C6D1]">Input:</span> {ex.input_example}</div>
                              <div><span className="text-[#C2C6D1]">Output:</span> {ex.output_example}</div>
                              {ex.explanation && <div><span className="text-[#C2C6D1]">Explanation:</span> {ex.explanation}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : null}

            {/* In Edit mode, show coding challenge extra components */}
            {isEditing && selectedActivity.activity_type_code === "programming" && (
              <div className="border-t border-[#23252C] pt-4 mt-6 space-y-6">
                {/* Examples Section */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                    <Eye size={14} className="text-[#6E79F4]" /> Modify Examples ({examplesList.length})
                  </h4>
                  {examplesList.length > 0 && (
                    <div className="space-y-2">
                      {examplesList.map((ex, index) => (
                        <div key={ex.id || index} className="p-3 bg-[#16171D] border border-[#23252C] rounded-xl flex justify-between items-start gap-4 text-[10px]">
                          <div className="font-mono space-y-1">
                            <div><span className="text-[#C2C6D1] font-semibold">Ex {ex.example_number}:</span> Input: {ex.input_example}</div>
                            <div><span className="text-[#C2C6D1] font-semibold">Output:</span> {ex.output_example}</div>
                            {ex.explanation && <div><span className="text-[#C2C6D1] font-semibold">Exp:</span> {ex.explanation}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteExample(ex.id)}
                            className="p-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-[#F0555D] rounded-lg transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-[#16171D]/50 p-4 border border-[#23252C] rounded-xl space-y-3">
                    <span className="font-bold text-[9px] uppercase text-[#C2C6D1] tracking-wider block">Add New Example</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Input Example"
                        value={newExInput}
                        onChange={(e) => setNewExInput(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Output Example"
                        value={newExOutput}
                        onChange={(e) => setNewExOutput(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Explanation"
                      value={newExExpl}
                      onChange={(e) => setNewExExpl(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddExample}
                      className="bg-[#6E79F4] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                    >
                      Add Example
                    </button>
                  </div>
                </div>

                {/* Test Cases Section */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                    <Layers size={14} className="text-[#6E79F4]" /> Modify Test Cases ({testCasesList.length})
                  </h4>
                  {testCasesList.length > 0 && (
                    <div className="space-y-2">
                      {testCasesList.map((tc, index) => (
                        <div key={tc.id || index} className="p-3 bg-[#16171D] border border-[#23252C] rounded-xl flex justify-between items-start gap-4 text-[10px]">
                          <div className="font-mono space-y-1">
                            <div><span className="text-[#C2C6D1] font-semibold">Test {index + 1}:</span> Input: {tc.input_data}</div>
                            <div><span className="text-[#C2C6D1] font-semibold">Expected:</span> {tc.expected_output}</div>
                            <div><span className="text-[#C2C6D1] font-semibold">Hidden:</span> {tc.is_hidden ? "Yes" : "No"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTestCase(tc.id)}
                            className="p-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-[#F0555D] rounded-lg transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-[#16171D]/50 p-4 border border-[#23252C] rounded-xl space-y-3">
                    <span className="font-bold text-[9px] uppercase text-[#C2C6D1] tracking-wider block">Add New Test Case</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <textarea
                        placeholder="Input Data"
                        value={newTcInput}
                        onChange={(e) => setNewTcInput(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono font-medium"
                      />
                      <textarea
                        placeholder="Expected Output"
                        value={newTcOutput}
                        onChange={(e) => setNewTcOutput(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit_tc_is_hidden_teacher"
                        checked={newTcHidden}
                        onChange={(e) => setNewTcHidden(e.target.checked)}
                        className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                      />
                      <label htmlFor="edit_tc_is_hidden_teacher" className="font-semibold text-xs text-[#C2C6D1]">Hidden Test Case</label>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTestCase}
                      className="bg-[#6E79F4] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                    >
                      Add Test Case
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions footer inside drawer */}
          <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex justify-between shrink-0">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] text-[#C2C6D1] px-4 py-2 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const btn = document.getElementById("edit-activity-form-submit-teacher");
                    if (btn) btn.click();
                  }}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/90 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save size={14} /> Save Changes
                </button>
              </>
            ) : (
              <>
                {activeDrawerTab === "config" ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="border border-[#23252C] hover:bg-[#1A1C22] text-[#6E79F4] px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit size={14} /> Edit Blueprint
                  </button>
                ) : (
                  <div />
                )}
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/90 cursor-pointer"
                >
                  Close Console
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  };

  const openStudentDrawer = async (enr: any) => {
    if (openingStudentId) return;
    setOpeningStudentId(enr.id);
    setStudentDetailTab("overview");
    try {
      const [progRes, lessonsRes, syllabusEntries] = await Promise.all([
        getStudentDeliveryDataAction(enr.user_id),
        listStudentLessonProgressAction(enr.user_id),
        Promise.all(
          tenantCourses.map(async (c: any) => {
            if (drawerLessonsCache[c.id]) return [c.id, drawerLessonsCache[c.id]] as const;
            const res = await listLessonsForCourseAction(c.id);
            return [c.id, res.success && res.lessons ? res.lessons : []] as const;
          })
        ),
      ]);
      setActiveStudentProgress(progRes.success && progRes.programs ? progRes.programs : []);
      setActiveStudentLessonsProgress(lessonsRes.success && lessonsRes.progressList ? lessonsRes.progressList : []);
      setDrawerLessonsCache(prev => ({ ...prev, ...Object.fromEntries(syllabusEntries) }));
      setSelectedStudent(enr);
    } finally {
      setOpeningStudentId(null);
    }
  };

  const renderStudentDetailDrawer = () => {
    if (!selectedStudent) return null;

    // Real student progress percentage from enrollment/overall computed average
    const progressPercentage = selectedStudent.progress_percentage || 0;
    
    // Project Submissions for this student
    const studentProjSubs = projectSubmissions.filter(sub => sub.student_id === selectedStudent.user_id);
    
    // Challenge Submissions for this student
    const studentChalSubs = challengeSubmissions.filter(sub => sub.student_id === selectedStudent.user_id);
    
    // Quizzes & Activities
    const quizzes = activities.filter(a => a.activity_type_code === "quiz");
    const projects = activities.filter(a => a.activity_type_code === "project");
    const challenges = activities.filter(a => a.activity_type_code === "programming");
    
    // Modules and lessons based on courses in the program
    const programCourses = coursesList.filter(c => !selectedProgramId || c.program_id === selectedProgramId);

    // Filter actual student quiz attempts
    const studentQuizAttemptsList = quizAttempts.filter(att => att.student_id === selectedStudent.user_id);

    const studentQuizAttempts = quizzes.map(q => {
      const attempts = studentQuizAttemptsList.filter(att => att.activity_id === q.id);
      const sortedAttempts = [...attempts].sort((a, b) => new Date(b.submitted_at || b.created_at || b.updated_at || 0).getTime() - new Date(a.submitted_at || a.created_at || a.updated_at || 0).getTime());
      const passedAttempt = sortedAttempts.find(att => att.score >= (q.passing_score || 0));
      const attempt = passedAttempt || sortedAttempts[0];

      return {
        id: q.id,
        title: q.title,
        attempted: !!attempt,
        passed: attempt ? (attempt.score >= (q.passing_score || 0)) : false,
        score: attempt ? attempt.score : 0,
        maxScore: q.max_score || 100,
        submittedAt: attempt ? new Date(attempt.submitted_at || attempt.created_at || attempt.updated_at || 0).toLocaleDateString() : "",
        attemptsCount: attempts.length
      };
    });

    // Real syllabus lessons mapper using lazy loaded drawerLessonsCache and activeStudentLessonsProgress
    const studentSyllabus = programCourses.map((course) => {
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
        {/* Backdrop click closer */}
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedStudent(null)} />
        
        {/* Drawer container */}
        <div className="relative w-full max-w-3xl bg-[#131418] h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#23252C] flex justify-between items-start gap-4 bg-[#16171D]">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#6E79F4] text-white flex items-center justify-center font-bold text-lg uppercase shadow-md border border-[#6E79F4]/10">
                {(selectedStudent.student?.full_name || selectedStudent.student?.email || "S").substring(0, 2)}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#EDEFF5]">{selectedStudent.student?.full_name || "Invited Candidate"}</h3>
                <p className="text-xs text-[#C2C6D1]">{selectedStudent.student?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20">
                    {selectedStudent.cohort?.name || "No cohort"}
                  </span>
                  <span className="text-[10px] text-[#C2C6D1]">• Enrolled on {new Date(selectedStudent.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedStudent(null)}
              className="p-1.5 hover:bg-[#23252C] rounded-xl transition-all border border-transparent hover:border-[#23252C]"
            >
              <svg className="w-5 h-5 text-[#C2C6D1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Tab Navigation */}
          <div className="flex border-b border-[#23252C] px-6 bg-[#131418] shrink-0">
            {(["overview", "syllabus", "quizzes", "projects", "challenges"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStudentDetailTab(tab)}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all capitalize ${
                  studentDetailTab === tab 
                    ? "border-[#6E79F4] text-[#6E79F4] font-bold" 
                    : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* 1. OVERVIEW TAB */}
            {studentDetailTab === "overview" && (
              <div className="space-y-6 animate-fadeIn">
                {/* Performance Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/10 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Course Progress</span>
                    <div className="text-xl font-black text-[#6E79F4] mt-1">{progressPercentage}%</div>
                    <div className="w-full bg-[#23252C] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#6E79F4] h-full" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/10 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Quizzes Completed</span>
                    <div className="text-xl font-black text-[#2FBF71] mt-1">
                      {studentQuizAttempts.filter(q => q.attempted).length} / {quizzes.length}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">Avg Score: {
                      studentQuizAttempts.filter(q => q.attempted).length > 0 
                        ? Math.round(studentQuizAttempts.reduce((acc, curr) => acc + curr.score, 0) / studentQuizAttempts.filter(q => q.attempted).length) 
                        : 0
                    }%</span>
                  </div>

                  <div className="bg-[#F5B04A]/5 border border-[#F5B04A]/10 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Projects Validated</span>
                    <div className="text-xl font-black text-[#F5B04A] mt-1">
                      {studentProjSubs.filter(p => p.review?.review_status === "approved").length} / {projects.length}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">{studentProjSubs.length} total uploads</span>
                  </div>

                  <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/10 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Coding Runs</span>
                    <div className="text-xl font-black text-[#22D3EE] mt-1">
                      {studentChalSubs.filter(c => c.submission_status_code === "accepted").length} / {challenges.length}
                    </div>
                    <span className="text-[8px] text-[#C2C6D1] block mt-2">{studentChalSubs.length} total submits</span>
                  </div>
                </div>

                {/* Progress Detail List */}
                <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
                    <TrendingUp size={14} className="text-[#6E79F4]" /> Core Curricular Activity Overview
                  </h4>
                  <div className="divide-y divide-[#23252C] text-xs">
                    <div className="py-3 flex justify-between">
                      <span className="text-[#C2C6D1] font-medium">Active Student status</span>
                      <span className="font-bold text-[#2FBF71] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#2FBF71] rounded-full animate-ping"></span> Active in Portal
                      </span>
                    </div>
                    <div className="py-3 flex justify-between">
                      <span className="text-[#C2C6D1] font-medium">Program title</span>
                      <span className="font-bold text-[#EDEFF5]">
                        {programsList.find(p => p.id === selectedProgramId)?.title || "Standard Curriculum"}
                      </span>
                    </div>
                    <div className="py-3 flex justify-between">
                      <span className="text-[#C2C6D1] font-medium">Lessons finished</span>
                      <span className="font-bold text-[#EDEFF5]">
                        {activeStudentLessonsProgress.filter(p => p.status_code === "completed").length} Lessons Completed
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
                    No syllabus lessons found for this program.
                  </div>
                ) : (
                  studentSyllabus.map(course => {
                    const isExpanded = expandedCourseId === course.id;
                    return (
                      <div key={course.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden">
                        {/* Collapsible Header */}
                        <div 
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                          className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg 
                              className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-90" : ""}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                            <h4 className="text-xs font-extrabold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{course.title}</h4>
                          </div>
                          <span className="text-[10px] font-bold text-[#6E79F4] bg-[#6E79F4]/10 px-2 py-0.5 rounded-full border border-[#6E79F4]/20 shrink-0">Course</span>
                        </div>

                        {/* Collapsible content (lessons list) */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[#23252C] space-y-2.5 bg-[#16171D]/30">
                            {course.lessons.map(lesson => (
                              <div key={lesson.id} className="flex justify-between items-center text-xs p-2.5 bg-[#131418] border border-[#23252C] rounded-xl hover:bg-[#16171D] transition-all shadow-sm">
                                <div className="flex items-center gap-2.5">
                                  {lesson.status === "completed" ? (
                                    <div className="w-5 h-5 rounded-full bg-[#2FBF71]/10 text-[#2FBF71] flex items-center justify-center border border-[#2FBF71]/20"><CheckCircle2 className="w-3 h-3" /></div>
                                  ) : lesson.status === "in_progress" ? (
                                    <div className="w-5 h-5 rounded-full bg-[#F5B04A]/10 text-[#F5B04A] flex items-center justify-center border border-[#F5B04A]/20"><Clock className="w-3 h-3" /></div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-[#1A1C22] text-[#A3A9B6] flex items-center justify-center font-bold text-[10px] border border-[#23252C]">•</div>
                                  )}
                                  <span className="font-semibold text-[#EDEFF5]">{lesson.title}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                  lesson.status === "completed" 
                                    ? "bg-[#2FBF71]/10 text-[#2FBF71]" 
                                    : lesson.status === "in_progress"
                                    ? "bg-[#F5B04A]/10 text-[#F5B04A]"
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
                {studentQuizAttempts.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                    No quizzes found on the platform.
                  </div>
                ) : (
                  studentQuizAttempts.map(attempt => {
                    return (
                      <div key={attempt.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                        <div className="p-5 flex justify-between items-center gap-4 hover:bg-[#16171D]/80 transition-colors select-none">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <h4 className="text-xs font-bold text-[#EDEFF5]">{attempt.title}</h4>
                              {attempt.attempted && (
                                <p className="text-[9px] text-[#C2C6D1] mt-0.5">
                                  {attempt.attemptsCount > 1 ? `${attempt.attemptsCount} attempts • ` : ""}
                                  Last attempt on {attempt.submittedAt}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0 font-bold">
                            {attempt.attempted ? (
                              attempt.passed ? (
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
                    No project repository uploads submitted yet by this student.
                  </div>
                ) : (
                  studentProjSubs.map(sub => {
                    const hasReview = !!sub.review;
                    const isExpanded = expandedProjectId === sub.id;
                    return (
                      <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                        {/* Collapsible Header */}
                        <div 
                          onClick={() => setExpandedProjectId(isExpanded ? null : sub.id)}
                          className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg 
                              className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-90" : ""}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                            <div>
                              <h4 className="text-xs font-bold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{sub.project_title}</h4>
                              <p className="text-[9px] text-[#C2C6D1] mt-0.5">Submitted on {new Date(sub.submitted_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase shrink-0 ${
                            !hasReview || sub.review.review_status === "pending"
                              ? "bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20"
                              : sub.review.review_status === "approved"
                              ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
                              : "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
                          }`}>
                            {!hasReview ? "Pending Review" : sub.review.review_status}
                          </span>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[#23252C] space-y-3 bg-[#16171D]/30">
                            <div>
                              <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">GitHub Submission Link</span>
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
                                  "{sub.submission_notes}"
                                </p>
                              </div>
                            )}

                            <div className="pt-3 border-t border-[#23252C]">
                              <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-2">Review Summary & Grading</span>
                              {hasReview ? (
                                <div className="p-3 bg-[#6E79F4]/5 border border-[#6E79F4]/10 rounded-xl space-y-2">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-[#C2C6D1] font-medium">Assigned Score:</span>
                                    <strong className="text-sm font-black text-[#6E79F4]">{sub.review.score} / {sub.max_score} pts</strong>
                                  </div>
                                  {sub.review.feedback && (
                                    <div className="text-[10px] text-[#EDEFF5] mt-1 pt-1.5 border-t border-[#6E79F4]/10">
                                      <strong className="block text-[#C2C6D1] uppercase text-[8px] tracking-wide mb-0.5">Instructor Feedback:</strong>
                                      {sub.review.feedback}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 border border-dashed border-[#23252C] rounded-xl flex items-center justify-between">
                                  <span className="text-[#C2C6D1] text-[10px]">No grading has been registered for this submission.</span>
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectSub(sub);
                                      setActiveParentTab("assessments");
                                      setActiveTab("projects");
                                      setSelectedStudent(null);
                                    }}
                                    className="bg-[#6E79F4] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-[#5A66F0]"
                                  >
                                    Grade Now
                                  </button>
                                </div>
                              )}
                            </div>
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
                    No programming challenge attempts logged yet by this student.
                  </div>
                ) : (
                  studentChalSubs.map(sub => {
                    const isExpanded = expandedChallengeId === sub.id;
                    return (
                      <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                        {/* Collapsible Header */}
                        <div 
                          onClick={() => setExpandedChallengeId(isExpanded ? null : sub.id)}
                          className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg 
                              className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-90" : ""}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                            <div>
                              <h4 className="text-xs font-bold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{sub.challenge_title}</h4>
                              <p className="text-[9px] text-[#C2C6D1] mt-0.5">Submitted runtime: {sub.language} • {new Date(sub.submitted_at).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase shrink-0 ${
                            sub.submission_status_code === "accepted"
                              ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
                              : "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
                          }`}>
                            {sub.submission_status_code}
                          </span>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[#23252C] space-y-3 bg-[#16171D]/30">
                            <div>
                              <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">Submitted Source Code</span>
                              <pre className="p-3.5 bg-[#6E79F4] text-white text-[10px] font-mono rounded-xl overflow-x-auto max-h-48">
                                <code>{sub.source_code}</code>
                              </pre>
                            </div>

                            {sub.result && (
                              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-3 space-y-1.5 text-[10px] shadow-sm">
                                <span className="font-bold text-[#EDEFF5] block uppercase tracking-wider text-[8px]">Compiler / Tester Execution Logs:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                  <div className="flex justify-between border-r pr-2 border-[#23252C]">
                                    <span className="text-[#C2C6D1]">Validation Cases:</span>
                                    <strong className="text-[#2FBF71]">{sub.result.passed_test_cases} / {sub.result.total_test_cases}</strong>
                                  </div>
                                  <div className="flex justify-between pl-1">
                                    <span className="text-[#C2C6D1]">Performance runtime:</span>
                                    <strong>{sub.result.execution_time_ms} ms</strong>
                                  </div>
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

          </div>
          
          {/* Drawer Footer closer */}
          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedStudent(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Profile
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderQuizAuditorDrawer = () => {
    if (!selectedQuizAttempt) return null;
    
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="w-full max-w-2xl bg-[#131418] h-full shadow-2xl flex flex-col animate-slideOver">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#23252C] flex items-center justify-between bg-[#16171D] shrink-0">
            <div>
              <h3 className="text-sm font-bold text-[#EDEFF5]">Quiz Attempt Details</h3>
              <p className="text-xs text-[#C2C6D1]">
                Student: <strong className="text-[#EDEFF5]">{selectedQuizAttempt.student?.full_name || selectedQuizAttempt.student?.email}</strong>
              </p>
            </div>
            <button 
              onClick={() => setSelectedQuizAttempt(null)}
              className="text-[#C2C6D1] hover:text-[#EDEFF5] p-2 hover:bg-[#23252C]/50 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0C0F] p-4 border border-[#23252C] rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Quiz Activity</span>
                <span className="font-bold text-[#EDEFF5]">{selectedQuizAttempt.quiz_title}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Scored Points</span>
                <span className="font-bold text-[#6E79F4] text-sm">{selectedQuizAttempt.score} / {selectedQuizAttempt.max_score} pts</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Attempt Number</span>
                <span className="font-semibold text-[#EDEFF5]">Attempt #{selectedQuizAttempt.attempt_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Submission Date</span>
                <span className="font-semibold text-[#EDEFF5]">
                  {selectedQuizAttempt.submitted_at 
                    ? new Date(selectedQuizAttempt.submitted_at).toLocaleString() 
                    : "In Progress"}
                </span>
              </div>
            </div>

            {/* Session Forfeit / Violation warning info */}
            {selectedQuizAttempt.forfeited && (
              <div className="bg-[#F0555D]/5 border border-[#F0555D]/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#F0555D]">
                  <ShieldAlert size={18} />
                  <h4 className="font-bold text-xs uppercase tracking-wide">Environment Violation Detected</h4>
                </div>
                <p className="text-[11px] text-[#C2C6D1] leading-relaxed">
                  This attempt was automatically closed and forfeited (scored 0 pts) because the student left the secure quiz environment. 
                  <br />
                  <span className="font-semibold text-[#EDEFF5] mt-1 block">
                    Reason logged: <code className="text-[#F0555D] bg-[#F0555D]/10 px-1.5 py-0.5 rounded font-mono text-[10px] capitalize">{selectedQuizAttempt.forfeit_reason?.replace(/_/g, " ") || "Abnormal Exit / Rule Violation"}</code>
                  </span>
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={async () => {
                      if (!confirm("Are you sure you want to approve this student for a retake? This will refund their attempt and allow them to take the quiz again.")) return;
                      startTransition(async () => {
                        const res = await approveQuizRetakeAction(selectedQuizAttempt.id);
                        if (res && !("error" in res)) {
                          queryClient.invalidateQueries({ queryKey: ["learning-prefetch", tenantId] });
                          showSuccess("Retake approved! The student can now restart the test attempt.");
                          setSelectedQuizAttempt(null);
                        } else {
                          showError(res.error || "Failed to approve retake.");
                        }
                      });
                    }}
                    className="bg-[#6E79F4] hover:bg-[#5A66F0] disabled:bg-[#2E313A] text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 size={12} />
                    Approve Retake / Reset Attempt
                  </button>
                </div>
              </div>
            )}

            <hr className="border-[#23252C]" />

            <div>
              <h4 className="text-xs font-bold text-[#EDEFF5] uppercase mb-3 tracking-wider">Submitted Answers Verification</h4>
              
              {loadingQuizSession ? (
                <SecondaryLoader variant="skeleton" message="Retrieving session questions and selected answers..." className="!border-0 !p-0 shadow-none" />
              ) : !quizAttemptSession || !quizAttemptSession.questions ? (
                <div className="text-center py-6 text-xs text-[#C2C6D1] border border-dashed border-[#23252C] rounded-xl">
                  No responses logged for this quiz session.
                </div>
              ) : (
                <div className="space-y-4">
                  {quizAttemptSession.questions.map((q: any, qIdx: number) => {
                    const isCorrect = q.selectedIndex === q.correctIndex;
                    return (
                      <div key={q.id || qIdx} className="p-4 bg-[#131418] border border-[#23252C] rounded-xl text-xs space-y-2 shadow-sm">
                        <div className="font-semibold text-[#EDEFF5] flex justify-between gap-4">
                          <span>Q{qIdx + 1}: {q.text}</span>
                          <span className={`font-black shrink-0 ${isCorrect ? "text-[#2FBF71]" : "text-[#F0555D]"}`}>
                            {isCorrect ? `+${q.points} pts` : "0 pts"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-1.5 pt-1.5">
                          {q.options.map((opt: any, oIdx: number) => {
                            const isSelected = q.selectedIndex === oIdx;
                            const isAnsCorrect = q.correctIndex === oIdx;
                            
                            return (
                              <div 
                                key={oIdx} 
                                className={`p-2.5 rounded-lg border flex items-center gap-2 text-[11px] ${
                                  isAnsCorrect 
                                    ? "bg-[#2FBF71]/10 border-[#2FBF71]/30 text-[#2FBF71] font-bold" 
                                    : isSelected 
                                    ? "bg-[#F0555D]/10 border-[#F0555D]/30 text-[#F0555D] font-semibold" 
                                    : "bg-[#131418] border-[#23252C] text-[#C2C6D1]"
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black shrink-0 ${
                                  isAnsCorrect 
                                    ? "bg-[#2FBF71] border-transparent text-white" 
                                    : isSelected 
                                    ? "bg-[#F0555D] border-transparent text-white" 
                                    : "border-[#2E313A]"
                                  }`}>
                                  {oIdx === 0 ? "A" : oIdx === 1 ? "B" : oIdx === 2 ? "C" : oIdx === 3 ? "D" : String(oIdx + 1)}
                                </div>
                                <span>{opt.option_text || opt}</span>
                                {isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#2FBF71]/20 px-1.5 py-0.5 rounded text-[#2FBF71]">Correct Option</span>}
                                {isSelected && !isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#F0555D]/20 px-1.5 py-0.5 rounded text-[#F0555D]">Submitted Answer</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedQuizAttempt(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Auditor details
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderProjectAuditorDrawer = () => {
    if (!selectedProjectSub) return null;

    const isAlreadyApproved = selectedProjectSub.review?.review_status === "approved";

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="w-full max-w-2xl bg-[#131418] h-full shadow-2xl flex flex-col animate-slideOver">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#23252C] flex items-center justify-between bg-[#16171D] shrink-0">
            <div>
              <h3 className="text-sm font-bold text-[#EDEFF5]">Project Submission Auditor</h3>
              <p className="text-xs text-[#C2C6D1]">
                Student: <strong className="text-[#EDEFF5]">{selectedProjectSub.student?.full_name || selectedProjectSub.student?.email}</strong>
              </p>
            </div>
            <button 
              onClick={() => setSelectedProjectSub(null)}
              className="text-[#C2C6D1] hover:text-[#EDEFF5] p-2 hover:bg-[#23252C]/50 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <form onSubmit={handleReviewSubmit} className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider mb-2">
                  Project: {selectedProjectSub.project_title}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0C0F] p-4 border border-[#23252C] rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                    !selectedProjectSub.review || selectedProjectSub.review.review_status === "pending"
                      ? "bg-[#F5B04A]/10 text-[#F5B04A]"
                      : selectedProjectSub.review.review_status === "approved"
                      ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                      : "bg-[#F0555D]/10 text-[#F0555D]"
                  }`}>
                    {!selectedProjectSub.review ? "Pending Review" : selectedProjectSub.review.review_status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Max Score</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedProjectSub.max_score} pts</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Submitted At</span>
                  <span className="font-semibold text-[#EDEFF5]">
                    {new Date(selectedProjectSub.submitted_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                  Submitted GitHub URL
                </label>
                <a 
                  href={selectedProjectSub.github_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-[#6E79F4] font-semibold break-all hover:underline flex items-center gap-1"
                >
                  {selectedProjectSub.github_url}
                  <ExternalLink size={12} />
                </a>
              </div>

              {selectedProjectSub.submission_notes && (
                <div>
                  <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                    Student Submission Notes
                  </label>
                  <p className="text-xs bg-[#0B0C0F] border border-[#23252C] rounded-xl p-3 text-[#EDEFF5]">
                    {selectedProjectSub.submission_notes}
                  </p>
                </div>
              )}

              <hr className="border-[#23252C]" />

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider">Evaluation & Grading Actions</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    disabled={isAlreadyApproved}
                    onClick={() => {
                      setReviewStatus("revision_requested");
                      setScore(0);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      reviewStatus === "revision_requested"
                        ? "border-[#F5B04A] bg-[#F5B04A]/5 shadow-sm"
                        : "border-[#23252C] hover:border-[#F5B04A]/30 bg-transparent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#EDEFF5]">Send for Rework</span>
                      <span className="w-2 h-2 rounded-full bg-[#F5B04A]" />
                    </div>
                    <p className="text-[10px] text-[#C2C6D1]">Request the student to revise and resubmit their repository link.</p>
                  </button>

                  <button
                    type="button"
                    disabled={isAlreadyApproved}
                    onClick={() => {
                      setReviewStatus("approved");
                      setScore(selectedProjectSub.review?.score ?? selectedProjectSub.max_score ?? 100);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      reviewStatus === "approved"
                        ? "border-[#2FBF71] bg-[#2FBF71]/5 shadow-sm"
                        : "border-[#23252C] hover:border-[#2FBF71]/30 bg-transparent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#EDEFF5]">Grade & Approve</span>
                      <span className="w-2 h-2 rounded-full bg-[#2FBF71]" />
                    </div>
                    <p className="text-[10px] text-[#C2C6D1]">Approve the submission and assign grade marks to the student.</p>
                  </button>
                </div>

                {reviewStatus === "approved" && (
                  <div className="space-y-3 bg-[#131418] border border-[#23252C] p-4 rounded-xl animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Full Marks</span>
                        <span className="font-mono font-bold text-[#EDEFF5]">{selectedProjectSub.max_score} pts</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Passing Marks</span>
                        <span className="font-mono font-bold text-[#F5B04A]">{selectedProjectSub.passing_score ?? Math.round(selectedProjectSub.max_score * 0.5)} pts</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block">
                          Assigned Score
                        </label>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          score >= (selectedProjectSub.passing_score ?? Math.round(selectedProjectSub.max_score * 0.5))
                            ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                            : "bg-[#F0555D]/10 text-[#F0555D]"
                        }`}>
                          {score >= (selectedProjectSub.passing_score ?? Math.round(selectedProjectSub.max_score * 0.5)) ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                      <input 
                        type="number"
                        max={selectedProjectSub.max_score}
                        min={0}
                        value={score}
                        disabled={isAlreadyApproved}
                        onChange={(e) => setScore(Number(e.target.value))}
                        className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full font-mono text-[#EDEFF5] disabled:opacity-50 disabled:cursor-not-allowed"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                    {reviewStatus === "revision_requested" ? "Rework Instructions / Feedback Remarks *" : "Evaluation Feedback Remarks"}
                  </label>
                  <textarea 
                    rows={4}
                    value={feedback}
                    disabled={isAlreadyApproved}
                    onChange={(e) => setFeedback(e.target.value)}
                    required={reviewStatus === "revision_requested"}
                    placeholder={reviewStatus === "revision_requested" ? "Please detail the instructions for rework..." : "Add review feedback for the student..."}
                    className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isPending || isAlreadyApproved}
                className="w-full bg-[#6E79F4] hover:bg-[#5A66F0] disabled:bg-[#2E313A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isPending ? "Submitting..." : isAlreadyApproved ? "Submission Already Approved (Locked)" : "Submit Review Grade"}
              </button>
            </form>
          </div>

          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedProjectSub(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Auditor details
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderChallengeAuditorDrawer = () => {
    if (!selectedChallengeSub) return null;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="w-full max-w-2xl bg-[#131418] h-full shadow-2xl flex flex-col animate-slideOver">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#23252C] flex items-center justify-between bg-[#16171D] shrink-0">
            <div>
              <h3 className="text-sm font-bold text-[#EDEFF5]">Challenge Submission Auditor</h3>
              <p className="text-xs text-[#C2C6D1]">
                Student: <strong className="text-[#EDEFF5]">{selectedChallengeSub.student?.full_name || selectedChallengeSub.student?.email}</strong>
              </p>
            </div>
            <button 
              onClick={() => setSelectedChallengeSub(null)}
              className="text-[#C2C6D1] hover:text-[#EDEFF5] p-2 hover:bg-[#23252C]/50 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider mb-1">
                Challenge Name
              </h3>
              <span className="text-xs font-bold">{selectedChallengeSub.challenge_title}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0C0F] p-4 border border-[#23252C] rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Language Runtime</span>
                <span className="text-xs font-semibold uppercase">{selectedChallengeSub.language}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block uppercase ${
                  selectedChallengeSub.submission_status_code === "accepted"
                    ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                    : selectedChallengeSub.submission_status_code === "pending" || selectedChallengeSub.submission_status_code === "running"
                    ? "bg-[#F5B04A]/10 text-[#F5B04A]"
                    : "bg-[#F0555D]/10 text-[#F0555D]"
                }`}>
                  {selectedChallengeSub.submission_status_code.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Submitted At</span>
                <span className="font-semibold text-[#EDEFF5]">
                  {new Date(selectedChallengeSub.submitted_at).toLocaleString()}
                </span>
              </div>
            </div>

            <hr className="border-[#23252C]" />

            <div>
              <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">Submitted Code Snippet</span>
              <pre className="p-4 bg-[#6E79F4] text-white text-[11px] font-mono rounded-xl overflow-x-auto max-h-80 shadow-inner">
                <code>{selectedChallengeSub.source_code}</code>
              </pre>
            </div>

            {selectedChallengeSub.result && (
              <div className="bg-[#0B0C0F] border border-[#23252C] rounded-xl p-4 space-y-2 text-xs">
                <span className="font-bold text-[#EDEFF5] block uppercase tracking-wide text-[10px]">Judge Execution Results</span>
                <div className="flex justify-between">
                  <span className="text-[#C2C6D1]">Passed Test Cases:</span>
                  <strong className="text-[#2FBF71]">{selectedChallengeSub.result.passed_test_cases} / {selectedChallengeSub.result.total_test_cases}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#C2C6D1]">Execution Time:</span>
                  <strong>{selectedChallengeSub.result.execution_time_ms} ms</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#C2C6D1]">Assigned Grade Score:</span>
                  <strong className="text-[#6E79F4]">{selectedChallengeSub.result.score} pts</strong>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedChallengeSub(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Auditor details
            </button>
          </div>

        </div>
      </div>
    );
  };

  const initialError = deliveryError || learningError || academicError;
  if (initialError) {
     return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load the instructor dashboard. {initialError.message}</div>;
  }

  return (
    <>
      <AppShell
      portalLabel="Instructor"
      pageTitle={
        activeParentTab === "overview"
          ? "Instructor Dashboard"
          : activeParentTab === "students"
          ? "Student Directory"
          : activeParentTab === "attendance"
          ? "Attendance Register"
          : activeParentTab === "assessments"
          ? (activeTab === "quiz-auditor" ? "Quiz Auditor" : activeTab === "projects" ? "Projects Auditor" : "Coding Auditor")
          : (activeTab === "activities-manager" ? "Activities Builder" : activeTab === "view_activities" ? "Published Activities" : "Course Syllabus")
      }
      items={[
        { id: "overview", label: "Overview Space", icon: Layers },
        { id: "students", label: "Student Hub", icon: Users },
        { id: "attendance", label: "Attendance", icon: Calendar },
        {
          id: "assessments",
          label: "Auditing & Grading", 
          icon: CheckSquare,
          children: [
            { id: "quiz-auditor", label: "Quiz Auditor" },
            { id: "projects", label: "Projects Auditor" },
            { id: "challenges", label: "Coding Auditor" },
          ]
        },
        { 
          id: "curriculum", 
          label: "Curriculum Space", 
          icon: BookOpen,
          children: [
            { id: "activities-manager", label: "Activities Builder" },
            { id: "view_activities", label: "Published Activities" },
            { id: "syllabus", label: "Course Syllabus" },
          ]
        }
      ]}
      activeId={activeParentTab}
      activeChildId={activeTab}
      onSelect={(parentId, childId) => {
        setActiveParentTab(parentId as any);
        if (childId) {
          setActiveTab(childId as any);
        } else {
          // Defaults when parent is clicked
          if (parentId === "overview") {
            setActiveTab("overview");
          } else if (parentId === "students") {
            setActiveTab("roster");
          } else if (parentId === "attendance") {
            setActiveTab("attendance");
          } else if (parentId === "assessments") {
            setActiveTab("quiz-auditor");
          } else if (parentId === "curriculum") {
            setActiveTab("activities-manager");
          }
        }
      }}
      userName={teacherEmail}
      userMeta={teacherName}
      headerActions={
        cohorts.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsCohortDropdownOpen(!isCohortDropdownOpen)}
              className="flex items-center gap-2 bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl hover:border-[#6E79F4]/40 hover:bg-[#6E79F4]/5 transition-all text-[11px] font-bold text-[#EDEFF5] cursor-pointer max-w-[220px] sm:max-w-[320px]"
            >
              <GraduationCap size={14} className="text-[#6E79F4] shrink-0" />
              <span className="truncate">
                {selectedCohort ? `${selectedCohort.name} (${selectedCohort.code})` : "Select Group"}
              </span>
              <ChevronDown size={13} className="text-[#A3A9B6] shrink-0" />
            </button>

            {isCohortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#131418] border border-[#23252C] rounded-xl shadow-card z-50 py-1.5 animate-fadeIn">
                <div className="px-4 py-1.5 border-b border-[#23252C] text-[9px] font-bold text-[#A3A9B6] uppercase tracking-wider">
                  Switch Active Group / Cohort
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {cohorts.map((coh) => (
                    <button
                      key={coh.id}
                      onClick={() => {
                        setSelectedCohortId(coh.id);
                        setIsCohortDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-[#16171D] transition-all flex flex-col gap-0.5 text-xs cursor-pointer ${
                        selectedCohortId === coh.id ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#C2C6D1]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate min-w-0 flex-1">{coh.name} ({coh.code})</span>
                        {selectedCohortId === coh.id && <CheckCircle2 size={13} className="text-[#6E79F4] shrink-0" />}
                      </div>
                      {coh.institution?.name && (
                        <span className="text-[9px] text-[#A3A9B6] truncate font-medium">Campus: {coh.institution.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }
    >
      <DashboardLoader loading={loadingDelivery || loadingLearning || loadingPrograms} message="Setting up your Instructor environment..." />
      
      {isSelectedInstDisabled ? (
        <div className="bg-[#131418] border border-[#23252C] p-8 rounded-2xl shadow-sm max-w-2xl mx-auto text-center space-y-6 mt-10 h-fit">
          <div className="mx-auto w-16 h-16 bg-[#F0555D]/10 text-[#F0555D] rounded-full flex items-center justify-center border border-[#F0555D]/20">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#EDEFF5]">Institution Access Suspended</h2>
            <p className="text-sm text-[#C2C6D1]">
              The institution <strong className="text-[#EDEFF5]">{currentSelectedInst?.name}</strong> is currently deactivated or suspended.
            </p>
            <p className="text-xs text-[#C2C6D1] leading-relaxed">
              All teacher dashboard controls and curriculum management tools have been locked for this campus. If you work with other institutions, please select another active institution from the dropdown menu above.
            </p>
          </div>
        </div>
      ) : (
        <main className="flex-1 min-w-0 space-y-6">
          {isSelectedProgDisabled ? (
            <div className="bg-[#131418] border border-[#23252C] p-8 rounded-2xl shadow-sm max-w-2xl mx-auto text-center space-y-6 mt-10">
              <div className="mx-auto w-16 h-16 bg-[#F0555D]/10 text-[#F0555D] rounded-full flex items-center justify-center border border-[#F0555D]/20">
                <ShieldAlert size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-[#EDEFF5]">Batch Access Suspended</h2>
                <p className="text-sm text-[#C2C6D1]">
                  The batch <strong className="text-[#EDEFF5]">{currentSelectedProg?.title}</strong> is currently deactivated or suspended.
                </p>
                <p className="text-xs text-[#C2C6D1] leading-relaxed">
                  All teaching tools, roster management, grading, and syllabus editors have been locked for this batch. Please select another active batch from the header dropdown to continue.
                </p>
              </div>
            </div>
          ) : (
            <>
          {currentSelectedProg?.status?.code === "draft" && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 flex items-start gap-2.5 shadow-sm">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Draft Batch Pathway</span>
                <p className="mt-0.5 text-amber-700 font-medium">
                  This batch is currently in draft mode. You can customize, update, and manage the curriculum/syllabus, but students and institutions won't be able to view or enroll in it until a Super Admin approves and activates it.
                </p>
              </div>
            </div>
          )}

          {/* TAB: ATTENDANCE REGISTER */}
          {activeTab === "attendance" && (
            <div className="animate-fadeIn">
              <AttendanceModule institutions={assignedInstitutions} userRole={primaryRole as "super_admin" | "teacher" | "trainer"} />
            </div>
          )}

          {/* TAB: QUIZ AUDITOR */}
          {activeTab === "quiz-auditor" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#23252C]">
                  <div>
                    <h3 className="text-sm font-bold text-[#EDEFF5]">Student Quiz Auditor</h3>
                    <p className="text-[10px] text-[#C2C6D1]">Audit, evaluate, and verify all student quiz submission answers and marks in real time.</p>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-60">
                      <Search className="absolute left-3 top-2.5 text-[#C2C6D1]" size={14} />
                      <input
                        type="text"
                        placeholder="Search student name..."
                        value={quizSearch}
                        onChange={e => setQuizSearch(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/30 rounded-lg pl-9 pr-3 py-1.5 text-[11px] font-bold text-[#EDEFF5] placeholder-[#A3A9B6] outline-none focus:border-[#6E79F4] focus:ring-2 focus:ring-[#6E79F4]/15 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsQuizDateDropdownOpen(!isQuizDateDropdownOpen)}
                        className="flex items-center gap-2 bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/40 hover:bg-[#6E79F4]/5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold text-[#EDEFF5] cursor-pointer"
                      >
                        <Calendar size={13} className="text-[#6E79F4] shrink-0" />
                        <span>{dateFilterLabels[quizDateFilter]}</span>
                        <ChevronDown size={12} className="text-[#A3A9B6] shrink-0" />
                      </button>

                      {isQuizDateDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#131418] border border-[#23252C] rounded-xl shadow-card z-50 py-1 animate-fadeIn">
                          {Object.entries(dateFilterLabels).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setQuizDateFilter(val);
                                setIsQuizDateDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 hover:bg-[#16171D] transition-all flex items-center justify-between text-xs cursor-pointer ${
                                quizDateFilter === val ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#C2C6D1]"
                              }`}
                            >
                              <span>{label}</span>
                              {quizDateFilter === val && <CheckCircle2 size={12} className="text-[#6E79F4]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {filteredQuizAttemptsList.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#C2C6D1] border border-dashed border-[#23252C] rounded-xl mt-4">
                    No quiz submissions found matching the criteria.
                  </div>
                ) : (
                  <div className="divide-y divide-[#23252C] mt-2">
                    {filteredQuizAttemptsList.map(att => {
                      const isPassed = att.score >= (att.passing_score || 0) || (att.score >= (att.max_score * 0.5));
                      return (
                        <div 
                          key={att.id}
                          onClick={() => setSelectedQuizAttempt(att)}
                          className="py-3.5 flex justify-between items-center gap-4 hover:bg-[#16171D]/50 px-2 rounded-xl transition-all cursor-pointer select-none"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border border-cyan-500/25 bg-cyan-500/10 text-cyan-500 shrink-0">
                                Quiz
                              </span>
                              <h4 className="text-xs font-bold text-[#EDEFF5] truncate">{att.quiz_title}</h4>
                            </div>
                            
                            <p className="text-[10px] text-[#C2C6D1] mt-1">
                              Submitted by <strong className="text-[#EDEFF5]">{att.student?.full_name || att.student?.email || "Unknown Student"}</strong> • {new Date(att.submitted_at || att.started_at).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-[#EDEFF5]">
                              {att.score} <span className="text-[10px] text-[#C2C6D1] font-normal">/ {att.max_score} pts</span>
                            </span>

                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase ${
                              isPassed 
                                ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20" 
                                : "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
                            }`}>
                              {isPassed ? "Passed" : "Failed"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Active Scope: Institution / Group / Timeline */}
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm p-6">
                <h3 className="text-xs font-bold text-[#C2C6D1] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#6E79F4]" /> Working Scope
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-[#16171D] border border-[#23252C] rounded-xl">
                    <div className="p-2 bg-[#6E79F4]/10 text-[#6E79F4] rounded-xl shrink-0"><Building2 size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Institution</p>
                      <p className="text-xs font-bold text-[#EDEFF5] truncate">{currentSelectedInst?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#16171D] border border-[#23252C] rounded-xl">
                    <div className="p-2 bg-[#2FBF71]/10 text-[#2FBF71] rounded-xl shrink-0"><Layers size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Group / Cohort</p>
                      <p className="text-xs font-bold text-[#EDEFF5] truncate">
                        {selectedCohort ? `${selectedCohort.name} (${selectedCohort.code})` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#16171D] border border-[#23252C] rounded-xl">
                    <div className="p-2 bg-[#F5B04A]/10 text-[#F5B04A] rounded-xl shrink-0"><Calendar size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Timeline</p>
                      <p className="text-xs font-bold text-[#EDEFF5] truncate">
                        {selectedCohort?.start_date
                          ? `${new Date(selectedCohort.start_date).toLocaleDateString()} – ${selectedCohort.end_date ? new Date(selectedCohort.end_date).toLocaleDateString() : "Ongoing"}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#131418] border border-[#23252C] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold text-[#C2C6D1] uppercase tracking-wider">Cohorts</span>
                    <div className="p-2 bg-[#6E79F4]/10 text-[#6E79F4] rounded-xl"><Layers size={18} /></div>
                  </div>
                  <h2 className="text-2xl font-bold">{filteredCohorts.length}</h2>
                  <p className="text-[10px] text-[#C2C6D1] mt-1">Managed educational cohorts</p>
                </div>

                <div className="bg-[#131418] border border-[#23252C] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold text-[#C2C6D1] uppercase tracking-wider">Active Students</span>
                    <div className="p-2 bg-[#2FBF71]/10 text-[#2FBF71] rounded-xl"><Users size={18} /></div>
                  </div>
                  <h2 className="text-2xl font-bold">{activeStudentsCount}</h2>
                  <p className="text-[10px] text-[#C2C6D1] mt-1">Enrolled class consumers</p>
                </div>

                <div className="bg-[#131418] border border-[#23252C] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold text-[#C2C6D1] uppercase tracking-wider">Pending Projects</span>
                    <div className="p-2 bg-[#F5B04A]/10 text-[#F5B04A] rounded-xl"><CheckSquare size={18} /></div>
                  </div>
                  <h2 className="text-2xl font-bold">{pendingProjectCount}</h2>
                  <p className="text-[10px] text-[#C2C6D1] mt-1">Requires manual evaluation</p>
                </div>

                <div className="bg-[#131418] border border-[#23252C] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold text-[#C2C6D1] uppercase tracking-wider">Challenge Runs</span>
                    <div className="p-2 bg-[#22D3EE]/10 text-[#22D3EE] rounded-xl"><Code2 size={18} /></div>
                  </div>
                  <h2 className="text-2xl font-bold">{filteredChallengeSubmissions.length}</h2>
                  <p className="text-[10px] text-[#C2C6D1] mt-1">Code challenge attempts logged</p>
                </div>
              </div>

              {/* Quick Pending Submissions Queue */}
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-[#6E79F4]" />
                  Recent Pending Evaluations Queue
                </h3>
                
                {filteredProjectSubmissions.filter(p => !p.review || p.review.review_status === "pending").length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl">
                    <AlertCircle className="mx-auto mb-2 text-[#C2C6D1]/40" size={32} />
                    <p className="text-xs font-medium text-[#C2C6D1]">All clear! No pending projects to grade.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#23252C]">
                    {filteredProjectSubmissions.filter(p => !p.review || p.review.review_status === "pending").slice(0, 5).map(sub => (
                      <div key={sub.id} className="py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#EDEFF5] truncate">{sub.project_title}</h4>
                          <p className="text-[10px] text-[#C2C6D1] mt-0.5">
                            Submitted by <strong className="text-[#EDEFF5]">{sub.student?.full_name || sub.student?.email}</strong> on {new Date(sub.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedProjectSub(sub);
                            setActiveParentTab("assessments");
                            setActiveTab("projects");
                          }}
                          className="flex items-center justify-center gap-1 bg-[#6E79F4] hover:bg-[#5A66F0] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 self-start sm:self-auto"
                        >
                          Grade Submission <ArrowRight size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COHORT ROSTER */}
          {activeTab === "roster" && (
            <div className="space-y-6 animate-fadeIn bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#EDEFF5]">Academic Student Directory</h3>
                  <p className="text-[10px] text-[#C2C6D1]">Active Cohort: <strong className="text-[#6E79F4] font-bold">{cohorts.find(c => c.id === selectedCohortId)?.name || "N/A"}</strong> (Directory includes all enrolled students)</p>
                </div>
              </div>

              {(() => {
                const filteredRoster = currentCohortEnrollments.filter((enr: any) => {
                  if (!rosterSearchQuery.trim()) return true;
                  const q = rosterSearchQuery.toLowerCase();
                  const fullName = (enr.student?.full_name || "").toLowerCase();
                  const email = (enr.student?.email || "").toLowerCase();
                  return fullName.includes(q) || email.includes(q);
                });

                if (currentCohortEnrollments.length === 0) {
                  return (
                    <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                      No students enrolled in this cohort yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="w-full sm:w-80 relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#C2C6D1]/60" />
                      <input
                        type="text"
                        placeholder="Search student by name or email..."
                        value={rosterSearchQuery}
                        onChange={(e) => setRosterSearchQuery(e.target.value)}
                        className="bg-[#131418] border border-[#23252C] pl-8 pr-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                      />
                    </div>

                    {filteredRoster.length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#C2C6D1] bg-[#16171D] rounded-xl border border-dashed border-[#23252C]">
                        No matching students found.
                      </div>
                    ) : (
                      <>
                      {/* Mobile card list */}
                      <div className="sm:hidden space-y-2">
                        {filteredRoster.map((enr: any) => (
                          <div
                            key={enr.id}
                            onClick={() => openStudentDrawer(enr)}
                            className={`p-3.5 bg-[#16171D] border border-[#23252C] rounded-xl space-y-2 cursor-pointer active:bg-[#1A1C22] transition-colors ${openingStudentId === enr.id ? "opacity-70" : ""}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-[#6E79F4]/10 text-[#6E79F4] flex items-center justify-center font-bold text-[10px] uppercase border border-[#6E79F4]/25 shadow-sm shrink-0">
                                {openingStudentId === enr.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : (enr.student?.full_name || enr.student?.email || "I").substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#EDEFF5] text-xs truncate">{enr.student?.full_name || "Invited Candidate"}</p>
                                <p className="text-[10px] text-[#C2C6D1] truncate">{enr.student?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[10px]">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex-1 bg-[#1A1C22] h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-[#6E79F4] h-full" style={{ width: `${enr.progress_percentage || 0}%` }}></div>
                                </div>
                                <span className="font-bold text-[#C2C6D1] shrink-0">{enr.progress_percentage || 0}%</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                enr.status_code === "active"
                                  ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                                  : "bg-[#3A3F4B]/10 text-[#C2C6D1]"
                              }`}>
                                {enr.status_code}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#C2C6D1]">Enrolled {new Date(enr.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>

                      {/* Desktop / tablet table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#23252C] text-[#C2C6D1] select-none">
                              <th className="py-3 font-bold uppercase tracking-wider">Student Name</th>
                              <th className="py-3 font-bold uppercase tracking-wider">Email Address</th>
                              <th className="py-3 font-bold uppercase tracking-wider">Syllabus Progress</th>
                              <th className="py-3 font-bold uppercase tracking-wider">Status</th>
                              <th className="py-3 font-bold uppercase tracking-wider">Enrolled On</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#23252C]">
                            {filteredRoster.map((enr: any) => (
                              <tr 
                                key={enr.id} 
                                onClick={() => openStudentDrawer(enr)}
                                className={`hover:bg-[#16171D]/50 cursor-pointer transition-colors ${openingStudentId === enr.id ? "opacity-70" : ""}`}
                              >
                                <td className="py-3.5 font-bold text-[#EDEFF5] flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-[#6E79F4]/10 text-[#6E79F4] flex items-center justify-center font-bold text-[10px] uppercase border border-[#6E79F4]/25 shadow-sm">
                                    {openingStudentId === enr.id
                                      ? <Loader2 size={12} className="animate-spin" />
                                      : (enr.student?.full_name || enr.student?.email || "I").substring(0, 2)}
                                  </div>
                                  <span className="hover:text-[#6E79F4] transition-colors">{enr.student?.full_name || "Invited Candidate"}</span>
                                </td>
                                <td className="py-3 text-[#C2C6D1]">{enr.student?.email}</td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2 w-28">
                                    <div className="flex-1 bg-[#1A1C22] h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-[#6E79F4] h-full" style={{ width: `${enr.progress_percentage || 0}%` }}></div>
                                    </div>
                                    <span className="font-bold shrink-0">{enr.progress_percentage || 0}%</span>
                                  </div>
                                </td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    enr.status_code === "active" 
                                      ? "bg-[#2FBF71]/10 text-[#2FBF71]" 
                                      : "bg-[#3A3F4B]/10 text-[#C2C6D1]"
                                  }`}>
                                    {enr.status_code}
                                  </span>
                                </td>
                                <td className="py-3 text-[#C2C6D1]">
                                  {new Date(enr.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: PROJECT VALIDATOR */}
          {activeTab === "projects" && (
            <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm h-fit animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#23252C] mb-4">
                <h3 className="text-sm font-bold text-[#EDEFF5]">Student Project Submissions</h3>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-3 top-2.5 text-[#C2C6D1]" size={14} />
                    <input
                      type="text"
                      placeholder="Search student..."
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/30 rounded-lg pl-9 pr-3 py-1.5 text-[11px] font-bold text-[#EDEFF5] placeholder-[#A3A9B6] outline-none focus:border-[#6E79F4] focus:ring-2 focus:ring-[#6E79F4]/15 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsProjectDateDropdownOpen(!isProjectDateDropdownOpen)}
                      className="flex items-center gap-2 bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/40 hover:bg-[#6E79F4]/5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold text-[#EDEFF5] cursor-pointer"
                    >
                      <Calendar size={13} className="text-[#6E79F4] shrink-0" />
                      <span>{dateFilterLabels[projectDateFilter]}</span>
                      <ChevronDown size={12} className="text-[#A3A9B6] shrink-0" />
                    </button>

                    {isProjectDateDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-[#131418] border border-[#23252C] rounded-xl shadow-card z-50 py-1 animate-fadeIn">
                        {Object.entries(dateFilterLabels).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setProjectDateFilter(val);
                              setIsProjectDateDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-[#16171D] transition-all flex items-center justify-between text-xs cursor-pointer ${
                              projectDateFilter === val ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#C2C6D1]"
                            }`}
                          >
                            <span>{label}</span>
                            {projectDateFilter === val && <CheckCircle2 size={12} className="text-[#6E79F4]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredProjectSubmissions.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                  No project submissions found.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProjectSubmissions.map(sub => {
                    const hasReview = !!sub.review;
                    const isSelected = selectedProjectSub?.id === sub.id;

                    return (
                      <div 
                        key={sub.id}
                        onClick={() => setSelectedProjectSub(sub)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? "border-[#6E79F4] bg-[#6E79F4]/5 shadow-sm" 
                            : "border-[#23252C] hover:border-[#9BA1AE]/50"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-[#EDEFF5]">{sub.project_title}</h4>
                            <p className="text-[10px] text-[#C2C6D1] mt-0.5">
                              By <strong className="text-[#EDEFF5]">{sub.student?.full_name || sub.student?.email}</strong>
                            </p>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            !hasReview || sub.review.review_status === "pending"
                              ? "bg-[#F5B04A]/10 text-[#F5B04A]"
                              : sub.review.review_status === "approved"
                              ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                              : "bg-[#F0555D]/10 text-[#F0555D]"
                          }`}>
                            {!hasReview ? "Pending Review" : sub.review.review_status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#23252C] text-[10px] text-[#C2C6D1]">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(sub.submitted_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-[#6E79F4]">
                            <ExternalLink size={12} />
                            GitHub Repo Link
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CHALLENGE AUDITOR */}
          {activeTab === "challenges" && (
            <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm h-fit animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#23252C] mb-4">
                <h3 className="text-sm font-bold text-[#EDEFF5]">Student Coding Submissions</h3>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-3 top-2.5 text-[#C2C6D1]" size={14} />
                    <input
                      type="text"
                      placeholder="Search student..."
                      value={challengeSearch}
                      onChange={e => setChallengeSearch(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/30 rounded-lg pl-9 pr-3 py-1.5 text-[11px] font-bold text-[#EDEFF5] placeholder-[#A3A9B6] outline-none focus:border-[#6E79F4] focus:ring-2 focus:ring-[#6E79F4]/15 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsChallengeDateDropdownOpen(!isChallengeDateDropdownOpen)}
                      className="flex items-center gap-2 bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/40 hover:bg-[#6E79F4]/5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold text-[#EDEFF5] cursor-pointer"
                    >
                      <Calendar size={13} className="text-[#6E79F4] shrink-0" />
                      <span>{dateFilterLabels[challengeDateFilter]}</span>
                      <ChevronDown size={12} className="text-[#A3A9B6] shrink-0" />
                    </button>

                    {isChallengeDateDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-[#131418] border border-[#23252C] rounded-xl shadow-card z-50 py-1 animate-fadeIn">
                        {Object.entries(dateFilterLabels).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setChallengeDateFilter(val);
                              setIsChallengeDateDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-[#16171D] transition-all flex items-center justify-between text-xs cursor-pointer ${
                              challengeDateFilter === val ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#C2C6D1]"
                            }`}
                          >
                            <span>{label}</span>
                            {challengeDateFilter === val && <CheckCircle2 size={12} className="text-[#6E79F4]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredChallengeSubmissions.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                  No coding challenge submissions logged yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredChallengeSubmissions.map(sub => {
                    const isSelected = selectedChallengeSub?.id === sub.id;

                    return (
                      <div 
                        key={sub.id}
                        onClick={() => setSelectedChallengeSub(sub)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? "border-[#6E79F4] bg-[#6E79F4]/5 shadow-sm" 
                            : "border-[#23252C] hover:border-[#9BA1AE]/50"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-[#EDEFF5]">{sub.challenge_title}</h4>
                            <p className="text-[10px] text-[#C2C6D1] mt-0.5">
                              Submitted by <strong className="text-[#EDEFF5]">{sub.student?.full_name || sub.student?.email}</strong>
                            </p>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase ${
                            sub.submission_status_code === "accepted"
                              ? "bg-[#2FBF71]/10 text-[#2FBF71]"
                              : sub.submission_status_code === "pending" || sub.submission_status_code === "running"
                              ? "bg-[#F5B04A]/10 text-[#F5B04A]"
                              : "bg-[#F0555D]/10 text-[#F0555D]"
                          }`}>
                            {sub.submission_status_code.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#23252C] text-[10px] text-[#C2C6D1]">
                          <span className="flex items-center gap-1 font-bold text-[#EDEFF5] bg-[#23252C]/40 px-1.5 py-0.5 rounded">
                            {sub.language}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(sub.submitted_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACTIVITIES & ASSIGNMENTS MANAGER */}
          {activeTab === "activities-manager" && (
            <div className="animate-fadeIn">
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm space-y-6">

                {!createdActivityId ? (
                  <form onSubmit={handleCreateActivityBase} className="space-y-4">
                    <h3 className="text-sm font-bold text-[#EDEFF5] pb-3 border-b border-[#23252C] flex items-center gap-1.5">
                      <Plus size={16} className="text-[#6E79F4]" /> Create Learning Activity
                    </h3>

                    <div>
                      <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                        Select Course *
                      </label>
                      <CustomSelect
                        options={filteredCourses.map((c: any) => ({ id: c.id, name: c.title }))}
                        value={selectedCourseId}
                        onChange={setSelectedCourseId}
                        placeholder="-- Choose Course --"
                        required
                      />
                      {lessonsLoading && (
                        <p className="text-[10px] text-[#C2C6D1] font-semibold mt-1">Preparing this course for activities...</p>
                      )}
                      {!lessonsLoading && selectedCourseId && lessonsList.length === 0 && (
                        <p className="text-[10px] text-[#F0555D] font-semibold mt-1">
                          Could not prepare this course for activities. Try selecting a different course.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                          Activity Type
                        </label>
                        <CustomSelect
                          options={[
                            { id: "quiz", name: "Quiz Assessment" },
                            { id: "project", name: "Project Repository Upload" },
                            { id: "programming", name: "Coding Challenge" },
                          ]}
                          value={activityType}
                          onChange={(value: any) => setActivityType(value)}
                          searchable={false}
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                          Activity Title *
                        </label>
                        <input 
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Module 3 Coding Quiz"
                          className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                          Max Score
                        </label>
                        <input 
                          type="number"
                          value={maxScore}
                          onChange={(e) => setMaxScore(Number(e.target.value))}
                          className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                          Passing Score
                        </label>
                        <input 
                          type="number"
                          value={passingScore}
                          onChange={(e) => setPassingScore(Number(e.target.value))}
                          className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <input 
                          type="checkbox"
                          id="isMandatoryAct"
                          checked={isMandatory}
                          onChange={(e) => setIsMandatory(e.target.checked)}
                          className="rounded text-[#6E79F4] focus:ring-[#6E79F4] h-4 w-4"
                        />
                        <label htmlFor="isMandatoryAct" className="text-xs font-semibold text-[#C2C6D1]">
                          Mandatory
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                        Overview / Description
                      </label>
                      <textarea 
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add activity outline..."
                        className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">
                        Instructions / Tips
                      </label>
                      <textarea 
                        rows={3}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Write guidelines for completion..."
                        className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full resize-none"
                      />
                    </div>

                    {activityType === "quiz" && (
                      <div className="p-4 bg-[#0B0C0F] border border-[#23252C] rounded-xl space-y-3">
                        <h4 className="text-[10px] font-bold text-[#EDEFF5] uppercase tracking-wide">Quiz Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Time Limit (Minutes)</label>
                            <input 
                              type="number" 
                              value={quizTimeLimit} 
                              onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                              className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Max Attempts</label>
                            <input 
                              type="number" 
                              value={quizMaxAttempts} 
                              onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
                              className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                            />
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={quizShuffleQ} onChange={(e) => setQuizShuffleQ(e.target.checked)} />
                            Shuffle Questions
                          </label>
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={quizShuffleO} onChange={(e) => setQuizShuffleO(e.target.checked)} />
                            Shuffle Options
                          </label>
                        </div>
                        <div className="pt-2 border-t border-[#23252C]">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={quizStrictMode} onChange={(e) => setQuizStrictMode(e.target.checked)} />
                            Enable Strict/Proctored Mode (fullscreen required, tab-switch = forfeited attempt)
                          </label>
                          {quizStrictMode && !quizTimeLimit && (
                            <p className="text-[10px] text-[#F0555D] font-semibold mt-1">Strict Mode requires a Time Limit to be set above.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activityType === "project" && (
                      <div className="p-4 bg-[#0B0C0F] border border-[#23252C] rounded-xl space-y-3">
                        <h4 className="text-[10px] font-bold text-[#EDEFF5] uppercase tracking-wide">Project Details</h4>
                        <div>
                          <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Overview Context</label>
                          <textarea 
                            rows={2} 
                            value={projOverview} 
                            onChange={(e) => setProjOverview(e.target.value)}
                            className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Requirements</label>
                          <textarea 
                            rows={2} 
                            value={projRequirements} 
                            onChange={(e) => setProjRequirements(e.target.value)}
                            className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                          />
                        </div>
                      </div>
                    )}

                    {activityType === "programming" && (
                      <div className="p-4 bg-[#0B0C0F] border border-[#23252C] rounded-xl space-y-3">
                        <h4 className="text-[10px] font-bold text-[#EDEFF5] uppercase tracking-wide">Challenge Definition</h4>
                        <div>
                          <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Problem Statement</label>
                          <textarea
                            rows={3}
                            value={chalStatement}
                            onChange={(e) => setChalStatement(e.target.value)}
                            className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Available From</label>
                            <input
                              type="datetime-local"
                              value={availableFrom}
                              onChange={(e) => setAvailableFrom(e.target.value)}
                              className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-[#C2C6D1] block mb-1">Due Date</label>
                            <input
                              type="datetime-local"
                              value={availableUntil}
                              onChange={(e) => setAvailableUntil(e.target.value)}
                              className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                            />
                          </div>
                        </div>
                        <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/15 p-2.5 rounded-lg text-[10px] text-[#EDEFF5] leading-relaxed">
                          <strong className="text-[#6E79F4]">Next step:</strong> save this base problem first — the per-language
                          starter code editor, lockdown toggle, examples, and visible/hidden test cases all open up in the
                          panel below immediately after saving, since they attach to the challenge record this creates.
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-[#6E79F4] hover:bg-[#5A66F0] text-white font-bold text-xs py-2 px-6 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      Save Activity Base details
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-[#23252C] pb-3">
                      <h3 className="text-xs font-bold text-[#EDEFF5] uppercase">Activity Elements Configurations</h3>
                      <button 
                        onClick={() => setCreatedActivityId("")}
                        className="bg-[#23252C] text-[#E2E4EB] font-bold text-[10px] px-3 py-1 rounded-lg"
                      >
                        Create Another Activity
                      </button>
                    </div>

                    {activityType === "quiz" && createdQuizId && (
                      <form onSubmit={handleAddQuestion} className="space-y-4 border border-[#23252C] p-4 rounded-xl">
                        <h4 className="text-xs font-bold flex items-center gap-1"><HelpCircle size={14} /> Add Quiz Question</h4>
                        <div>
                          <input 
                            type="text"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            placeholder="Question Title Text..."
                            className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs w-full"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] block font-bold text-[#C2C6D1]">Question Type</label>
                            <CustomSelect
                              options={[
                                { id: "single_choice", name: "Single Choice" },
                                { id: "multiple_choice", name: "Multiple Choice" },
                              ]}
                              value={newQuestionType}
                              onChange={(value: any) => setNewQuestionType(value)}
                              searchable={false}
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] block font-bold text-[#C2C6D1]">Points</label>
                            <input 
                              type="number"
                              value={newQuestionPoints}
                              onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                              className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold block text-[#C2C6D1]">Options Configuration</label>
                          {newQuestionOptions.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                checked={newQuestionCorrectIndices.includes(oIdx)}
                                onChange={() => setNewQuestionCorrectIndices([oIdx])}
                              />
                              <input 
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...newQuestionOptions];
                                  newOpts[oIdx] = e.target.value;
                                  setNewQuestionOptions(newOpts);
                                }}
                                placeholder={`Option ${oIdx + 1}`}
                                className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full"
                              />
                            </div>
                          ))}
                        </div>

                        <button type="submit" className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-xl font-bold">
                          Append Question
                        </button>
                      </form>
                    )}

                    {activityType === "programming" && createdChallengeId && (
                      <div className="space-y-4">
                        <div className="border border-[#23252C] p-4 rounded-xl">
                          <ChallengeEditor
                            challengeId={createdChallengeId}
                            strictMode={chalStrictMode}
                            onStrictModeChange={setChalStrictMode}
                          />
                        </div>

                        {examplesList.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1]">Examples Added ({examplesList.length})</h4>
                            {examplesList.map((ex, index) => (
                              <div key={ex.id || index} className="p-2.5 bg-[#16171D] border border-[#23252C] rounded-lg flex justify-between items-start gap-3 text-[10px] font-mono">
                                <div>Ex {ex.example_number}: Input: {ex.input_example} → Output: {ex.output_example}</div>
                                <button type="button" onClick={() => handleDeleteExample(ex.id)} className="p-1 bg-red-50 border border-red-100 hover:bg-red-100 text-[#F0555D] rounded shrink-0">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <form onSubmit={handleAddExample} className="space-y-4 border border-[#23252C] p-4 rounded-xl">
                          <h4 className="text-xs font-bold flex items-center gap-1"><FileCode size={14} /> Add Code Example</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <textarea placeholder="Input example" value={newExInput} onChange={e=>setNewExInput(e.target.value)} className="bg-[#131418] border border-[#23252C] rounded-lg p-2 text-xs font-mono" />
                            <textarea placeholder="Output example" value={newExOutput} onChange={e=>setNewExOutput(e.target.value)} className="bg-[#131418] border border-[#23252C] rounded-lg p-2 text-xs font-mono" />
                          </div>
                          <button type="submit" className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-xl font-bold">Add Example</button>
                        </form>

                        {testCasesList.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1]">Test Cases Added ({testCasesList.length})</h4>
                            {testCasesList.map((tc, index) => (
                              <div key={tc.id || index} className="p-2.5 bg-[#16171D] border border-[#23252C] rounded-lg flex justify-between items-start gap-3 text-[10px] font-mono">
                                <div>
                                  Test {index + 1}: Input: {tc.input_data} → Expected: {tc.expected_output}
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold ${tc.is_hidden ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    {tc.is_hidden ? "HIDDEN" : "VISIBLE"}
                                  </span>
                                </div>
                                <button type="button" onClick={() => handleDeleteTestCase(tc.id)} className="p-1 bg-red-50 border border-red-100 hover:bg-red-100 text-[#F0555D] rounded shrink-0">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <form onSubmit={handleAddTestCase} className="space-y-4 border border-[#23252C] p-4 rounded-xl">
                          <h4 className="text-xs font-bold flex items-center gap-1"><CheckSquare size={14} /> Add Judge Test Case</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <textarea placeholder="Input data" value={newTcInput} onChange={e=>setNewTcInput(e.target.value)} className="bg-[#131418] border border-[#23252C] rounded-lg p-2 text-xs font-mono" />
                            <textarea placeholder="Expected Output" value={newTcOutput} onChange={e=>setNewTcOutput(e.target.value)} className="bg-[#131418] border border-[#23252C] rounded-lg p-2 text-xs font-mono" />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="create_tc_is_hidden_teacher"
                              checked={newTcHidden}
                              onChange={(e) => setNewTcHidden(e.target.checked)}
                              className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                            />
                            <label htmlFor="create_tc_is_hidden_teacher" className="font-semibold text-xs text-[#C2C6D1]">Hidden Test Case (not shown to students, used for grading only)</label>
                          </div>
                          <button type="submit" className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-xl font-bold">Add Test Case</button>
                        </form>
                      </div>
                    )}

                    <form onSubmit={handleAssignSubmit} className="space-y-4 border border-[#23252C] p-4 rounded-xl">
                      <h4 className="text-xs font-bold flex items-center gap-1"><Calendar size={14} /> Review & Deploy</h4>
                      <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/15 p-3 rounded-xl text-xs space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-[#6E79F4] uppercase block">Deploying To Cohort</span>
                          <span className="font-bold text-[#EDEFF5]">{cohorts.find(c => c.id === selectedCohortId)?.name || "Active Cohort"}</span>
                        </div>
                        {activityType === "programming" ? (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#6E79F4]/15">
                            <div>
                              <span className="text-[10px] font-bold text-[#6E79F4] uppercase block">Available From</span>
                              <span className="font-semibold text-[#EDEFF5]">{availableFrom ? new Date(availableFrom).toLocaleString() : "Immediately"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-[#6E79F4] uppercase block">Due Date</span>
                              <span className="font-semibold text-[#EDEFF5]">{availableUntil ? new Date(availableUntil).toLocaleString() : "No due date"}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#6E79F4]/15">
                            <div>
                              <label className="text-[10px] block font-bold text-[#C2C6D1]">Available From</label>
                              <input type="datetime-local" value={availableFrom} onChange={e=>setAvailableFrom(e.target.value)} className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full" />
                            </div>
                            <div>
                              <label className="text-[10px] block font-bold text-[#C2C6D1]">Due Date</label>
                              <input type="datetime-local" value={availableUntil} onChange={e=>setAvailableUntil(e.target.value)} className="bg-[#131418] border border-[#23252C] px-3 py-1.5 rounded-lg text-xs w-full" />
                            </div>
                          </div>
                        )}
                      </div>
                      <button type="submit" className="w-full bg-[#2FBF71] text-white font-bold text-xs py-2 rounded-xl">
                        Schedule & Deploy Activity
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5.5: PUBLISHED ACTIVITIES */}
          {activeTab === "view_activities" && (
            <div className="animate-fadeIn">
              <LearningManager
                institutions={currentSelectedInst ? [currentSelectedInst] : []}
                mode="view"
                lockInstitution
                scopeLabel={selectedCohort?.name}
              />
            </div>
          )}

          {/* TAB 6: SYLLABUS & CONTENT MANAGER */}
          {activeTab === "syllabus" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm h-fit space-y-4">
                <h3 className="text-xs font-bold text-[#EDEFF5] pb-3 border-b border-[#23252C]">Syllabus Navigator</h3>
                
                <div>
                  <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block mb-1">Select Course</label>
                  <CustomSelect
                    options={filteredCourses.map((c: any) => ({ id: c.id, name: c.title }))}
                    value={syllabusCourseId}
                    onChange={setSyllabusCourseId}
                    placeholder="-- Choose Course --"
                  />
                </div>

                {syllabusCourseId && syllabusLoading && (
                  <div className="py-6 flex items-center justify-center">
                    <SecondaryLoader variant="spinner" message="Loading course syllabus..." className="!border-0 !p-0 shadow-none bg-transparent" />
                  </div>
                )}

                {syllabusCourseId && !syllabusLoading && (
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block">Modules</label>
                      <button 
                        onClick={() => setModuleFormOpen(!moduleFormOpen)}
                        className="text-[10px] font-bold text-[#6E79F4] hover:underline flex items-center gap-1"
                      >
                        <Plus size={10} /> Add Module
                      </button>
                    </div>

                    {moduleFormOpen && (
                      <form onSubmit={handleCreateModule} className="p-3 bg-[#16171D] border rounded-xl space-y-2 text-xs">
                        <input 
                          type="text" 
                          placeholder="Module Title..." 
                          value={newModuleTitle}
                          onChange={e => setNewModuleTitle(e.target.value)}
                          className="bg-[#131418] border px-2 py-1 rounded-lg text-xs w-full"
                          required
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="Pos" 
                            value={newModulePosition}
                            onChange={e => setNewModulePosition(Number(e.target.value))}
                            className="bg-[#131418] border px-2 py-1 rounded-lg text-xs w-20"
                            required
                          />
                          <button type="submit" className="bg-[#6E79F4] text-white px-3 py-1 rounded-lg font-bold text-xs flex-1">
                            Save
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="flex gap-2 items-center">
                      <CustomSelect
                        className="flex-1"
                        options={syllabusModules.map((m: any) => ({ id: m.id, name: `Mod ${m.position}: ${m.title}` }))}
                        value={syllabusModuleId}
                        onChange={(modId) => {
                          setSyllabusModuleId(modId);
                          if (modId) {
                            listLessonsAction(modId).then(res => setSyllabusLessons(res.lessons || []));
                          } else {
                            listLessonsForCourseAction(syllabusCourseId).then(res => setSyllabusLessons(res.lessons || []));
                          }
                          setSyllabusLessonId("");
                        }}
                        placeholder="-- All Course Modules --"
                      />
                      {syllabusModuleId && (
                        <button 
                          onClick={() => handleDeleteModule(syllabusModuleId)}
                          className="p-2 bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20 rounded-xl hover:bg-[#F0555D] hover:text-white transition-all"
                          title="Delete Selected Module"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {syllabusCourseId && !syllabusLoading && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pt-2">
                      <label className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block">Lessons</label>
                      {syllabusModuleId && (
                        <button 
                          onClick={() => setLessonFormOpen(!lessonFormOpen)}
                          className="text-[10px] font-bold text-[#6E79F4] hover:underline flex items-center gap-1"
                        >
                          <Plus size={10} /> Add Lesson
                        </button>
                      )}
                    </div>

                    {lessonFormOpen && (
                      <form onSubmit={handleCreateLesson} className="p-3 bg-[#16171D] border rounded-xl space-y-2 text-xs">
                        <input 
                          type="text" 
                          placeholder="Lesson Title..." 
                          value={newLessonTitle}
                          onChange={e => setNewLessonTitle(e.target.value)}
                          className="bg-[#131418] border px-2 py-1 rounded-lg text-xs w-full"
                          required
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="Pos" 
                            value={newLessonPosition}
                            onChange={e => setNewLessonPosition(Number(e.target.value))}
                            className="bg-[#131418] border px-2 py-1 rounded-lg text-xs w-16"
                            required
                          />
                          <input 
                            type="number" 
                            placeholder="Dur min" 
                            value={newLessonDuration}
                            onChange={e => setNewLessonDuration(Number(e.target.value))}
                            className="bg-[#131418] border px-2 py-1 rounded-lg text-xs w-20"
                            required
                          />
                          <button type="submit" className="bg-[#6E79F4] text-white px-3 py-1 rounded-lg font-bold text-xs flex-1">
                            Save
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {syllabusLessons.length === 0 ? (
                        <p className="text-[11px] text-[#C2C6D1] italic text-center py-2">No lessons in this scope.</p>
                      ) : (
                        syllabusLessons.map(l => (
                          <div key={l.id} className="flex gap-2 items-center w-full">
                            <button
                              onClick={() => setSyllabusLessonId(l.id)}
                              className={`text-left p-2.5 text-xs font-semibold rounded-xl border transition-all flex items-center justify-between flex-1 truncate ${
                                syllabusLessonId === l.id 
                                  ? "bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20" 
                                  : "bg-[#16171D] border-[#23252C] text-[#C2C6D1] hover:bg-[#1A1C22]"
                              }`}
                            >
                              <span className="truncate">{l.title}</span>
                              <ChevronRight size={12} className="shrink-0" />
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(l.id)}
                              className="p-2.5 bg-[#16171D] border border-[#23252C] text-[#F0555D] hover:bg-[#F0555D]/10 hover:border-[#F0555D]/30 rounded-xl transition-all"
                              title="Delete Lesson"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 space-y-6">
                {!syllabusCourseId ? (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-10 text-center text-[#C2C6D1] shadow-sm">
                    <AlertCircle className="mx-auto mb-2 text-[#C2C6D1]/40" size={36} />
                    <p className="text-xs font-bold text-[#EDEFF5]">Select a Course from the navigator tree to view and manage its syllabus.</p>
                  </div>
                ) : syllabusLessonId ? (
                  <>
                    {/* View Mode Toggle Header */}
                    <div className="bg-[#131418] border border-[#23252C] p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSyllabusViewMode("preview")}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            syllabusViewMode === "preview"
                              ? "bg-[#6E79F4]/10 text-[#6E79F4]"
                              : "text-[#C2C6D1] hover:bg-[#16171D]"
                          }`}
                        >
                          <Eye size={14} />
                          Live Preview
                        </button>
                        <button
                          onClick={() => setSyllabusViewMode("edit")}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            syllabusViewMode === "edit"
                              ? "bg-[#6E79F4]/10 text-[#6E79F4]"
                              : "text-[#C2C6D1] hover:bg-[#16171D]"
                          }`}
                        >
                          <Settings size={14} />
                          Edit Details & Resources
                        </button>
                      </div>
                      <span className="text-[10px] text-[#C2C6D1] font-mono uppercase bg-[#1A1C22] px-2 py-0.5 rounded-md font-bold self-start sm:self-auto">
                        Mode: {syllabusViewMode}
                      </span>
                    </div>

                    {syllabusViewMode === "preview" ? (
                      <div className="space-y-6 animate-fadeIn">
                        {/* Live Preview Display Card */}
                        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm space-y-4">
                          <div>
                            <span className="text-[9px] font-bold text-[#6E79F4] uppercase tracking-wider block">LESSON LIVE PREVIEW</span>
                            <h4 className="font-bold text-sm text-[#EDEFF5] mt-0.5">{newLessonTitle || "Untitled Lesson"}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {newLessonTypeId && (
                                <span className="text-[8px] bg-[#6E79F4]/5 text-[#6E79F4] border border-[#6E79F4]/15 px-1.5 py-0.5 rounded font-bold uppercase">
                                  {lessonTypes.find(t => t.id === newLessonTypeId)?.code || "Lesson"}
                                </span>
                              )}
                              {newLessonIsPreview && (
                                <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Free Preview Available
                                </span>
                              )}
                              <span className="text-[9px] text-[#C2C6D1] font-mono flex items-center gap-1">
                                <Clock size={10} /> {newLessonDuration || 0} mins
                              </span>
                              <span className="text-[9px] text-[#C2C6D1] font-mono">
                                Order Position: {newLessonPositionOrder}
                              </span>
                            </div>
                          </div>

                          {/* Render Video Player if URL is present and not a PDF */}
                          {(() => {
                            if (!newLessonVideoUrl) return null;
                            const isPdf = newLessonVideoUrl.toLowerCase().endsWith(".pdf") || 
                                          lessonTypes.find(t => t.id === newLessonTypeId)?.code?.toLowerCase() === "pdf";
                            if (isPdf) return null;

                            const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                            const ytMatch = newLessonVideoUrl.match(ytRegex);
                            const vimeoRegex = /vimeo\.com\/(?:video\/)?([0-9]+)/;
                            const vimeoMatch = newLessonVideoUrl.match(vimeoRegex);

                            if (ytMatch && ytMatch[1]) {
                              return (
                                <div className="bg-black aspect-video rounded-xl overflow-hidden border border-[#23252C] shadow-sm">
                                  <iframe
                                    src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={newLessonTitle}
                                  />
                                </div>
                              );
                            } else if (vimeoMatch && vimeoMatch[1]) {
                              return (
                                <div className="bg-black aspect-video rounded-xl overflow-hidden border border-[#23252C] shadow-sm">
                                  <iframe
                                    src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                                    className="w-full h-full border-0"
                                    allow="autoplay; fullscreen; picture-in-picture"
                                    allowFullScreen
                                    title={newLessonTitle}
                                  />
                                </div>
                              );
                            } else if (newLessonVideoUrl.match(/\.(mp4|webm|ogg)/i)) {
                              return (
                                <div className="bg-black aspect-video rounded-xl overflow-hidden border border-[#23252C] shadow-sm">
                                  <video src={newLessonVideoUrl} className="w-full h-full" controls preload="metadata" />
                                </div>
                              );
                            } else {
                              return (
                                <div className="bg-slate-900 aspect-video rounded-xl flex flex-col items-center justify-center text-white p-6 text-center border border-slate-800 shadow-sm">
                                  <Video size={32} className="text-[#6E79F4] mb-2" />
                                  <p className="text-xs font-semibold mb-2">Video Resource Link</p>
                                  <a
                                    href={newLessonVideoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#6E79F4] hover:bg-[#5A66F0] text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                  >
                                    Open Video Resource <ExternalLink size={10} />
                                  </a>
                                </div>
                              );
                            }
                          })()}

                          {/* Render PDF Reader if Video URL ends with PDF or lesson type is PDF */}
                          {(() => {
                            const isPdf = newLessonVideoUrl.toLowerCase().endsWith(".pdf") || 
                                          lessonTypes.find(t => t.id === newLessonTypeId)?.code?.toLowerCase() === "pdf";
                            
                            const pdfUrl = isPdf ? newLessonVideoUrl : syllabusResources.find(r => 
                              r.resource_type === "pdf" || 
                              r.external_url?.toLowerCase().endsWith(".pdf") ||
                              r.file_url?.toLowerCase().endsWith(".pdf")
                            )?.external_url || syllabusResources.find(r => 
                              r.resource_type === "pdf" || 
                              r.external_url?.toLowerCase().endsWith(".pdf") ||
                              r.file_url?.toLowerCase().endsWith(".pdf")
                            )?.file_url;

                            if (!pdfUrl) return null;

                            return (
                              <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm h-[500px] w-full flex flex-col">
                                <div className="bg-[#16171D] border-b border-[#23252C] px-4 py-2 flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-[#EDEFF5] flex items-center gap-1">
                                    <File size={12} className="text-[#6E79F4]" /> Embedded PDF document viewer
                                  </span>
                                  <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#6E79F4] hover:underline font-bold flex items-center gap-0.5"
                                  >
                                    Open Fullscreen <ExternalLink size={9} />
                                  </a>
                                </div>
                                <iframe src={pdfUrl} className="w-full h-full border-0" title={newLessonTitle} />
                              </div>
                            );
                          })()}

                          {/* Text Content */}
                          {newLessonContentText && (
                            <div className="space-y-1.5 pt-2">
                              <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider block">Structured Content / Text (Markdown)</span>
                              <div className="bg-[#16171D] border border-[#23252C] p-5 rounded-xl">
                                <MarkdownRenderer content={newLessonContentText} />
                              </div>
                            </div>
                          )}

                          {/* Reference Resources */}
                          {syllabusResources.length > 0 && (
                            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 space-y-3 shadow-2xs">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1">
                                <FileText size={12} className="text-[#A3A9B6]" /> Attached Reference Study Materials
                              </p>
                              <div className="divide-y divide-[#23252C] text-xs">
                                {syllabusResources.map(res => {
                                  const downloadUrl = res.external_url || res.file_url;
                                  return (
                                    <div key={res.id} className="py-2 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[#EDEFF5]">{res.title}</span>
                                        <span className="px-1.5 py-0.2 bg-[#1A1C22] rounded text-[8px] text-[#C2C6D1] uppercase font-mono font-bold shrink-0">{res.resource_type || "File"}</span>
                                      </div>
                                      {downloadUrl && (
                                        <a
                                          href={downloadUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[#6E79F4] font-bold flex items-center gap-0.5 hover:underline"
                                        >
                                          Open File <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Assignment / Activity Details */}
                          {(() => {
                            const assocAct = activities.find(a => a.lesson_id === syllabusLessonId);
                            if (!assocAct) return null;

                            return (
                              <div className="border border-[#6E79F4]/15 bg-[#16171D]/50 rounded-xl p-5 space-y-3">
                                <h4 className="font-bold text-xs text-[#EDEFF5] flex items-center gap-1.5 uppercase tracking-wider border-b border-[#23252C] pb-2">
                                  <FolderCode className="text-[#6E79F4]" size={14} /> Associated Activity Specification
                                </h4>
                                <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 text-xs space-y-2.5">
                                  <div>
                                    <span className="text-[9px] bg-[#6E79F4]/5 text-[#6E79F4] border border-[#6E79F4]/15 px-1.5 py-0.5 rounded font-bold uppercase inline-block mb-1.5">
                                      {assocAct.activity_type_code} Activity
                                    </span>
                                    <h5 className="font-bold text-[#EDEFF5] text-[11px]">{assocAct.title}</h5>
                                    {assocAct.description && (
                                      <p className="text-[#C2C6D1] mt-1 whitespace-pre-line leading-relaxed">{assocAct.description}</p>
                                    )}
                                  </div>
                                  {assocAct.instructions && (
                                    <div>
                                      <h5 className="font-bold text-[#EDEFF5] text-[11px] mt-1">Instructions / Requirements</h5>
                                      <p className="text-[#C2C6D1] mt-0.5 whitespace-pre-line leading-relaxed">{assocAct.instructions}</p>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#23252C] text-[10px] text-[#C2C6D1]">
                                    <div>Status: <span className="font-bold text-[#EDEFF5] uppercase">{assocAct.status_code}</span></div>
                                    <div>Max Score: <span className="font-bold text-[#EDEFF5]">{assocAct.max_score || 100} pts</span></div>
                                    <div>Mandatory: <span className="font-bold text-[#EDEFF5]">{assocAct.is_mandatory ? "Yes" : "No"}</span></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-fadeIn">
                        {/* Edit Details Form Panel */}
                        <form onSubmit={handleUpdateLesson} className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-[#EDEFF5] pb-3 border-b border-[#23252C] flex items-center gap-1.5">
                            <Video size={16} className="text-[#6E79F4]" /> Edit Lesson details & settings
                          </h3>

                          <div>
                            <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Lesson Title *</label>
                            <input 
                              type="text" 
                              value={newLessonTitle} 
                              onChange={(e) => setNewLessonTitle(e.target.value)}
                              className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Lesson Type *</label>
                              <CustomSelect
                                options={lessonTypes.map((t: any) => ({ id: t.id, name: t.description || t.code }))}
                                value={newLessonTypeId || defaultLessonTypeId}
                                onChange={setNewLessonTypeId}
                                searchable={false}
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Duration (Minutes)</label>
                              <input 
                                type="number" 
                                value={newLessonDuration} 
                                onChange={(e) => setNewLessonDuration(Number(e.target.value))}
                                className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Position Order Index</label>
                              <input 
                                type="number" 
                                value={newLessonPositionOrder} 
                                onChange={(e) => setNewLessonPositionOrder(Number(e.target.value))}
                                className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                              <input
                                type="checkbox"
                                id="lesson-preview-checkbox"
                                checked={newLessonIsPreview}
                                onChange={(e) => setNewLessonIsPreview(e.target.checked)}
                                className="rounded border-[#23252C] text-[#6E79F4] focus:ring-[#6E79F4]"
                              />
                              <label htmlFor="lesson-preview-checkbox" className="font-semibold text-xs text-[#C2C6D1] select-none cursor-pointer">
                                Available as free preview
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Video Resource / File URL</label>
                            <input 
                              type="url" 
                              value={newLessonVideoUrl} 
                              onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                              placeholder="e.g. YouTube, Vimeo or direct video/PDF file link"
                              className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full font-mono"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[#C2C6D1] uppercase block mb-1">Structured Lesson Content / Text</label>
                            <textarea
                              value={newLessonContentText}
                              onChange={(e) => setNewLessonContentText(e.target.value)}
                              placeholder="Type or paste lesson study text content..."
                              rows={5}
                              className="bg-[#131418] border border-[#23252C] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#6E79F4] w-full resize-y leading-relaxed font-sans"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isPending}
                            className="bg-[#6E79F4] hover:bg-[#5A66F0] disabled:bg-[#2E313A] text-white font-bold text-xs py-2 px-5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Save size={14} />
                            Save Changes
                          </button>
                        </form>

                        {/* Uploads Panel */}
                        <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-[#EDEFF5] pb-3 border-b border-[#23252C] flex items-center gap-1.5">
                            <FileText size={16} className="text-[#6E79F4]" /> Study Materials & PDF Resources
                          </h3>

                          {syllabusResources.length === 0 ? (
                            <p className="text-xs text-[#C2C6D1] text-center py-6 border border-dashed border-[#23252C] rounded-xl">
                              No study materials uploaded for this lesson yet.
                            </p>
                          ) : (
                            <div className="divide-y divide-[#23252C]">
                              {syllabusResources.map(res => (
                                <div key={res.id} className="py-3 flex justify-between items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-[#6E79F4] shrink-0" />
                                    <div>
                                      <span className="font-semibold text-xs text-[#EDEFF5] block">{res.title}</span>
                                      <a 
                                        href={res.external_url || res.file_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[9px] text-[#6E79F4] font-semibold break-all hover:underline"
                                      >
                                        {res.external_url || res.file_url}
                                      </a>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteResource(res.id)}
                                    className="p-1.5 bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20 rounded-lg hover:bg-[#F0555D] hover:text-white transition-all shrink-0"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <form onSubmit={handleAddResource} className="pt-4 border-t border-[#23252C] space-y-3">
                            <h4 className="text-[10px] font-bold text-[#EDEFF5] uppercase tracking-wide">Add Extra Resource Study Material</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[9px] font-bold text-[#C2C6D1] block mb-1">Resource Type</label>
                                <CustomSelect
                                  options={[
                                    { id: "pdf", name: "PDF Document" },
                                    { id: "link", name: "External Resource Link" },
                                    { id: "cheatsheet", name: "Cheatsheet" },
                                  ]}
                                  value={resType}
                                  onChange={setResType}
                                  searchable={false}
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#C2C6D1] block mb-1">Title *</label>
                                <input 
                                  type="text" 
                                  value={resTitle} 
                                  onChange={(e) => setResTitle(e.target.value)}
                                  placeholder="e.g. CheatSheet PDF"
                                  className="bg-[#131418] border border-[#23252C] px-2.5 py-1.5 rounded-lg text-xs w-full"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[#C2C6D1] block mb-1">Resource Link URL *</label>
                              <input 
                                type="url" 
                                value={resExternalUrl} 
                                onChange={(e) => setResExternalUrl(e.target.value)}
                                placeholder="https://drive.google.com/... or https://..."
                                className="bg-[#131418] border border-[#23252C] px-2.5 py-1.5 rounded-lg text-xs w-full font-mono"
                                required
                              />
                            </div>
                            <button 
                              type="submit" 
                              disabled={isPending}
                              className="bg-[#6E79F4] text-white text-xs font-bold py-1.5 px-4 rounded-xl flex items-center gap-1.5"
                            >
                              <Plus size={12} />
                              Add Study Material
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-10 text-center text-[#C2C6D1] shadow-sm">
                    <AlertCircle className="mx-auto mb-2 text-[#C2C6D1]/40" size={36} />
                    <p className="text-xs font-bold text-[#EDEFF5]">Select Course and target Lesson from tree to begin editing content & uploads</p>
                  </div>
                )}
              </div>
            </div>
          )}

            </>
          )}
        </main>
      )}
    </AppShell>

      {/* STUDENT DETAIL SLIDE-OVER DRAWER */}
      {renderStudentDetailDrawer()}

      {/* QUIZ ATTEMPT AUDITOR SLIDE-OVER DRAWER */}
      {renderQuizAuditorDrawer()}

      {/* PROJECT AUDITOR SLIDE-OVER DRAWER */}
      {renderProjectAuditorDrawer()}

      {/* CHALLENGE AUDITOR SLIDE-OVER DRAWER */}
      {renderChallengeAuditorDrawer()}

      {/* ACTIVITY DETAIL SLIDE-OVER DRAWER */}
      {renderActivityConsoleDrawer()}
    </>
  );
}
