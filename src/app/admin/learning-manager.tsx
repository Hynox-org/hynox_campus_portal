"use client";

import React, { useState, useEffect } from "react";
import { 
  listProgramsAction,
  listCoursesAction,
  listModulesAction,
  listLessonsAction,
  listTenantCoursesAction,
  listLessonsForCourseAction
} from "@/app/actions/academic-actions";
import { listCohortsAction } from "@/app/actions/delivery-actions";
import {
  listAllActivitiesAction,
  createActivityAndSubclassAction,
  createQuizQuestionAndOptionsAction,
  createChallengeExampleAction,
  createChallengeTestCaseAction,
  assignActivityToCohortAction,
  getActivityDetailsNoStudentAction,
  listActivityProgressAction,
  updateActivityAndSubclassAction,
  deleteChallengeExampleAction,
  deleteChallengeTestCaseAction
} from "@/app/actions/learning-actions";
import { 
  BookOpen, Plus, Folder, Calendar, Award, CheckCircle, 
  HelpCircle, Trash2, Shield, Eye, Layers, Copy, List, 
  AlertCircle, ChevronRight, X, Sparkles, FileText, CheckCircle2, Clock,
  Edit, Save
} from "lucide-react";

function formatDatetimeLocal(isoString?: string) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset();
    const localTime = new Date(d.getTime() - offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

interface LearningManagerProps {
  institutions: any[];
  mode?: "create" | "view";
}

export default function LearningManager({ institutions, mode = "create" }: LearningManagerProps) {
  const [selectedInstId, setSelectedInstId] = useState("");
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgId, setSelectedProgId] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [allTenantCourses, setAllTenantCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [lessons, setLessons] = useState<any[]>([]);
  const [allCourseLessons, setAllCourseLessons] = useState<any[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [cohorts, setCohorts] = useState<any[]>([]);
  
  // Base Activity list
  const [activities, setActivities] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sidebar details drawer state for viewed activity
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [activityDetails, setActivityDetails] = useState<any | null>(null);
  const [studentProgressList, setStudentProgressList] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"config" | "performance">("config");

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    instructions: string;
    max_score: number;
    passing_score: number;
    is_mandatory: boolean;

    // Quiz fields
    quiz_time_limit: number;
    quiz_max_attempts: number;
    quiz_shuffle_questions: boolean;
    quiz_shuffle_options: boolean;
    quiz_show_results_immediately: boolean;

    // Project fields
    project_overview: string;
    project_requirements: string;
    project_deliverables: string;
    project_submission_instructions: string;
    project_difficulty: string;
    project_estimated_hours: number;

    // Challenge fields
    chal_difficulty: string;
    chal_problem_statement: string;
    chal_input_format: string;
    chal_output_format: string;
    chal_constraints: string;
    chal_starter_code: string;
    chal_time_limit: number;
    chal_memory_limit: number;

    // Assignments list
    assignments: Array<{
      id: string;
      cohort_id: string;
      available_from: string;
      available_until: string;
      is_required: boolean;
    }>;
  }>({
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
    assignments: []
  });

  // Creation forms
  const [activityType, setActivityType] = useState<"quiz" | "project" | "programming">("quiz");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [passingScore, setPassingScore] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);

  // Subclass forms: Quiz
  const [quizTimeLimit, setQuizTimeLimit] = useState(30);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(1);
  const [quizShuffleQ, setQuizShuffleQ] = useState(false);
  const [quizShuffleO, setQuizShuffleO] = useState(false);
  const [quizShowResults, setQuizShowResults] = useState(true);

  // Subclass forms: Project
  const [projOverview, setProjOverview] = useState("");
  const [projRequirements, setProjRequirements] = useState("");
  const [projDeliverables, setProjDeliverables] = useState("");
  const [projDifficulty, setProjDifficulty] = useState("intermediate");
  const [projHours, setProjHours] = useState(10);

  // Subclass forms: Challenge
  const [chalDifficulty, setChalDifficulty] = useState("easy");
  const [chalStatement, setChalStatement] = useState("");
  const [chalInput, setChalInput] = useState("");
  const [chalOutput, setChalOutput] = useState("");
  const [chalConstraints, setChalConstraints] = useState("");
  const [chalStarter, setChalStarter] = useState("");
  const [chalTime, setChalTime] = useState(1000);
  const [chalMemory, setChalMemory] = useState(256);

  // Newly created subclass reference
  const [createdActivityId, setCreatedActivityId] = useState("");
  const [createdQuizId, setCreatedQuizId] = useState("");
  const [createdChallengeId, setCreatedChallengeId] = useState("");

  // Child additions helper: Quiz Questions
  const [quizQuestionsList, setQuizQuestionsList] = useState<any[]>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("single_choice");
  const [newQuestionPoints, setNewQuestionPoints] = useState(10);
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(["", "", "", ""]);
  const [newQuestionCorrectIndices, setNewQuestionCorrectIndices] = useState<number[]>([0]);

  // Child additions helper: Challenge Examples / Test cases
  const [examplesList, setExamplesList] = useState<any[]>([]);
  const [testCasesList, setTestCasesList] = useState<any[]>([]);
  
  const [newExInput, setNewExInput] = useState("");
  const [newExOutput, setNewExOutput] = useState("");
  const [newExExpl, setNewExExpl] = useState("");

  const [newTcInput, setNewTcInput] = useState("");
  const [newTcOutput, setNewTcOutput] = useState("");
  const [newTcHidden, setNewTcHidden] = useState(true);

  // Assignment form
  const [assignCohortId, setAssignCohortId] = useState("");
  const [assignRequired, setAssignRequired] = useState(true);
  const [assignFrom, setAssignFrom] = useState("");
  const [assignUntil, setAssignUntil] = useState("");

  // Load activities
  const loadActivitiesList = async (tenantId: string) => {
    const res = await listAllActivitiesAction(tenantId);
    if (res.activities) setActivities(res.activities);
  };

  // Hierarchy updates
  useEffect(() => {
    if (!selectedInstId) {
      setPrograms([]);
      setCourses([]);
      setAllTenantCourses([]);
      return;
    }
    listProgramsAction(selectedInstId).then(res => setPrograms(res.programs || []));
    listTenantCoursesAction(selectedInstId).then(res => {
      setCourses(res.courses || []);
      setAllTenantCourses(res.courses || []);
    });
    listCohortsAction(selectedInstId).then(res => setCohorts(res.cohorts || []));
    loadActivitiesList(selectedInstId);
  }, [selectedInstId]);

  useEffect(() => {
    if (!selectedProgId) {
      setCourses(allTenantCourses);
      return;
    }
    listCoursesAction(selectedProgId).then(res => setCourses(res.courses || []));
  }, [selectedProgId, allTenantCourses]);

  useEffect(() => {
    if (!selectedCourseId) {
      setModules([]);
      setLessons([]);
      setAllCourseLessons([]);
      return;
    }
    listModulesAction(selectedCourseId).then(res => setModules(res.modules || []));
    listLessonsForCourseAction(selectedCourseId).then(res => {
      setLessons(res.lessons || []);
      setAllCourseLessons(res.lessons || []);
    });
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setLessons(allCourseLessons);
      return;
    }
    listLessonsAction(selectedModuleId).then(res => setLessons(res.lessons || []));
  }, [selectedModuleId, allCourseLessons]);

  const handleCreateActivityBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId) {
      setError("Please navigate to a specific lesson to append this activity.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

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

      // Quiz
      quiz_time_limit: quizTimeLimit,
      quiz_max_attempts: quizMaxAttempts,
      quiz_shuffle_questions: quizShuffleQ,
      quiz_shuffle_options: quizShuffleO,
      quiz_show_results_immediately: quizShowResults,

      // Project
      project_overview: projOverview,
      project_requirements: projRequirements,
      project_deliverables: projDeliverables,
      project_difficulty: projDifficulty,
      project_estimated_hours: projHours,

      // Challenge
      chal_difficulty: chalDifficulty,
      chal_problem_statement: chalStatement,
      chal_input_format: chalInput,
      chal_output_format: chalOutput,
      chal_constraints: chalConstraints,
      chal_starter_code: chalStarter,
      chal_time_limit: chalTime,
      chal_memory_limit: chalMemory
    });

    if (res.error) {
      setError(res.error);
    } else if (res.activity) {
      setSuccess(`Base learning activity "${title}" created successfully!`);
      setCreatedActivityId(res.activity.id);
      
      // Fetch details without student scope if needed
      const details = await getActivityDetailsNoStudentAction(res.activity.id, activityType);
      if (activityType === "quiz" && details.quiz) {
        setCreatedQuizId(details.quiz.id);
      } else if (activityType === "programming" && details.challenge) {
        setCreatedChallengeId(details.challenge.id);
      }

      loadActivitiesList(selectedInstId);
      setTitle("");
      setDescription("");
      setInstructions("");
    }
    setLoading(false);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdQuizId) return;

    setLoading(true);
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
      setSuccess("Question and options appended successfully!");
      setTimeout(() => setSuccess(""), 3000);
      setNewQuestionText("");
      if (newQuestionType === "true_false") {
        setNewQuestionOptions(["True", "False"]);
        setNewQuestionCorrectIndices([0]);
      } else {
        setNewQuestionOptions(["", "", "", ""]);
        setNewQuestionCorrectIndices([0]);
      }
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleAddExample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdChallengeId) return;

    setLoading(true);
    const res = await createChallengeExampleAction({
      challenge_id: createdChallengeId,
      example_number: examplesList.length + 1,
      input_example: newExInput,
      output_example: newExOutput,
      explanation: newExExpl
    });

    if (res.example) {
      setExamplesList(prev => [...prev, res.example]);
      setSuccess("Visible Example added!");
      setNewExInput("");
      setNewExOutput("");
      setNewExExpl("");
    }
    setLoading(false);
  };

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdChallengeId) return;

    setLoading(true);
    const res = await createChallengeTestCaseAction({
      challenge_id: createdChallengeId,
      input_data: newTcInput,
      expected_output: newTcOutput,
      is_hidden: newTcHidden,
      position: testCasesList.length + 1
    });

    if (res.testCase) {
      setTestCasesList(prev => [...prev, res.testCase]);
      setSuccess("Execution Test Case added!");
      setNewTcInput("");
      setNewTcOutput("");
    }
    setLoading(false);
  };

  const handleDeleteExample = async (id: string) => {
    setLoading(true);
    const res = await deleteChallengeExampleAction(id);
    if (res.success) {
      setExamplesList(prev => prev.filter(ex => ex.id !== id));
      setSuccess("Visible Example deleted!");
    } else {
      setError(res.error || "Failed to delete example");
    }
    setLoading(false);
  };

  const handleDeleteTestCase = async (id: string) => {
    setLoading(true);
    const res = await deleteChallengeTestCaseAction(id);
    if (res.success) {
      setTestCasesList(prev => prev.filter(tc => tc.id !== id));
      setSuccess("Test Case deleted!");
    } else {
      setError(res.error || "Failed to delete test case");
    }
    setLoading(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdActivityId || !assignCohortId) {
      setError("Please select a target Cohort for assignment.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    // Client-side date check
    const cohort = cohorts.find(c => c.id === assignCohortId);
    if (cohort) {
      const start = cohort.start_date ? new Date(cohort.start_date) : null;
      const end = cohort.end_date ? new Date(cohort.end_date) : null;

      if (assignFrom) {
        const fromDate = new Date(assignFrom);
        if (start && fromDate < start) {
          setError(`Available From date (${fromDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
        if (end && fromDate > end) {
          setError(`Available From date (${fromDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
      }
      if (assignUntil) {
        const untilDate = new Date(assignUntil);
        if (start && untilDate < start) {
          setError(`Available Until date (${untilDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
        if (end && untilDate > end) {
          setError(`Available Until date (${untilDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
      }
      if (assignFrom && assignUntil) {
        const fromDate = new Date(assignFrom);
        const untilDate = new Date(assignUntil);
        if (fromDate > untilDate) {
          setError("Available From date cannot be after Available Until date.");
          setLoading(false);
          return;
        }
      }
    }

    const res = await assignActivityToCohortAction({
      activity_id: createdActivityId,
      cohort_id: assignCohortId,
      is_required: assignRequired,
      available_from: assignFrom,
      available_until: assignUntil
    });

    if (res.assignment) {
      setSuccess("Activity assigned to cohort successfully!");
      setCreatedActivityId("");
      setCreatedQuizId("");
      setCreatedChallengeId("");
      setQuizQuestionsList([]);
      setExamplesList([]);
      setTestCasesList([]);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    setLoading(true);
    setError("");
    setSuccess("");

    // Validate each assignment date range in the frontend
    if (editForm.assignments && editForm.assignments.length > 0) {
      for (const assign of editForm.assignments) {
        const cohort = cohorts.find(c => c.id === assign.cohort_id);
        if (cohort) {
          const start = cohort.start_date ? new Date(cohort.start_date) : null;
          const end = cohort.end_date ? new Date(cohort.end_date) : null;

          if (assign.available_from) {
            const fromDate = new Date(assign.available_from);
            if (start && fromDate < start) {
              setError(`Assignment start date (${fromDate.toLocaleDateString()}) for cohort "${cohort.name}" cannot be before cohort start date (${start.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
            if (end && fromDate > end) {
              setError(`Assignment start date (${fromDate.toLocaleDateString()}) for cohort "${cohort.name}" cannot be after cohort end date (${end.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
          }
          if (assign.available_until) {
            const untilDate = new Date(assign.available_until);
            if (start && untilDate < start) {
              setError(`Assignment end date (${untilDate.toLocaleDateString()}) for cohort "${cohort.name}" cannot be before cohort start date (${start.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
            if (end && untilDate > end) {
              setError(`Assignment end date (${untilDate.toLocaleDateString()}) for cohort "${cohort.name}" cannot be after cohort end date (${end.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
          }
          if (assign.available_from && assign.available_until) {
            const fromDate = new Date(assign.available_from);
            const untilDate = new Date(assign.available_until);
            if (fromDate > untilDate) {
              setError(`Assignment start date cannot be after end date for cohort "${cohort.name}".`);
              setLoading(false);
              return;
            }
          }
        }
      }
    }

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

      // Assignments
      assignments: editForm.assignments.map(a => ({
        id: a.id,
        cohort_id: a.cohort_id,
        available_from: a.available_from ? new Date(a.available_from).toISOString() : undefined,
        available_until: a.available_until ? new Date(a.available_until).toISOString() : undefined,
        is_required: a.is_required
      }))
    });

    if (res.error) {
      setError(res.error);
    } else if (res.activity) {
      setSuccess("Learning activity updated successfully!");
      await loadActivitiesList(selectedInstId);
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
    setLoading(false);
  };

  // Open sidebar details drawer for selected activity (View Mode)
  const handleViewActivityClick = async (activity: any) => {
    setSelectedActivity(activity);
    setActivityDetails(null);
    setStudentProgressList([]);
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

    // Load student performance progress
    const progRes = await listActivityProgressAction(activity.id);
    if (progRes.progress) {
      setStudentProgressList(progRes.progress);
    }

    setDetailsLoading(false);
  };

  return (
    <div className="space-y-6 text-xs text-[#0F172A] w-full">
      {error && (
        <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 text-xs flex items-start gap-2">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Top Banner Scope */}
      <div className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#475569] flex items-center gap-1.5">
          <Shield size={15} className="text-[#2563EB]" /> Learning Activities Scope
        </h3>
        <p className="text-xs text-[#475569] mb-4">
          Select campus context to list or create learning assignments.
        </p>
        <select
          value={selectedInstId}
          onChange={(e) => {
            setSelectedInstId(e.target.value);
            setSelectedActivity(null);
          }}
          className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
        >
          <option value="">-- Select Institution Campus --</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.institution_code})
            </option>
          ))}
        </select>
      </div>

      {selectedInstId && (
        mode === "create" ? (
          // CREATE MODE VIEW
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Tree Navigation Left */}
            <div className="lg:col-span-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm space-y-4">
              <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2">Academic Navigator</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Learning Program</label>
                  <select
                    value={selectedProgId}
                    onChange={(e) => {
                      setSelectedProgId(e.target.value);
                      setSelectedCourseId("");
                      setSelectedModuleId("");
                      setSelectedLessonId("");
                    }}
                    className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs outline-none text-[#0F172A]"
                  >
                    <option value="">-- Select Program --</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Course *</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedModuleId("");
                      setSelectedLessonId("");
                    }}
                    className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs outline-none text-[#0F172A]"
                    required
                  >
                    <option value="">-- Select Course --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>

                {selectedCourseId && (
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Module (Optional)</label>
                    <select
                      value={selectedModuleId}
                      onChange={(e) => {
                        setSelectedModuleId(e.target.value);
                        setSelectedLessonId("");
                      }}
                      className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs outline-none text-[#0F172A]"
                    >
                      <option value="">-- Select Module --</option>
                      {modules.map(m => <option key={m.id} value={m.id}>Mod {m.position}: {m.title}</option>)}
                    </select>
                  </div>
                )}

                {selectedCourseId && (
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Lesson Target *</label>
                    <select
                      value={selectedLessonId}
                      onChange={(e) => setSelectedLessonId(e.target.value)}
                      className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs outline-none text-[#0F172A]"
                      required
                    >
                      <option value="">-- Select Lesson --</option>
                      {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Builder Panels Right */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Step 1: Base Details Form */}
              {!createdActivityId && (
                <form onSubmit={handleCreateActivityBase} className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm space-y-4">
                  <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2 flex items-center gap-1.5">
                    <Plus size={16} className="text-[#2563EB]" /> Create Lesson Activity
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Activity Type *</label>
                      <select
                        value={activityType}
                        onChange={(e: any) => setActivityType(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="quiz">Quiz Engine Assessment</option>
                        <option value="project">Project Work (GitHub URL)</option>
                        <option value="programming">Programming Challenge (Judge Engine)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. React Router V6 Quiz"
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Max Score</label>
                      <input
                        type="number"
                        value={maxScore}
                        onChange={(e) => setMaxScore(Number(e.target.value))}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Passing Score</label>
                      <input
                        type="number"
                        value={passingScore}
                        onChange={(e) => setPassingScore(Number(e.target.value))}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={(e) => setIsMandatory(e.target.checked)}
                        id="isMandatory"
                        className="rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <label htmlFor="isMandatory" className="font-semibold text-[#475569] cursor-pointer">Mandatory Activity</label>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Description / Overview</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief description of the challenge..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs focus:outline-none focus:border-[#2563EB] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Instructions / Guidelines</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={3}
                      placeholder="Enter guidelines for submission, execution rules, or details here..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs focus:outline-none focus:border-[#2563EB] resize-none"
                    />
                  </div>

                  {/* Subclass-specific fields */}
                  {activityType === "quiz" && (
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Time Limit (Minutes)</label>
                          <input
                            type="number"
                            value={quizTimeLimit}
                            onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Max Attempts Allowed</label>
                          <input
                            type="number"
                            value={quizMaxAttempts}
                            onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizShuffleQ}
                            onChange={(e) => setQuizShuffleQ(e.target.checked)}
                            id="quizShuffleQ"
                            className="rounded border-[#E2E8F0] text-[#2563EB]"
                          />
                          <label htmlFor="quizShuffleQ" className="font-semibold text-[#475569]">Shuffle Questions</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizShuffleO}
                            onChange={(e) => setQuizShuffleO(e.target.checked)}
                            id="quizShuffleO"
                            className="rounded border-[#E2E8F0] text-[#2563EB]"
                          />
                          <label htmlFor="quizShuffleO" className="font-semibold text-[#475569]">Shuffle Options</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizShowResults}
                            onChange={(e) => setQuizShowResults(e.target.checked)}
                            id="quizShowResults"
                            className="rounded border-[#E2E8F0] text-[#2563EB]"
                          />
                          <label htmlFor="quizShowResults" className="font-semibold text-[#475569]">Show Results Immediately</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {activityType === "project" && (
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Project Overview</label>
                        <textarea
                          value={projOverview}
                          onChange={(e) => setProjOverview(e.target.value)}
                          rows={2}
                          placeholder="Netflix Clone with React Hooks..."
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs focus:outline-none focus:border-[#2563EB] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Difficulty Level</label>
                          <select
                            value={projDifficulty}
                            onChange={(e) => setProjDifficulty(e.target.value)}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Estimated Hours</label>
                          <input
                            type="number"
                            value={projHours}
                            onChange={(e) => setProjHours(Number(e.target.value))}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Requirements</label>
                        <textarea
                          value={projRequirements}
                          onChange={(e) => setProjRequirements(e.target.value)}
                          rows={2}
                          placeholder="Must use Redux, TailwindCSS..."
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs focus:outline-none focus:border-[#2563EB] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {activityType === "programming" && (
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Problem Statement</label>
                        <textarea
                          value={chalStatement}
                          onChange={(e) => setChalStatement(e.target.value)}
                          rows={3}
                          placeholder="Given an array of integers..."
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs focus:outline-none focus:border-[#2563EB] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Difficulty</label>
                          <select
                            value={chalDifficulty}
                            onChange={(e) => setChalDifficulty(e.target.value)}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#475569] mb-1">Starter Code Outline</label>
                          <textarea
                            value={chalStarter}
                            onChange={(e) => setChalStarter(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg p-2.5 text-xs font-mono focus:outline-none resize-none"
                            placeholder="function twoSum(nums, target) { }"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2563EB]/95 transition-all text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Registering..." : "Save Learning Activity"}
                  </button>
                </form>
              )}

              {/* Quiz questions configuration step */}
              {createdQuizId && activityType === "quiz" && (
                <div className="space-y-6">
                  <form onSubmit={handleAddQuestion} className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2 flex items-center gap-1.5">
                      <HelpCircle size={16} className="text-[#2563EB]" /> Add Quiz Questions
                    </h4>

                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Question Text</label>
                      <input
                        type="text"
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder="e.g. What is the virtual DOM in React?"
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Question Type</label>
                        <select
                          value={newQuestionType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewQuestionType(val);
                            if (val === "true_false") {
                              setNewQuestionOptions(["True", "False"]);
                              setNewQuestionCorrectIndices([0]);
                            } else {
                              setNewQuestionOptions(["", "", "", ""]);
                              setNewQuestionCorrectIndices([0]);
                            }
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="single_choice">Single Choice</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Points</label>
                        <input
                          type="number"
                          value={newQuestionPoints}
                          onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block font-bold text-[#0F172A]">Answer Options & Correct Key</label>
                      {newQuestionOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type={newQuestionType === "multiple_choice" ? "checkbox" : "radio"}
                            name="correctIndex"
                            checked={newQuestionCorrectIndices.includes(idx)}
                            onChange={() => {
                              if (newQuestionType === "multiple_choice") {
                                if (newQuestionCorrectIndices.includes(idx)) {
                                  setNewQuestionCorrectIndices(newQuestionCorrectIndices.filter(i => i !== idx));
                                } else {
                                  setNewQuestionCorrectIndices([...newQuestionCorrectIndices, idx]);
                                }
                              } else {
                                  setNewQuestionCorrectIndices([idx]);
                              }
                            }}
                            className="accent-[#2563EB]"
                          />
                          <input
                            type="text"
                            value={opt}
                            disabled={newQuestionType === "true_false"}
                            onChange={(e) => {
                              const copy = [...newQuestionOptions];
                              copy[idx] = e.target.value;
                              setNewQuestionOptions(copy);
                            }}
                            placeholder={`Option choice ${idx + 1}`}
                            className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2563EB]/95 transition-all text-xs cursor-pointer"
                    >
                      Add Question to Quiz
                    </button>
                  </form>

                  {quizQuestionsList.length > 0 && (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
                      <h5 className="font-bold text-xs text-[#0F172A]">Added Questions ({quizQuestionsList.length})</h5>
                      <div className="divide-y divide-[#E2E8F0]">
                        {quizQuestionsList.map((q, idx) => (
                          <div key={idx} className="py-2 flex justify-between items-center text-xs text-[#0F172A]">
                            <span>{idx + 1}. {q.question_text}</span>
                            <span className="font-mono text-[9px] text-[#475569]">({q.points} pts)</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setCreatedQuizId("")}
                        className="bg-[#16A34A] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#16A34A]/95 text-xs w-full mt-3 cursor-pointer"
                      >
                        Finished Adding Questions &rarr; Go to Assign Cohort
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Challenge Examples & Test Cases */}
              {createdChallengeId && activityType === "programming" && (
                <div className="space-y-6">
                  <form onSubmit={handleAddExample} className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2 flex items-center gap-1.5">
                      <Eye size={16} className="text-[#2563EB]" /> Add Visible Examples
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Example Input</label>
                        <input
                          type="text"
                          value={newExInput}
                          onChange={(e) => setNewExInput(e.target.value)}
                          placeholder="[2, 7, 11, 15], 9"
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Example Output</label>
                        <input
                          type="text"
                          value={newExOutput}
                          onChange={(e) => setNewExOutput(e.target.value)}
                          placeholder="[0, 1]"
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Explanation</label>
                      <input
                        type="text"
                        value={newExExpl}
                        onChange={(e) => setNewExExpl(e.target.value)}
                        placeholder="Because nums[0] + nums[1] == 9..."
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>

                    <button type="submit" className="bg-[#2563EB] text-white px-4 py-1.5 rounded-lg font-bold cursor-pointer">
                      Add Example
                    </button>
                  </form>

                  <form onSubmit={handleAddTestCase} className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2 flex items-center gap-1.5">
                      <Layers size={16} className="text-[#2563EB]" /> Add Hidden Test Cases
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Test Case Input</label>
                        <input
                          type="text"
                          value={newTcInput}
                          onChange={(e) => setNewTcInput(e.target.value)}
                          placeholder="[3, 2, 4], 6"
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#475569] mb-1">Expected Output</label>
                        <input
                          type="text"
                          value={newTcOutput}
                          onChange={(e) => setNewTcOutput(e.target.value)}
                          placeholder="[1, 2]"
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <button type="submit" className="bg-[#2563EB] text-white px-4 py-1.5 rounded-lg font-bold cursor-pointer">
                      Add Test Case
                    </button>
                  </form>

                  <button
                    onClick={() => setCreatedChallengeId("")}
                    className="bg-[#16A34A] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#16A34A]/95 text-xs w-full cursor-pointer"
                  >
                    Finished Challenge Content &rarr; Go to Assign Cohort
                  </button>
                </div>
              )}

              {/* Assign Activity to Cohorts */}
              {createdActivityId && !createdQuizId && !createdChallengeId && (
                <form onSubmit={handleAssignSubmit} className="bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-sm space-y-4">
                  <h4 className="font-bold text-xs uppercase text-[#0F172A] border-b border-[#E2E8F0] pb-2 flex items-center gap-1.5">
                    <Calendar size={16} className="text-[#2563EB]" /> Assign Activity to Cohort
                  </h4>

                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Target Cohort *</label>
                    <select
                      value={assignCohortId}
                      onChange={(e) => setAssignCohortId(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none"
                      required
                    >
                      <option value="">-- Select Cohort --</option>
                      {cohorts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Available From</label>
                      <input
                        type="datetime-local"
                        value={assignFrom}
                        onChange={(e) => setAssignFrom(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#475569] mb-1">Due Date (Available Until)</label>
                      <input
                        type="datetime-local"
                        value={assignUntil}
                        onChange={(e) => setAssignUntil(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !assignCohortId}
                    className="bg-[#16A34A] text-white px-5 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#16A34A]/95 transition-all text-xs cursor-pointer"
                  >
                    Publish & Assign Activity
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          // VIEW PUBLISHED ACTIVITIES VIEW
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <List size={14} className="text-[#2563EB]" /> Published Learning Activities ({activities.length})
              </h4>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-xs outline-none text-[#0F172A] font-semibold focus:border-[#2563EB]"
              >
                <option value="all">All Activity Types</option>
                <option value="quiz">Quizzes only</option>
                <option value="project">Projects only</option>
                <option value="programming">Coding challenges only</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] font-bold text-[#475569]">
                    <th className="px-4 py-3">Activity Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Max Score</th>
                    <th className="px-4 py-3">Passing Score</th>
                    <th className="px-4 py-3">Mandatory</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {(() => {
                    const filtered = activities.filter(
                      (act) => typeFilter === "all" || act.activity_type_code === typeFilter
                    );
                    if (filtered.length > 0) {
                      return filtered.map((act) => (
                        <tr 
                          key={act.id} 
                          onClick={() => handleViewActivityClick(act)}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 font-semibold text-[#0F172A]">
                            {act.title}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              act.activity_type_code === "quiz" ? "bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/20" :
                              act.activity_type_code === "project" ? "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20" :
                              "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                            }`}>
                              {act.activity_type_code}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[#475569]">{act.max_score}</td>
                          <td className="px-4 py-3.5 font-mono text-[#475569]">{act.passing_score}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              act.is_mandatory ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-100 text-slate-500"
                            }`}>
                              {act.is_mandatory ? "Required" : "Optional"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-[#2563EB] font-bold flex items-center justify-end gap-1">
                            View details <ChevronRight size={12} />
                          </td>
                        </tr>
                      ));
                    }
                    return (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[#475569] italic">
                          No published activities match the selected type filter.
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Activity Details & Student Performance Drawer */}
      {selectedActivity && (
        <>
          {/* Drawer backdrop */}
          <div 
            onClick={() => setSelectedActivity(null)}
            className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#0F172A]">
            
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <Award size={16} className="text-[#2563EB]" /> Activity Console
                </h3>
                <p className="text-[10px] text-[#475569] mt-0.5">{selectedActivity.title}</p>
              </div>
              <button 
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tab navigation inside drawer */}
            <div className="flex border-b border-[#E2E8F0] shrink-0 bg-slate-50/30">
              <button
                onClick={() => setActiveDrawerTab("config")}
                className={`flex-1 py-3 text-center font-bold border-b-2 transition-all ${
                  activeDrawerTab === "config" 
                    ? "border-[#2563EB] text-[#2563EB]" 
                    : "border-transparent text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                Blueprint Config
              </button>
              <button
                onClick={() => setActiveDrawerTab("performance")}
                className={`flex-1 py-3 text-center font-bold border-b-2 transition-all ${
                  activeDrawerTab === "performance" 
                    ? "border-[#2563EB] text-[#2563EB]" 
                    : "border-transparent text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                Student Performance ({studentProgressList.length})
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-2 text-[#475569]">
                  <Clock className="animate-spin" size={24} />
                  <span>Loading details & grades...</span>
                </div>
              ) : activeDrawerTab === "config" ? (
                isEditing ? (
                  <>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#475569] uppercase text-[9px]">Activity Title *</label>
                      <input
                        type="text"
                        required
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#475569] uppercase text-[9px]">Description</label>
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#475569] uppercase text-[9px]">Guidelines & Submission Rules</label>
                      <textarea
                        rows={3}
                        value={editForm.instructions}
                        onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block font-bold text-[#475569] uppercase text-[9px]">Max Score *</label>
                        <input
                          type="number"
                          required
                          value={editForm.max_score}
                          onChange={(e) => setEditForm({ ...editForm, max_score: Number(e.target.value) })}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-[#475569] uppercase text-[9px]">Passing Score *</label>
                        <input
                          type="number"
                          required
                          value={editForm.passing_score}
                          onChange={(e) => setEditForm({ ...editForm, passing_score: Number(e.target.value) })}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="edit_is_mandatory"
                        checked={editForm.is_mandatory}
                        onChange={(e) => setEditForm({ ...editForm, is_mandatory: e.target.checked })}
                        className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                      />
                      <label htmlFor="edit_is_mandatory" className="font-semibold text-xs text-[#0F172A]">Mandatory Required Activity</label>
                    </div>

                    {/* Subclass: Quiz */}
                    {selectedActivity.activity_type_code === "quiz" && (
                      <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569]">Quiz Configuration</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Time Limit (minutes)</label>
                            <input
                              type="number"
                              value={editForm.quiz_time_limit}
                              onChange={(e) => setEditForm({ ...editForm, quiz_time_limit: Number(e.target.value) })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Max Attempts Allowed</label>
                            <input
                              type="number"
                              value={editForm.quiz_max_attempts}
                              onChange={(e) => setEditForm({ ...editForm, quiz_max_attempts: Number(e.target.value) })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_quiz_shuffle_questions"
                              checked={editForm.quiz_shuffle_questions}
                              onChange={(e) => setEditForm({ ...editForm, quiz_shuffle_questions: e.target.checked })}
                              className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                            />
                            <label htmlFor="edit_quiz_shuffle_questions" className="font-semibold text-xs text-[#0F172A]">Shuffle Questions</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_quiz_shuffle_options"
                              checked={editForm.quiz_shuffle_options}
                              onChange={(e) => setEditForm({ ...editForm, quiz_shuffle_options: e.target.checked })}
                              className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                            />
                            <label htmlFor="edit_quiz_shuffle_options" className="font-semibold text-xs text-[#0F172A]">Shuffle Options</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_quiz_show_results"
                              checked={editForm.quiz_show_results_immediately}
                              onChange={(e) => setEditForm({ ...editForm, quiz_show_results_immediately: e.target.checked })}
                              className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                            />
                            <label htmlFor="edit_quiz_show_results" className="font-semibold text-xs text-[#0F172A]">Show Results Immediately</label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Subclass: Project */}
                    {selectedActivity.activity_type_code === "project" && (
                      <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569]">Project Configuration</h4>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Project Overview</label>
                          <textarea
                            rows={3}
                            value={editForm.project_overview}
                            onChange={(e) => setEditForm({ ...editForm, project_overview: e.target.value })}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Requirements</label>
                          <textarea
                            rows={3}
                            value={editForm.project_requirements}
                            onChange={(e) => setEditForm({ ...editForm, project_requirements: e.target.value })}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Deliverables</label>
                          <textarea
                            rows={2}
                            value={editForm.project_deliverables}
                            onChange={(e) => setEditForm({ ...editForm, project_deliverables: e.target.value })}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Difficulty Level</label>
                            <select
                              value={editForm.project_difficulty}
                              onChange={(e) => setEditForm({ ...editForm, project_difficulty: e.target.value })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-semibold"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Estimated Hours</label>
                            <input
                              type="number"
                              value={editForm.project_estimated_hours}
                              onChange={(e) => setEditForm({ ...editForm, project_estimated_hours: Number(e.target.value) })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Subclass: Coding Challenge */}
                    {selectedActivity.activity_type_code === "programming" && (
                      <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569]">Coding Challenge Configuration</h4>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Problem Statement *</label>
                          <textarea
                            rows={4}
                            required
                            value={editForm.chal_problem_statement}
                            onChange={(e) => setEditForm({ ...editForm, chal_problem_statement: e.target.value })}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Input Format</label>
                            <textarea
                              rows={2}
                              value={editForm.chal_input_format}
                              onChange={(e) => setEditForm({ ...editForm, chal_input_format: e.target.value })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Output Format</label>
                            <textarea
                              rows={2}
                              value={editForm.chal_output_format}
                              onChange={(e) => setEditForm({ ...editForm, chal_output_format: e.target.value })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Constraints</label>
                          <textarea
                            rows={2}
                            value={editForm.chal_constraints}
                            onChange={(e) => setEditForm({ ...editForm, chal_constraints: e.target.value })}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#475569] uppercase text-[9px]">Starter Code</label>
                          <textarea
                            rows={5}
                            value={editForm.chal_starter_code}
                            onChange={(e) => setEditForm({ ...editForm, chal_starter_code: e.target.value })}
                            className="w-full bg-slate-900 text-slate-100 border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Difficulty</label>
                            <select
                              value={editForm.chal_difficulty}
                              onChange={(e) => setEditForm({ ...editForm, chal_difficulty: e.target.value })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-semibold"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Time Limit (ms)</label>
                            <input
                              type="number"
                              value={editForm.chal_time_limit}
                              onChange={(e) => setEditForm({ ...editForm, chal_time_limit: Number(e.target.value) })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#475569] uppercase text-[9px]">Memory Limit (MB)</label>
                            <input
                              type="number"
                              value={editForm.chal_memory_limit}
                              onChange={(e) => setEditForm({ ...editForm, chal_memory_limit: Number(e.target.value) })}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cohort Schedule / Allocation Updates */}
                    {editForm.assignments && editForm.assignments.length > 0 && (
                      <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569] flex items-center gap-1">
                          <Calendar size={14} className="text-[#2563EB]" /> Cohort Scheduling Allocations
                        </h4>
                        <div className="space-y-4">
                          {editForm.assignments.map((assign, index) => {
                            const cohort = cohorts.find(c => c.id === assign.cohort_id);
                            return (
                              <div key={assign.id} className="bg-slate-50 border border-[#E2E8F0] p-3 rounded-lg space-y-3">
                                <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                                  <span className="font-bold text-xs text-[#0F172A]">
                                    Cohort: {cohort ? cohort.name : "Unknown Cohort"}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      id={`required_${assign.id}`}
                                      checked={assign.is_required}
                                      onChange={(e) => {
                                        const updated = [...editForm.assignments];
                                        updated[index] = { ...updated[index], is_required: e.target.checked };
                                        setEditForm({ ...editForm, assignments: updated });
                                      }}
                                      className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                                    />
                                    <label htmlFor={`required_${assign.id}`} className="font-semibold text-[10px] text-[#475569]">Required</label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block font-semibold text-[#475569] text-[9px] uppercase">Available From</label>
                                    <input
                                      type="datetime-local"
                                      value={assign.available_from}
                                      onChange={(e) => {
                                        const updated = [...editForm.assignments];
                                        updated[index] = { ...updated[index], available_from: e.target.value };
                                        setEditForm({ ...editForm, assignments: updated });
                                      }}
                                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#2563EB] shadow-sm font-semibold"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block font-semibold text-[#475569] text-[9px] uppercase">Available Until</label>
                                    <input
                                      type="datetime-local"
                                      value={assign.available_until}
                                      onChange={(e) => {
                                        const updated = [...editForm.assignments];
                                        updated[index] = { ...updated[index], available_until: e.target.value };
                                        setEditForm({ ...editForm, assignments: updated });
                                      }}
                                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#2563EB] shadow-sm font-semibold"
                                    />
                                  </div>
                                </div>
                                {cohort && (cohort.start_date || cohort.end_date) && (
                                  <div className="text-[9px] text-[#86868b] flex gap-2">
                                    {cohort.start_date && <span>Start: {new Date(cohort.start_date).toLocaleDateString()}</span>}
                                    {cohort.end_date && <span>End: {new Date(cohort.end_date).toLocaleDateString()}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button type="submit" id="edit-activity-form-submit" className="hidden" />
                  </form>

                  {selectedActivity.activity_type_code === "programming" && (
                    <div className="border-t border-[#E2E8F0] pt-4 mt-6 space-y-6">
                      {/* Examples Section */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                          <Eye size={14} className="text-[#2563EB]" /> Modify Examples ({examplesList.length})
                        </h4>
                        {examplesList.length > 0 && (
                          <div className="space-y-2">
                            {examplesList.map((ex, index) => (
                              <div key={ex.id || index} className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl flex justify-between items-start gap-4">
                                <div className="font-mono text-[10px] space-y-1">
                                  <div><span className="text-[#86868b] font-semibold">Ex {ex.example_number}:</span> Input: {ex.input_example}</div>
                                  <div><span className="text-[#86868b] font-semibold">Output:</span> {ex.output_example}</div>
                                  {ex.explanation && <div><span className="text-[#86868b] font-semibold">Exp:</span> {ex.explanation}</div>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExample(ex.id)}
                                  className="p-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-[#DC2626] rounded-lg transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="bg-slate-50/50 p-4 border border-[#E2E8F0] rounded-xl space-y-3">
                          <span className="font-bold text-[9px] uppercase text-[#475569] tracking-wider block">Add New Example</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Input Example"
                              value={newExInput}
                              onChange={(e) => setNewExInput(e.target.value)}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Output Example"
                              value={newExOutput}
                              onChange={(e) => setNewExOutput(e.target.value)}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Explanation"
                            value={newExExpl}
                            onChange={(e) => setNewExExpl(e.target.value)}
                            className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddExample}
                            className="bg-[#2563EB] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                          >
                            Add Example
                          </button>
                        </div>
                      </div>

                      {/* Test Cases Section */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                          <Layers size={14} className="text-[#2563EB]" /> Modify Test Cases ({testCasesList.length})
                        </h4>
                        {testCasesList.length > 0 && (
                          <div className="space-y-2">
                            {testCasesList.map((tc, index) => (
                              <div key={tc.id || index} className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl flex justify-between items-start gap-4">
                                <div className="font-mono text-[10px] space-y-1">
                                  <div><span className="text-[#86868b] font-semibold">Test {index + 1}:</span> Input: {tc.input_data}</div>
                                  <div><span className="text-[#86868b] font-semibold">Expected:</span> {tc.expected_output}</div>
                                  <div><span className="text-[#86868b] font-semibold">Hidden:</span> {tc.is_hidden ? "Yes" : "No"}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTestCase(tc.id)}
                                  className="p-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-[#DC2626] rounded-lg transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="bg-slate-50/50 p-4 border border-[#E2E8F0] rounded-xl space-y-3">
                          <span className="font-bold text-[9px] uppercase text-[#475569] tracking-wider block">Add New Test Case</span>
                          <div className="grid grid-cols-2 gap-2">
                            <textarea
                              placeholder="Input Data"
                              value={newTcInput}
                              onChange={(e) => setNewTcInput(e.target.value)}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                            />
                            <textarea
                              placeholder="Expected Output"
                              value={newTcOutput}
                              onChange={(e) => setNewTcOutput(e.target.value)}
                              className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_tc_is_hidden"
                              checked={newTcHidden}
                              onChange={(e) => setNewTcHidden(e.target.checked)}
                              className="rounded text-[#2563EB] focus:ring-[#2563EB] border-[#E2E8F0]"
                            />
                            <label htmlFor="edit_tc_is_hidden" className="font-semibold text-xs text-[#475569]">Hidden Test Case</label>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddTestCase}
                            className="bg-[#2563EB] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                          >
                            Add Test Case
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  // TAB 1: BLUEPRINT CONFIG DETAILS (PREVIEW MODE)
                  <div className="space-y-5">
                    <div className="bg-slate-50 border border-[#E2E8F0] p-4 rounded-xl space-y-3.5">
                      <h4 className="font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5 text-xs">General Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-[#475569] block">Max Score</span>
                          <strong className="text-xs font-mono text-[#0F172A]">{selectedActivity.max_score} Points</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#475569] block">Passing Threshold</span>
                          <strong className="text-xs font-mono text-[#0F172A]">{selectedActivity.passing_score} Points</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#475569] block">Mandatory Required</span>
                          <strong className="text-xs text-[#0F172A]">{selectedActivity.is_mandatory ? "Yes" : "No (Optional)"}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#475569] block">Activity Engine</span>
                          <strong className="text-xs uppercase text-[#0F172A]">{selectedActivity.activity_type_code}</strong>
                        </div>
                      </div>
                    </div>

                    {selectedActivity.description && (
                      <div className="space-y-1">
                        <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Description</span>
                        <p className="bg-slate-50/50 p-2.5 border border-[#E2E8F0] rounded-lg text-[#0F172A] leading-relaxed">
                          {selectedActivity.description}
                        </p>
                      </div>
                    )}

                    {selectedActivity.instructions && (
                      <div className="space-y-1">
                        <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Guidelines & Submission Rules</span>
                        <p className="bg-slate-50/50 p-2.5 border border-[#E2E8F0] rounded-lg text-[#0F172A] font-mono leading-relaxed whitespace-pre-wrap">
                          {selectedActivity.instructions}
                        </p>
                      </div>
                    )}

                    {/* Subclass quiz questions */}
                    {selectedActivity.activity_type_code === "quiz" && activityDetails?.questions && (
                      <div className="space-y-3.5 pt-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#475569] border-b border-[#E2E8F0] pb-1">
                          Quiz Syllabus Questions ({activityDetails.questions.length})
                        </h4>
                        <div className="space-y-3">
                          {activityDetails.questions.map((q: any, idx: number) => (
                            <div key={q.id} className="border border-[#E2E8F0] p-3 rounded-lg bg-white space-y-2">
                              <div className="flex justify-between items-start font-semibold text-[#0F172A]">
                                <span>Q{idx + 1}: {q.question_text}</span>
                                <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0 font-normal text-[#475569]">
                                  {q.points} pts
                                </span>
                              </div>
                              <div className="pl-2.5 border-l-2 border-slate-100 space-y-1">
                                {q.options?.map((opt: any) => (
                                  <div key={opt.id} className="flex items-center gap-1.5 text-[11px]">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.is_correct ? "bg-[#16A34A]" : "bg-slate-300"}`} />
                                    <span className={opt.is_correct ? "text-[#16A34A] font-medium" : "text-[#475569]"}>{opt.option_text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subclass programming challenge details */}
                    {selectedActivity.activity_type_code === "programming" && activityDetails?.challenge && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                          <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Problem Statement</span>
                          <p className="bg-slate-50/50 p-2.5 border border-[#E2E8F0] rounded-lg text-[#0F172A] font-mono leading-relaxed whitespace-pre-wrap">
                            {activityDetails.challenge.problem_statement}
                          </p>
                        </div>

                        {activityDetails.challenge.starter_code && (
                          <div className="space-y-1">
                            <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Starter Template Outline</span>
                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed">
                              {activityDetails.challenge.starter_code}
                            </pre>
                          </div>
                        )}

                        {activityDetails.examples && activityDetails.examples.length > 0 && (
                          <div className="space-y-2">
                            <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Visible Examples</span>
                            {activityDetails.examples.map((ex: any) => (
                              <div key={ex.id} className="border border-[#E2E8F0] rounded-lg p-2.5 bg-slate-50/30 font-mono text-[10px] space-y-1">
                                <div><span className="text-[#86868b]">Input:</span> {ex.input_example}</div>
                                <div><span className="text-[#86868b]">Output:</span> {ex.output_example}</div>
                                {ex.explanation && <div><span className="text-[#86868b]">Explanation:</span> {ex.explanation}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Subclass project details */}
                    {selectedActivity.activity_type_code === "project" && activityDetails?.project && (
                      <div className="space-y-4 pt-2">
                        {activityDetails.project.project_overview && (
                          <div className="space-y-1">
                            <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Project Overview</span>
                            <p className="bg-slate-50/50 p-2.5 border border-[#E2E8F0] rounded-lg text-[#0F172A] leading-relaxed">
                              {activityDetails.project.project_overview}
                            </p>
                          </div>
                        )}

                        {activityDetails.project.requirements && (
                          <div className="space-y-1">
                            <span className="font-bold text-[#475569] uppercase text-[9px] tracking-wider block">Requirements</span>
                            <p className="bg-slate-50/50 p-2.5 border border-[#E2E8F0] rounded-lg text-[#0F172A] whitespace-pre-wrap leading-relaxed">
                              {activityDetails.project.requirements}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                // TAB 2: STUDENT PERFORMANCE / GRADES
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                    <span className="font-bold text-xs uppercase text-[#475569] tracking-wider">Candidate Grades Status</span>
                    <span className="font-mono text-[10px] text-[#86868b]">{studentProgressList.length} Active Records</span>
                  </div>

                  <div className="space-y-2">
                    {studentProgressList.length > 0 ? (
                      studentProgressList.map((prog: any) => (
                        <div key={prog.id} className="border border-[#E2E8F0] rounded-xl p-3 bg-white hover:bg-slate-50/40 transition-colors flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-[#0F172A] block truncate">
                              {prog.student?.full_name || "Unknown Candidate"}
                            </span>
                            <span className="text-[10px] text-[#475569] block truncate">
                              {prog.student?.email || "No email"}
                            </span>
                            <span className="text-[9px] text-[#86868b] block font-mono mt-1">
                              Updated: {new Date(prog.updated_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              prog.status_code === "completed" ? "bg-[#16A34A]/10 text-[#16A34A]" :
                              prog.status_code === "failed" ? "bg-red-50 text-red-600" :
                              "bg-amber-50 text-amber-600"
                            }`}>
                              {prog.status_code}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#0F172A]">
                              Score: {prog.score ?? 0} / {selectedActivity.max_score}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 border border-dashed border-[#E2E8F0] rounded-xl text-slate-400">
                        <AlertCircle className="mx-auto mb-1 text-slate-300" size={20} />
                        <p className="text-[11px] italic">No submission attempts recorded yet for this activity.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions footer inside drawer */}
            <div className="bg-slate-50 border-t border-[#E2E8F0] p-5 flex justify-between shrink-0">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="border border-[#E2E8F0] hover:bg-slate-100 text-[#475569] px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const btn = document.getElementById("edit-activity-form-submit");
                      if (btn) btn.click();
                    }}
                    className="bg-[#2563EB] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#2563EB]/90 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save size={14} /> Save Changes
                  </button>
                </>
              ) : (
                <>
                  {activeDrawerTab === "config" ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="border border-[#E2E8F0] hover:bg-slate-100 text-[#2563EB] px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit size={14} /> Edit Blueprint
                    </button>
                  ) : (
                    <div />
                  )}
                  <button 
                    onClick={() => setSelectedActivity(null)}
                    className="bg-[#0F172A] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#0F172A]/90 cursor-pointer"
                  >
                    Close Console
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
