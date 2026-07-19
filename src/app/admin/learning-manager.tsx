"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DASHBOARD_GC_TIME, DASHBOARD_REFETCH_INTERVAL, DASHBOARD_STALE_TIME, seedAcademicListCaches, unwrapActionResult } from "@/lib/dashboard-query";
import { getInstitutionPrefetchDataAction, getDeliveryPrefetchDataAction } from "@/app/actions/prefetch-actions";
import { 
  listProgramsAction,
  listCoursesAction,
  listModulesAction,
  listLessonsAction,
  listTenantCoursesAction,
  listLessonsForCourseAction,
  createModuleAction,
  createLessonAction
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
  deleteChallengeTestCaseAction,
  deleteActivityAction,
  deleteQuizQuestionAction,
  updateQuizQuestionAndOptionsAction
} from "@/app/actions/learning-actions";
import { 
  BookOpen, Plus, Folder, Calendar, Award, CheckCircle, 
  HelpCircle, Trash2, Shield, Eye, Layers, Copy, List, 
  AlertCircle, ChevronRight, X, Sparkles, FileText, CheckCircle2, Clock,
  Edit, Save
} from "lucide-react";
import { SecondaryLoader } from "@/components/secondary-loader";
import ChallengeEditor from "@/app/teacher/challenge-editor";
import { CustomSelect } from "@/components/custom-select";
import { useToast } from "@/components/toast";

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
  /** When true (teacher view), the institution is derived from the teacher's own cohort
   * assignments instead of being picked from a dropdown like a super admin would. */
  lockInstitution?: boolean;
  /** Label describing the teacher's active cohort/group, shown in the scope sidebar. */
  scopeLabel?: string;
}

export default function LearningManager({ institutions, mode = "create", lockInstitution = false, scopeLabel }: LearningManagerProps) {
  const queryClient = useQueryClient();
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
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  // Sidebar details drawer state for viewed activity
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [activityDetails, setActivityDetails] = useState<any | null>(null);
  const [studentProgressList, setStudentProgressList] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"config" | "performance">("config");

  // Scroll lock when any sidebar drawer is open to prevent background viewport scrolling
  useEffect(() => {
    const isOpen = !!selectedActivity;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedActivity]);

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
    quiz_strict_mode: boolean;

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
    chal_strict_mode: boolean;

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
  const [quizStrictMode, setQuizStrictMode] = useState(false);

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
  const [chalTime, setChalTime] = useState(1000);
  const [chalMemory, setChalMemory] = useState(256);
  const [chalStrictMode, setChalStrictMode] = useState(false);

  // Newly created subclass reference
  const [createdActivityId, setCreatedActivityId] = useState("");
  const [createdQuizId, setCreatedQuizId] = useState("");
  const [createdChallengeId, setCreatedChallengeId] = useState("");
  const [baseDetailsSaved, setBaseDetailsSaved] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  // Child additions helper: Quiz Questions
  const [quizQuestionsList, setQuizQuestionsList] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
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

  // React Query prefetch for academic & delivery data per institution
  const { data: instAcademicData, isLoading: loadingAcademic } = useQuery({
    queryKey: ["academic-prefetch", selectedInstId],
    queryFn: async () => unwrapActionResult(await getInstitutionPrefetchDataAction(selectedInstId)),
    enabled: !!selectedInstId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
  const { data: instDeliveryData, isLoading: loadingDelivery } = useQuery({
    queryKey: ["delivery-prefetch", selectedInstId],
    queryFn: async () => unwrapActionResult(await getDeliveryPrefetchDataAction(selectedInstId)),
    enabled: !!selectedInstId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
  const { data: instActivitiesData, isLoading: loadingActivities } = useQuery({
    queryKey: ["all-activities", selectedInstId],
    queryFn: async () => {
      const res = await listAllActivitiesAction(selectedInstId);
      return res.activities || [];
    },
    enabled: !!selectedInstId,
    staleTime: 5 * 60 * 1000,
  });

  const isDataLoading = loadingAcademic || loadingDelivery || loadingActivities;

  // Teacher view: institution is derived from their own cohort assignments, not chosen manually.
  useEffect(() => {
    if (lockInstitution && !selectedInstId && institutions.length > 0) {
      setSelectedInstId(institutions[0].id);
    }
  }, [lockInstitution, institutions, selectedInstId]);

  // Sync state from React Query data
  useEffect(() => {
    if (instAcademicData?.success) {
      const allPrograms = instAcademicData.programs || [];
      const allCourses = instAcademicData.courses || [];
      setPrograms(allPrograms);
      setCourses(allCourses);
      setAllTenantCourses(allCourses);
      // Only seed list keys with an identical data contract. The module query
      // is deliberately deeper (modules + lessons + resources).
      seedAcademicListCaches(queryClient, selectedInstId, instAcademicData);
    }
  }, [instAcademicData, queryClient, selectedInstId]);

  useEffect(() => {
    if (instDeliveryData?.success) {
      setCohorts(instDeliveryData.cohorts || []);
    }
  }, [instDeliveryData]);

  useEffect(() => {
    if (instActivitiesData) {
      setActivities(instActivitiesData);
    }
  }, [instActivitiesData]);

  // Hierarchy updates - only for program/course level navigation
  useEffect(() => {
    if (!selectedProgId) {
      setCourses(allTenantCourses);
      return;
    }
    listCoursesAction(selectedProgId).then(res => setCourses(res.courses || []));
  }, [selectedProgId, allTenantCourses]);

  const handleCourseSelection = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedModuleId("");
    setSelectedLessonId("");
    if (!courseId) return;

    setLoading(true);
    try {
      const res = await listLessonsForCourseAction(courseId);
      const courseLessons = res.lessons || [];
      if (courseLessons.length > 0) {
        setSelectedLessonId(courseLessons[0].id);
      } else {
        // Look up modules
        const modRes = await listModulesAction(courseId);
        let moduleId = "";
        if (modRes.modules && modRes.modules.length > 0) {
          moduleId = modRes.modules[0].id;
        } else {
          // Create default module
          const newMod = await createModuleAction({
            course_id: courseId,
            title: "Default Module",
            description: "Auto-generated module for activity placement",
            position: 1,
            tenant_id: selectedInstId,
            institution_id: selectedInstId
          });
          if (newMod.module) {
            moduleId = newMod.module.id;
          } else if (newMod.error) {
            throw new Error(newMod.error);
          }
        }

        if (moduleId) {
          // Create default lesson
          const newLes = await createLessonAction({
            module_id: moduleId,
            title: "Default Lesson",
            position: 1,
            tenant_id: selectedInstId,
            institution_id: selectedInstId
          });
          if (newLes.lesson) {
            setSelectedLessonId(newLes.lesson.id);
          } else if (newLes.error) {
            throw new Error(newLes.error);
          }
        } else {
          throw new Error("Could not find or create a module for this course.");
        }
      }
    } catch (err: any) {
      console.error("Error setting up default lesson:", err);
      showError("Failed to initialize course module/lesson: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivityBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId) {
      showError("Please navigate to a specific lesson or select a valid Course to append this activity.");
      return;
    }

    if (!title.trim()) {
      showError("Activity title is required.");
      return;
    }

    if (passingScore < 0 || maxScore <= 0) {
      showError("Scores must be positive numbers.");
      return;
    }

    if (passingScore > maxScore) {
      showError("Passing score cannot be greater than the maximum score.");
      return;
    }

    if (!assignCohortId) {
      showError("Please select a Target Group in the Academic Navigator.");
      return;
    }

    setBaseDetailsSaved(true);

    if (activityType === "quiz") {
      setCreatedQuizId("temp-quiz");
    } else {
      setReviewMode(true);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdQuizId) return;

    if (!newQuestionText.trim()) {
      showError("Question text cannot be empty.");
      return;
    }

    const optionsPayload = newQuestionOptions.filter(o => o.trim()).map((o, idx) => ({
      optionText: o,
      isCorrect: newQuestionCorrectIndices.includes(idx),
      position: idx + 1
    }));

    if (newQuestionType !== "short_answer" && optionsPayload.length < 2) {
      showError("Please provide at least 2 non-empty options.");
      return;
    }

    const hasCorrectOption = optionsPayload.some(o => o.isCorrect);
    if (newQuestionType !== "short_answer" && !hasCorrectOption) {
      showError("Please select at least one correct option.");
      return;
    }

    if (newQuestionType === "single_choice" && optionsPayload.filter(o => o.isCorrect).length > 1) {
      showError("Single choice questions can only have one correct option.");
      return;
    }


    if (createdQuizId === "temp-quiz") {
      if (editingQuestion) {
        // Edit question in local array
        const updatedQ = {
          id: editingQuestion.id,
          question_text: newQuestionText,
          question_type: newQuestionType,
          points: newQuestionPoints,
          options: optionsPayload.map((opt, i) => ({
            id: opt.optionText + i,
            option_text: opt.optionText,
            is_correct: opt.isCorrect,
            position: opt.position
          }))
        };
        setQuizQuestionsList((prev: any[]) => prev.map(q => q.id === editingQuestion.id ? updatedQ : q));
        showSuccess("Question updated locally!");
        setEditingQuestion(null);
      } else {
        // Add new question locally
        const newQ = {
          id: "local-" + Date.now(),
          question_text: newQuestionText,
          question_type: newQuestionType,
          points: newQuestionPoints,
          options: optionsPayload.map((opt, i) => ({
            id: opt.optionText + i,
            option_text: opt.optionText,
            is_correct: opt.isCorrect,
            position: opt.position
          }))
        };
        setQuizQuestionsList((prev: any[]) => [...prev, newQ]);
        showSuccess("Question added locally!");
      }
      setNewQuestionText("");
      if (newQuestionType === "true_false") {
        setNewQuestionOptions(["True", "False"]);
        setNewQuestionCorrectIndices([0]);
      } else {
        setNewQuestionOptions(["", "", "", ""]);
        setNewQuestionCorrectIndices([0]);
      }
    } else {
      setLoading(true);
      if (editingQuestion) {
        const res = await updateQuizQuestionAndOptionsAction(
          editingQuestion.id,
          newQuestionText,
          newQuestionType,
          newQuestionPoints,
          optionsPayload
        );

        if (res.question) {
          setQuizQuestionsList((prev: any[]) => prev.map(q => q.id === editingQuestion.id ? res.question : q));
          
          if (activityDetails && activityDetails.questions) {
            setActivityDetails((prev: any) => ({
              ...prev,
              questions: prev.questions.map((q: any) => q.id === editingQuestion.id ? res.question : q)
            }));
          }

          showSuccess("Question updated successfully!");
          setEditingQuestion(null);
          setNewQuestionText("");
          if (newQuestionType === "true_false") {
            setNewQuestionOptions(["True", "False"]);
            setNewQuestionCorrectIndices([0]);
          } else {
            setNewQuestionOptions(["", "", "", ""]);
            setNewQuestionCorrectIndices([0]);
          }
        } else if (res.error) {
          showError(res.error);
        }
      } else {
        const res = await createQuizQuestionAndOptionsAction(
          createdQuizId,
          newQuestionText,
          newQuestionType,
          newQuestionPoints,
          quizQuestionsList.length + 1,
          optionsPayload
        );

        if (res.question) {
          setQuizQuestionsList((prev: any[]) => [...prev, res.question]);
          
          if (activityDetails && activityDetails.questions) {
            setActivityDetails((prev: any) => ({
              ...prev,
              questions: [...(prev.questions || []), res.question]
            }));
          }

          showSuccess("Question and options appended successfully!");
          setNewQuestionText("");
          if (newQuestionType === "true_false") {
            setNewQuestionOptions(["True", "False"]);
            setNewQuestionCorrectIndices([0]);
          } else {
            setNewQuestionOptions(["", "", "", ""]);
            setNewQuestionCorrectIndices([0]);
          }
        } else if (res.error) {
          showError(res.error);
        }
      }
    }
    setLoading(false);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    if (createdQuizId === "temp-quiz") {
      setQuizQuestionsList((prev: any[]) => prev.filter(q => q.id !== questionId));
      showSuccess("Question deleted locally!");
      return;
    }

    setLoading(true);
    const res = await deleteQuizQuestionAction(questionId);
    if (res.success) {
      setQuizQuestionsList((prev: any[]) => prev.filter(q => q.id !== questionId));
      if (activityDetails && activityDetails.questions) {
        setActivityDetails((prev: any) => ({
          ...prev,
          questions: prev.questions.filter((q: any) => q.id !== questionId)
        }));
      }
      showSuccess("Question deleted successfully!");
    } else {
      showError(res.error || "Failed to delete question.");
    }
    setLoading(false);
  };

  const handleStartEditQuestion = (q: any) => {
    setEditingQuestion(q);
    setNewQuestionText(q.question_text);
    setNewQuestionType(q.question_type);
    setNewQuestionPoints(Number(q.points));
    if (q.options) {
      setNewQuestionOptions(q.options.map((o: any) => o.option_text));
      const indices: number[] = [];
      q.options.forEach((o: any, idx: number) => {
        if (o.is_correct) indices.push(idx);
      });
      setNewQuestionCorrectIndices(indices);
    } else {
      setNewQuestionOptions(["", "", "", ""]);
      setNewQuestionCorrectIndices([0]);
    }
  };

  const handleConfirmPublish = async () => {
    if (activityType === "quiz" && quizStrictMode && !quizTimeLimit) {
      showError("Strict/Proctored Mode requires a time limit to be set.");
      return;
    }

    setLoading(true);

    try {
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
        quiz_show_results_immediately: true,
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
        chal_time_limit: chalTime,
        chal_memory_limit: chalMemory,
        chal_strict_mode: chalStrictMode
      });

      if (res.error) {
        throw new Error(res.error);
      }

      const createdActivity = res.activity;
      if (!createdActivity) {
        throw new Error("Failed to instantiate learning activity.");
      }

      if (activityType === "quiz") {
        const details = await getActivityDetailsNoStudentAction(createdActivity.id, "quiz");
        if (details.error || !details.quiz) {
          throw new Error(details.error || "Quiz details record not found.");
        }
        
        const dbQuizId = details.quiz.id;
        for (let i = 0; i < quizQuestionsList.length; i++) {
          const q = quizQuestionsList[i];
          const optionsPayload = q.options.map((opt: any, idx: number) => ({
            optionText: opt.option_text,
            isCorrect: opt.is_correct,
            position: idx + 1
          }));

          const qRes = await createQuizQuestionAndOptionsAction(
            dbQuizId,
            q.question_text,
            q.question_type,
            q.points,
            i + 1,
            optionsPayload
          );

          if (qRes.error) {
            throw new Error(`Failed to insert question "${q.question_text}": ${qRes.error}`);
          }
        }
      }

      const assignRes = await assignActivityToCohortAction({
        activity_id: createdActivity.id,
        cohort_id: assignCohortId,
        is_required: assignRequired,
        available_from: assignFrom || null,
        available_until: assignUntil || null
      });

      if (assignRes.error) {
        throw new Error(`Failed assigning to group: ${assignRes.error}`);
      }

      showSuccess(`Learning activity "${title}" successfully published & assigned!`);
      queryClient.invalidateQueries({ queryKey: ["all-activities", selectedInstId] });

      setTitle("");
      setDescription("");
      setInstructions("");
      setMaxScore(100);
      setPassingScore(0);
      setIsMandatory(true);
      setQuizTimeLimit(30);
      setQuizMaxAttempts(1);
      setQuizShuffleQ(false);
      setQuizShuffleO(false);
      setProjOverview("");
      setProjRequirements("");
      setProjDeliverables("");
      setAssignFrom("");
      setAssignUntil("");
      setQuizQuestionsList([]);
      setBaseDetailsSaved(false);
      setReviewMode(false);
      setCreatedQuizId("");
      setCreatedActivityId("");
    } catch (err: any) {
      console.error("Unified publishing failed:", err);
      showError(err.message || "Unified publishing failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity? This will remove all associated assignments and attempts!")) return;
    setLoading(true);
    const res = await deleteActivityAction(id);
    if (res.success) {
      showSuccess("Activity deleted successfully!");
      setActivities(prev => prev.filter(act => act.id !== id));
      setSelectedActivity(null);
      queryClient.invalidateQueries({ queryKey: ["all-activities", selectedInstId] });
    } else {
      showError(res.error || "Failed to delete activity.");
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
      showSuccess("Visible Example added!");
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
      showSuccess("Execution Test Case added!");
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
      showSuccess("Visible Example deleted!");
    } else {
      showError(res.error || "Failed to delete example");
    }
    setLoading(false);
  };

  const handleDeleteTestCase = async (id: string) => {
    setLoading(true);
    const res = await deleteChallengeTestCaseAction(id);
    if (res.success) {
      setTestCasesList(prev => prev.filter(tc => tc.id !== id));
      showSuccess("Test Case deleted!");
    } else {
      showError(res.error || "Failed to delete test case");
    }
    setLoading(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdActivityId || !assignCohortId) {
      showError("Please select a target Group for assignment.");
      return;
    }

    setLoading(true);

    // Client-side date check
    const cohort = cohorts.find(c => c.id === assignCohortId);
    if (cohort) {
      const start = cohort.start_date ? new Date(cohort.start_date) : null;
      const end = cohort.end_date ? new Date(cohort.end_date) : null;

      if (assignFrom) {
        const fromDate = new Date(assignFrom);
        if (start && fromDate < start) {
          showError(`Available From date (${fromDate.toLocaleDateString()}) cannot be before group start date (${start.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
        if (end && fromDate > end) {
          showError(`Available From date (${fromDate.toLocaleDateString()}) cannot be after group end date (${end.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
      }
      if (assignUntil) {
        const untilDate = new Date(assignUntil);
        if (start && untilDate < start) {
          showError(`Available Until date (${untilDate.toLocaleDateString()}) cannot be before group start date (${start.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
        if (end && untilDate > end) {
          showError(`Available Until date (${untilDate.toLocaleDateString()}) cannot be after group end date (${end.toLocaleDateString()}).`);
          setLoading(false);
          return;
        }
      }
      if (assignFrom && assignUntil) {
        const fromDate = new Date(assignFrom);
        const untilDate = new Date(assignUntil);
        if (fromDate > untilDate) {
          showError("Available From date cannot be after Available Until date.");
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
      showSuccess("Activity assigned to group successfully!");
      setCreatedActivityId("");
      setCreatedQuizId("");
      setCreatedChallengeId("");
      setQuizQuestionsList([]);
      setExamplesList([]);
      setTestCasesList([]);
    } else if (res.error) {
      showError(res.error);
    }
    setLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    if (!editForm.title.trim()) {
      showError("Activity title is required.");
      return;
    }

    if (editForm.max_score <= 0 || editForm.passing_score < 0) {
      showError("Scores must be positive numbers.");
      return;
    }

    if (editForm.passing_score > editForm.max_score) {
      showError("Passing score cannot be greater than the maximum score.");
      return;
    }

    if (selectedActivity.activity_type_code === "quiz" && editForm.quiz_strict_mode && !editForm.quiz_time_limit) {
      showError("Strict/Proctored Mode requires a time limit to be set.");
      return;
    }

    setLoading(true);

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
              showError(`Assignment start date (${fromDate.toLocaleDateString()}) for group "${cohort.name}" cannot be before group start date (${start.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
            if (end && fromDate > end) {
              showError(`Assignment start date (${fromDate.toLocaleDateString()}) for group "${cohort.name}" cannot be after group end date (${end.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
          }
          if (assign.available_until) {
            const untilDate = new Date(assign.available_until);
            if (start && untilDate < start) {
              showError(`Assignment end date (${untilDate.toLocaleDateString()}) for group "${cohort.name}" cannot be before group start date (${start.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
            if (end && untilDate > end) {
              showError(`Assignment end date (${untilDate.toLocaleDateString()}) for group "${cohort.name}" cannot be after group end date (${end.toLocaleDateString()}).`);
              setLoading(false);
              return;
            }
          }
          if (assign.available_from && assign.available_until) {
            const fromDate = new Date(assign.available_from);
            const untilDate = new Date(assign.available_until);
            if (fromDate > untilDate) {
              showError(`Assignment start date cannot be after end date for group "${cohort.name}".`);
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
      quiz_show_results_immediately: true,
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
      assignments: editForm.assignments.map(a => ({
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
      await queryClient.invalidateQueries({ queryKey: ["all-activities", selectedInstId] });
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

    // Load student performance progress
    const progRes = await listActivityProgressAction(activity.id);
    if (progRes.progress) {
      setStudentProgressList(progRes.progress);
    }

    setDetailsLoading(false);
  };

  return (
    <div className="space-y-6 text-xs text-[#EDEFF5] w-full">

      {/* Top Banner Scope */}
      {!lockInstitution && (
        <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#C2C6D1] flex items-center gap-1.5">
            <Shield size={15} className="text-[#6E79F4]" /> Learning Activities Scope
          </h3>
          <p className="text-xs text-[#C2C6D1] mb-4">
            Select campus context to list or create learning assignments.
          </p>
          <CustomSelect
            options={institutions}
            value={selectedInstId}
            onChange={(val) => {
              setSelectedInstId(val);
              setSelectedActivity(null);
            }}
            placeholder="-- Select Institution Campus --"
            className="max-w-md"
          />
        </div>
      )}

      {selectedInstId && (
        isDataLoading ? (
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[200px]">
            <SecondaryLoader variant="skeleton" message="Syncing learning manager records..." className="!border-0 !p-0 shadow-none bg-transparent" />
          </div>
        ) : mode === "create" ? (
          // CREATE MODE VIEW
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Tree Navigation Left */}
            <div className="lg:col-span-4 bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm space-y-4">
              <h4 className="font-bold text-xs uppercase text-[#EDEFF5] border-b border-[#23252C] pb-2">Academic Navigator</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#C2C6D1] mb-1">Learning Program</label>
                  <CustomSelect
                    options={programs.map(p => ({ id: p.id, name: p.title }))}
                    value={selectedProgId}
                    onChange={(val) => {
                      setSelectedProgId(val);
                      handleCourseSelection("");
                      setAssignCohortId("");
                    }}
                    placeholder="-- Select Program --"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#C2C6D1] mb-1">Target Group *</label>
                  <CustomSelect
                    options={cohorts.map(c => ({ id: c.id, name: c.name, code: c.code }))}
                    value={assignCohortId}
                    onChange={setAssignCohortId}
                    placeholder="-- Select Group --"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#C2C6D1] mb-1">Course *</label>
                  <CustomSelect
                    options={courses.map(c => ({ id: c.id, name: c.title }))}
                    value={selectedCourseId}
                    onChange={handleCourseSelection}
                    placeholder="-- Select Course --"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Configuration Builder Panels Right */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Step 1: Base Details Form */}
              {!baseDetailsSaved && (
                <form onSubmit={handleCreateActivityBase} className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
                  <h4 className="font-bold text-xs uppercase text-[#EDEFF5] border-b border-[#23252C] pb-2 flex items-center gap-1.5">
                    <Plus size={16} className="text-[#6E79F4]" /> Create Lesson Activity
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Activity Type *</label>
                      <CustomSelect
                        options={[
                          { id: "quiz", name: "Quiz Engine Assessment" },
                          { id: "project", name: "Project Work (GitHub URL)" },
                          { id: "programming", name: "Programming Challenge (Judge Engine)" },
                        ]}
                        value={activityType}
                        onChange={(val) => setActivityType(val as typeof activityType)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. React Router V6 Quiz"
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Max Score</label>
                      <input
                        type="number"
                        value={maxScore}
                        onChange={(e) => setMaxScore(Number(e.target.value))}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Passing Score</label>
                      <input
                        type="number"
                        value={passingScore}
                        onChange={(e) => setPassingScore(Number(e.target.value))}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={(e) => setIsMandatory(e.target.checked)}
                        id="isMandatory"
                        className="rounded border-[#23252C] text-[#6E79F4] focus:ring-[#6E79F4]"
                      />
                      <label htmlFor="isMandatory" className="font-semibold text-[#C2C6D1] cursor-pointer">Mandatory Activity</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#23252C] pt-4">
                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Available From (Start Date/Time)</label>
                      <input
                        type="datetime-local"
                        value={assignFrom}
                        onChange={(e) => setAssignFrom(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Available Until (Due Date/Time)</label>
                      <input
                        type="datetime-local"
                        value={assignUntil}
                        onChange={(e) => setAssignUntil(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#C2C6D1] mb-1">Description / Overview</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief description of the challenge..."
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg p-3 text-xs focus:outline-none focus:border-[#6E79F4] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#C2C6D1] mb-1">Instructions / Guidelines</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={3}
                      placeholder="Enter guidelines for submission, execution rules, or details here..."
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg p-3 text-xs focus:outline-none focus:border-[#6E79F4] resize-none"
                    />
                  </div>

                  {/* Subclass-specific fields */}
                  {activityType === "quiz" && (
                    <div className="border-t border-[#23252C] pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Time Limit (Minutes)</label>
                          <input
                            type="number"
                            value={quizTimeLimit}
                            onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Max Attempts Allowed</label>
                          <input
                            type="number"
                            value={quizMaxAttempts}
                            onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizShuffleQ}
                            onChange={(e) => setQuizShuffleQ(e.target.checked)}
                            id="quizShuffleQ"
                            className="rounded border-[#23252C] text-[#6E79F4]"
                          />
                          <label htmlFor="quizShuffleQ" className="font-semibold text-[#C2C6D1]">Shuffle Questions</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizShuffleO}
                            onChange={(e) => setQuizShuffleO(e.target.checked)}
                            id="quizShuffleO"
                            className="rounded border-[#23252C] text-[#6E79F4]"
                          />
                          <label htmlFor="quizShuffleO" className="font-semibold text-[#C2C6D1]">Shuffle Options</label>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[#23252C]">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={quizStrictMode}
                            onChange={(e) => setQuizStrictMode(e.target.checked)}
                            id="quizStrictMode"
                            className="rounded border-[#23252C] text-[#F0555D]"
                          />
                          <label htmlFor="quizStrictMode" className="font-semibold text-[#C2C6D1]">Enable Strict/Proctored Mode (fullscreen required, tab-switch = forfeited attempt)</label>
                        </div>
                        {quizStrictMode && !quizTimeLimit && (
                          <p className="text-[10px] text-[#F0555D] font-semibold mt-1.5 ml-6">Strict Mode requires a Time Limit to be set above.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activityType === "project" && (
                    <div className="border-t border-[#23252C] pt-4 space-y-3">
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Project Overview</label>
                        <textarea
                          value={projOverview}
                          onChange={(e) => setProjOverview(e.target.value)}
                          rows={2}
                          placeholder="Netflix Clone with React Hooks..."
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg p-3 text-xs focus:outline-none focus:border-[#6E79F4] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Difficulty Level</label>
                          <select
                            value={projDifficulty}
                            onChange={(e) => setProjDifficulty(e.target.value)}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Estimated Hours</label>
                          <input
                            type="number"
                            value={projHours}
                            onChange={(e) => setProjHours(Number(e.target.value))}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Requirements</label>
                        <textarea
                          value={projRequirements}
                          onChange={(e) => setProjRequirements(e.target.value)}
                          rows={2}
                          placeholder="Must use Redux, TailwindCSS..."
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg p-3 text-xs focus:outline-none focus:border-[#6E79F4] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {activityType === "programming" && (
                    <div className="border-t border-[#23252C] pt-4 space-y-3">
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Problem Statement</label>
                        <textarea
                          value={chalStatement}
                          onChange={(e) => setChalStatement(e.target.value)}
                          rows={3}
                          placeholder="Given an array of integers..."
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg p-3 text-xs focus:outline-none focus:border-[#6E79F4] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Difficulty</label>
                          <select
                            value={chalDifficulty}
                            onChange={(e) => setChalDifficulty(e.target.value)}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#C2C6D1] mb-1">Time Limit (ms)</label>
                          <input
                            type="number"
                            value={chalTime}
                            onChange={(e) => setChalTime(Number(e.target.value))}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/15 p-2.5 rounded-lg text-[10px] text-[#EDEFF5] leading-relaxed">
                        <strong className="text-[#6E79F4]">Next step:</strong> save this base problem first — the per-language
                        starter code editor, lockdown toggle, examples, and visible/hidden test cases all open up immediately
                        after saving, since they attach to the challenge record this creates.
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#6E79F4]/95 transition-all text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Registering..." : "Save Learning Activity"}
                  </button>
                </form>
              )}

              {/* Quiz questions configuration step */}
              {baseDetailsSaved && createdQuizId === "temp-quiz" && !reviewMode && activityType === "quiz" && (
                <div className="space-y-6">
                  <form onSubmit={handleAddQuestion} className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#EDEFF5] border-b border-[#23252C] pb-2 flex items-center gap-1.5">
                      <HelpCircle size={16} className="text-[#6E79F4]" /> {editingQuestion ? "Edit Quiz Question" : "Add Quiz Questions"}
                    </h4>

                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Question Text</label>
                      <input
                        type="text"
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder="e.g. What is the virtual DOM in React?"
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Question Type</label>
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
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="single_choice">Single Choice</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Points</label>
                        <input
                          type="number"
                          value={newQuestionPoints}
                          onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block font-bold text-[#EDEFF5]">Answer Options & Correct Key</label>
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
                            className="accent-[#6E79F4]"
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
                            className="flex-1 bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:bg-[#16171D] disabled:text-[#C2C6D1]"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#6E79F4]/95 transition-all text-xs cursor-pointer"
                      >
                        {editingQuestion ? "Save Question Changes" : "Add Question to Quiz"}
                      </button>
                      {editingQuestion && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(null);
                            setNewQuestionText("");
                            setNewQuestionOptions(["", "", "", ""]);
                            setNewQuestionCorrectIndices([0]);
                          }}
                          className="border border-[#23252C] hover:bg-[#1A1C22] text-[#C2C6D1] px-4 py-2 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>

                  {quizQuestionsList.length > 0 && (
                    <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-3">
                      <h5 className="font-bold text-xs text-[#EDEFF5]">Added Questions ({quizQuestionsList.length})</h5>
                      <div className="divide-y divide-[#23252C]">
                        {quizQuestionsList.map((q, idx) => (
                          <div key={q.id || idx} className="py-2.5 flex justify-between items-center text-xs text-[#EDEFF5] gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{idx + 1}. {q.question_text}</p>
                              <span className="text-[9px] text-[#C2C6D1] font-mono">({q.question_type} &bull; {q.points} pts)</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(q)}
                                className="p-1 hover:bg-[#1A1C22] text-[#6E79F4] rounded transition-colors"
                                title="Edit Question"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-1 hover:bg-red-50 text-[#F0555D] rounded transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          if (quizQuestionsList.length === 0) {
                            showError("Please add at least one question before reviewing.");
                            return;
                          }
                          setReviewMode(true);
                          setEditingQuestion(null);
                        }}
                        className="bg-[#2FBF71] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2FBF71]/95 text-xs w-full mt-3 cursor-pointer"
                      >
                        Finished Adding Questions &rarr; Review Activity Details
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Challenge Examples & Test Cases */}
              {createdChallengeId && activityType === "programming" && (
                <div className="space-y-6">
                  <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm">
                    <ChallengeEditor
                      challengeId={createdChallengeId}
                      strictMode={chalStrictMode}
                      onStrictModeChange={setChalStrictMode}
                    />
                  </div>

                  {examplesList.length > 0 && (
                    <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-2">
                      <h5 className="font-bold text-xs text-[#EDEFF5]">Examples Added ({examplesList.length})</h5>
                      {examplesList.map((ex, index) => (
                        <div key={ex.id || index} className="p-2.5 bg-[#16171D] border border-[#23252C] rounded-lg flex justify-between items-start gap-3 text-[10px] font-mono">
                          <div>Ex {ex.example_number}: Input: {ex.input_example} &rarr; Output: {ex.output_example}</div>
                          <button type="button" onClick={() => handleDeleteExample(ex.id)} className="p-1 bg-red-50 border border-red-100 hover:bg-red-100 text-[#F0555D] rounded shrink-0">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddExample} className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#EDEFF5] border-b border-[#23252C] pb-2 flex items-center gap-1.5">
                      <Eye size={16} className="text-[#6E79F4]" /> Add Visible Examples
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Example Input</label>
                        <input
                          type="text"
                          value={newExInput}
                          onChange={(e) => setNewExInput(e.target.value)}
                          placeholder="[2, 7, 11, 15], 9"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Example Output</label>
                        <input
                          type="text"
                          value={newExOutput}
                          onChange={(e) => setNewExOutput(e.target.value)}
                          placeholder="[0, 1]"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#C2C6D1] mb-1">Explanation</label>
                      <input
                        type="text"
                        value={newExExpl}
                        onChange={(e) => setNewExExpl(e.target.value)}
                        placeholder="Because nums[0] + nums[1] == 9..."
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>

                    <button type="submit" className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-lg font-bold cursor-pointer">
                      Add Example
                    </button>
                  </form>

                  {testCasesList.length > 0 && (
                    <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-2">
                      <h5 className="font-bold text-xs text-[#EDEFF5]">Test Cases Added ({testCasesList.length})</h5>
                      {testCasesList.map((tc, index) => (
                        <div key={tc.id || index} className="p-2.5 bg-[#16171D] border border-[#23252C] rounded-lg flex justify-between items-start gap-3 text-[10px] font-mono">
                          <div>
                            Test {index + 1}: Input: {tc.input_data} &rarr; Expected: {tc.expected_output}
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

                  <form onSubmit={handleAddTestCase} className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-xs uppercase text-[#EDEFF5] border-b border-[#23252C] pb-2 flex items-center gap-1.5">
                      <Layers size={16} className="text-[#6E79F4]" /> Add Test Case
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Test Case Input</label>
                        <input
                          type="text"
                          value={newTcInput}
                          onChange={(e) => setNewTcInput(e.target.value)}
                          placeholder="[3, 2, 4], 6"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#C2C6D1] mb-1">Expected Output</label>
                        <input
                          type="text"
                          value={newTcOutput}
                          onChange={(e) => setNewTcOutput(e.target.value)}
                          placeholder="[1, 2]"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="admin_create_tc_is_hidden"
                        checked={newTcHidden}
                        onChange={(e) => setNewTcHidden(e.target.checked)}
                        className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                      />
                      <label htmlFor="admin_create_tc_is_hidden" className="font-semibold text-xs text-[#C2C6D1]">Hidden Test Case (not shown to students, used for grading only)</label>
                    </div>

                    <button type="submit" className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-lg font-bold cursor-pointer">
                      Add Test Case
                    </button>
                  </form>

                  <button
                    onClick={() => setCreatedChallengeId("")}
                    className="bg-[#2FBF71] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2FBF71]/95 text-xs w-full cursor-pointer"
                  >
                    Finished Challenge Content &rarr; Go to Assign Group
                  </button>
                </div>
              )}

              {/* Unified Review & Submit Screen */}
              {baseDetailsSaved && reviewMode && (
                <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-6">
                  <div className="border-b border-[#23252C] pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-[#2FBF71]" /> Review & Publish Activity
                      </h4>
                      <p className="text-[10px] text-[#C2C6D1] mt-0.5">Please verify the details below before publishing to candidates.</p>
                    </div>
                    <span className="bg-[#2FBF71]/10 text-[#2FBF71] border border-[#2FBF71]/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                      Ready to Publish
                    </span>
                  </div>

                  {/* General Config Outline */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#16171D] p-4 rounded-xl border border-[#23252C]">
                    <div>
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold">Activity Title</span>
                      <strong className="text-xs text-[#EDEFF5]">{title}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold">Type</span>
                      <strong className="text-xs text-[#EDEFF5] uppercase">{activityType}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold">Max / Pass Score</span>
                      <strong className="text-xs text-[#EDEFF5]">{maxScore} / {passingScore}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold">Mandatory</span>
                      <strong className="text-xs text-[#EDEFF5]">{isMandatory ? "Required" : "Optional"}</strong>
                    </div>
                  </div>

                  {/* Allocation Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-[#23252C] p-3 rounded-lg">
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold mb-0.5">Target Group</span>
                      <span className="font-bold text-xs text-[#EDEFF5]">
                        {cohorts.find(c => c.id === assignCohortId)?.name || "N/A"}
                      </span>
                    </div>
                    <div className="border border-[#23252C] p-3 rounded-lg font-mono">
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold mb-0.5 font-sans">Available From</span>
                      <span className="text-xs text-[#EDEFF5] font-bold">
                        {assignFrom ? new Date(assignFrom).toLocaleString() : "Immediately"}
                      </span>
                    </div>
                    <div className="border border-[#23252C] p-3 rounded-lg font-mono">
                      <span className="text-[10px] text-[#C2C6D1] block font-semibold mb-0.5 font-sans">Due Date</span>
                      <span className="text-xs text-[#EDEFF5] font-bold">
                        {assignUntil ? new Date(assignUntil).toLocaleString() : "No Limit"}
                      </span>
                    </div>
                  </div>

                  {/* Quiz Questions Student Preview */}
                  {activityType === "quiz" && (
                    <div className="space-y-3">
                      <h5 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wider text-[#C2C6D1] border-b border-[#23252C] pb-1">
                        Candidate Quiz Preview ({quizQuestionsList.length} Questions)
                      </h5>
                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                        {quizQuestionsList.map((q, idx) => (
                          <div key={q.id || idx} className="border border-[#23252C] p-4 rounded-xl bg-[#131418] space-y-3">
                            <div className="flex justify-between items-start font-semibold text-[#EDEFF5] text-xs">
                              <span>Q{idx + 1}: {q.question_text}</span>
                              <span className="text-[9px] bg-[#1A1C22] px-2 py-0.5 rounded font-mono text-[#C2C6D1]">
                                {q.points} Points
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 pl-2">
                              {q.options?.map((opt: any, optIdx: number) => (
                                <div key={opt.id || optIdx} className="flex items-center gap-2 text-xs border border-[#1A1C22] p-2 rounded hover:bg-[#16171D]/50">
                                  <input
                                    type={q.question_type === "multiple_choice" ? "checkbox" : "radio"}
                                    disabled
                                    checked={opt.is_correct}
                                    className="accent-[#6E79F4] pointer-events-none scale-90"
                                  />
                                  <span className={opt.is_correct ? "text-[#2FBF71] font-medium" : "text-[#C2C6D1]"}>
                                    {opt.option_text}
                                  </span>
                                  {opt.is_correct && (
                                    <span className="text-[9px] bg-[#2FBF71]/10 text-[#2FBF71] border border-[#2FBF71]/20 px-1 rounded ml-1 scale-90">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project Overview Details Preview */}
                  {activityType === "project" && (
                    <div className="space-y-3">
                      <h5 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wider text-[#C2C6D1] border-b border-[#23252C] pb-1">
                        Project Outline
                      </h5>
                      <div className="bg-[#16171D] p-4 rounded-xl space-y-3">
                        {projOverview && (
                          <div>
                            <span className="text-[10px] text-[#C2C6D1] font-bold block mb-0.5">Overview</span>
                            <p className="text-xs text-[#EDEFF5] whitespace-pre-wrap">{projOverview}</p>
                          </div>
                        )}
                        {projRequirements && (
                          <div>
                            <span className="text-[10px] text-[#C2C6D1] font-bold block mb-0.5">Requirements</span>
                            <p className="text-xs text-[#EDEFF5] whitespace-pre-wrap">{projRequirements}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Publish Actions */}
                  <div className="border-t border-[#23252C] pt-4 flex flex-wrap gap-3">
                    <button
                      onClick={handleConfirmPublish}
                      disabled={loading}
                      className="bg-[#2FBF71] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-[#2FBF71]/95 shadow-sm transition-all text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {loading ? "Publishing..." : <>Confirm &amp; Publish Activity</>}
                    </button>
                    <button
                      onClick={() => {
                        setReviewMode(false);
                      }}
                      className="border border-[#23252C] hover:bg-[#1A1C22] text-[#C2C6D1] px-4 py-2 rounded-lg font-semibold text-xs cursor-pointer"
                    >
                      &larr; Back to {activityType === "quiz" ? "Questions" : "Settings"}
                    </button>
                    <button
                      onClick={() => {
                        setBaseDetailsSaved(false);
                        setReviewMode(false);
                        setCreatedQuizId("");
                        setQuizQuestionsList([]);
                      }}
                      className="border border-red-100 hover:bg-red-50 text-[#F0555D] px-4 py-2 rounded-lg font-semibold text-xs cursor-pointer ml-auto"
                    >
                      Cancel &amp; Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // VIEW PUBLISHED ACTIVITIES VIEW
          <div className={lockInstitution ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : ""}>
            {lockInstitution && (
              <div className="lg:col-span-3 bg-[#131418] border border-[#23252C] rounded-xl shadow-sm h-fit">
                <div className="px-4 py-4 border-b border-[#1F2128] bg-[#0E0F13] rounded-t-xl">
                  <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Activity Scope</span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1">Campus</label>
                    <p className="text-xs font-semibold text-[#EDEFF5] px-2.5 py-1.5 bg-[#16171D] border border-[#23252C] rounded-lg truncate">
                      {institutions.find((i) => i.id === selectedInstId)?.name || "—"}
                    </p>
                  </div>
                  {scopeLabel && (
                    <div>
                      <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1">Group</label>
                      <p className="text-xs font-semibold text-[#EDEFF5] px-2.5 py-1.5 bg-[#16171D] border border-[#23252C] rounded-lg truncate">
                        {scopeLabel}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1">Activity Type</label>
                    <CustomSelect
                      options={[
                        { id: "all", name: "All Activity Types" },
                        { id: "quiz", name: "Quizzes only" },
                        { id: "project", name: "Projects only" },
                        { id: "programming", name: "Coding challenges only" },
                      ]}
                      value={typeFilter}
                      onChange={setTypeFilter}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1">Group</label>
                    <CustomSelect
                      options={[{ id: "all", name: "All Groups" }, ...cohorts.map(c => ({ id: c.id, name: c.name, code: c.code }))]}
                      value={cohortFilter}
                      onChange={setCohortFilter}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

          <div className={`bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-4 ${lockInstitution ? "lg:col-span-9" : ""}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1F2128] pb-2 gap-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                <List size={14} className="text-[#6E79F4]" /> Published Learning Activities ({activities.length})
              </h4>
              {!lockInstitution && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <CustomSelect
                    options={[
                      { id: "all", name: "All Activity Types" },
                      { id: "quiz", name: "Quizzes only" },
                      { id: "project", name: "Projects only" },
                      { id: "programming", name: "Coding challenges only" },
                    ]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    className="min-w-[190px]"
                    required
                  />
                  <CustomSelect
                    options={[{ id: "all", name: "All Groups" }, ...cohorts.map(c => ({ id: c.id, name: c.name, code: c.code }))]}
                    value={cohortFilter}
                    onChange={setCohortFilter}
                    className="min-w-[190px]"
                    required
                  />
                </div>
              )}
            </div>

            {(() => {
              const filtered = activities.filter(
                (act) =>
                  (typeFilter === "all" || act.activity_type_code === typeFilter) &&
                  (cohortFilter === "all" || (act.cohort_ids || []).includes(cohortFilter))
              );

              const typeBadge = (act: any) => (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  act.activity_type_code === "quiz" ? "bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20" :
                  act.activity_type_code === "project" ? "bg-[#F5B04A]/10 text-[#F5B04A] border border-[#F5B04A]/20" :
                  "bg-[#2FBF71]/10 text-[#2FBF71] border border-[#2FBF71]/20"
                }`}>
                  {act.activity_type_code}
                </span>
              );

              if (filtered.length === 0) {
                return (
                  <div className="px-4 py-10 text-center text-[#C2C6D1] italic text-xs">
                    No published activities match the selected type filter.
                  </div>
                );
              }

              return (
                <>
                  {/* Mobile card list */}
                  <div className="sm:hidden space-y-3">
                    {filtered.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => handleViewActivityClick(act)}
                        className="bg-[#16171D] border border-[#23252C] rounded-xl p-4 space-y-3 cursor-pointer active:bg-[#1A1C22] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-[#EDEFF5] text-xs min-w-0 break-words">{act.title}</span>
                          {typeBadge(act)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#C2C6D1]">
                          <span>Max: <span className="font-mono text-[#EDEFF5]">{act.max_score}</span></span>
                          <span>Pass: <span className="font-mono text-[#EDEFF5]">{act.passing_score}</span></span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            act.is_mandatory ? "bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20" : "bg-[#1A1C22] text-[#C2C6D1]"
                          }`}>
                            {act.is_mandatory ? "Required" : "Optional"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-[#23252C]" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              handleViewActivityClick(act);
                              setTimeout(() => setIsEditing(true), 100);
                            }}
                            className="flex-1 p-1.5 bg-[#131418] hover:bg-[#6E79F4]/10 hover:text-[#6E79F4] text-[#C2C6D1] rounded-lg transition-all flex items-center justify-center gap-1 font-semibold text-[10px]"
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="flex-1 p-1.5 bg-[#F0555D]/10 hover:bg-[#F0555D]/20 text-[#F0555D] rounded-lg transition-all flex items-center justify-center gap-1 font-semibold text-[10px]"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                          <button
                            onClick={() => handleViewActivityClick(act)}
                            className="flex-1 p-1.5 bg-[#131418] hover:bg-[#23252C] text-[#EDEFF5] rounded-lg transition-all flex items-center justify-center gap-1 font-semibold text-[10px]"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop / tablet table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                          <th className="px-4 py-3">Activity Title</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Max Score</th>
                          <th className="px-4 py-3">Passing Score</th>
                          <th className="px-4 py-3">Mandatory</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#23252C]">
                        {filtered.map((act) => (
                          <tr
                            key={act.id}
                            onClick={() => handleViewActivityClick(act)}
                            className="hover:bg-[#16171D]/50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3.5 font-semibold text-[#EDEFF5]">
                              {act.title}
                            </td>
                            <td className="px-4 py-3.5">
                              {typeBadge(act)}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[#C2C6D1]">{act.max_score}</td>
                            <td className="px-4 py-3.5 font-mono text-[#C2C6D1]">{act.passing_score}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                act.is_mandatory ? "bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20" : "bg-[#1A1C22] text-[#C2C6D1]"
                              }`}>
                                {act.is_mandatory ? "Required" : "Optional"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  handleViewActivityClick(act);
                                  setTimeout(() => setIsEditing(true), 100);
                                }}
                                className="p-1.5 bg-[#16171D] hover:bg-[#6E79F4]/10 hover:text-[#6E79F4] text-[#C2C6D1] rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px]"
                                title="Edit Activity"
                              >
                                <Edit size={12} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteActivity(act.id)}
                                className="p-1.5 bg-[#F0555D]/10 hover:bg-[#F0555D]/20 text-[#F0555D] rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px]"
                                title="Delete Activity"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                              <button
                                onClick={() => handleViewActivityClick(act)}
                                className="p-1.5 bg-[#1A1C22] hover:bg-[#23252C] text-[#EDEFF5] rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px]"
                                title="View details"
                              >
                                View Console
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
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
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full sm:max-w-lg bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">

            {/* Header */}
            <div className="bg-[#16171D] px-4 sm:px-6 py-4 sm:py-5 border-b border-[#23252C] flex justify-between items-center gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <Award size={16} className="text-[#6E79F4] shrink-0" /> Activity Console
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5 truncate">{selectedActivity.title}</p>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors cursor-pointer font-bold shrink-0"
              >
                âœ•
              </button>
            </div>

            {/* Tab navigation inside drawer */}
            <div className="flex border-b border-[#23252C] shrink-0 bg-[#16171D]/30">
              <button
                onClick={() => setActiveDrawerTab("config")}
                className={`flex-1 px-2 py-3 text-center font-bold border-b-2 transition-all truncate ${
                  activeDrawerTab === "config"
                    ? "border-[#6E79F4] text-[#6E79F4]"
                    : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
                }`}
              >
                Blueprint Config
              </button>
              <button
                onClick={() => setActiveDrawerTab("performance")}
                className={`flex-1 px-2 py-3 text-center font-bold border-b-2 transition-all truncate ${
                  activeDrawerTab === "performance"
                    ? "border-[#6E79F4] text-[#6E79F4]"
                    : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
                }`}
              >
                Performance ({studentProgressList.length})
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {detailsLoading ? (
                <SecondaryLoader variant="spinner" message="Loading details & grades..." />
              ) : activeDrawerTab === "config" ? (
                isEditing ? (
                  <>
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
                      <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Guidelines & Submission Rules</label>
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

                    {/* Subclass: Quiz */}
                    {selectedActivity.activity_type_code === "quiz" && (
                      <div className="border-t border-[#23252C] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1]">Quiz Configuration</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Time Limit (minutes)</label>
                            <input
                              type="number"
                              value={editForm.quiz_time_limit}
                              onChange={(e) => setEditForm({ ...editForm, quiz_time_limit: Number(e.target.value) })}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Max Attempts Allowed</label>
                            <input
                              type="number"
                              value={editForm.quiz_max_attempts}
                              onChange={(e) => setEditForm({ ...editForm, quiz_max_attempts: Number(e.target.value) })}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
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
                              className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                            />
                            <label htmlFor="edit_quiz_shuffle_questions" className="font-semibold text-xs text-[#EDEFF5]">Shuffle Questions</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_quiz_shuffle_options"
                              checked={editForm.quiz_shuffle_options}
                              onChange={(e) => setEditForm({ ...editForm, quiz_shuffle_options: e.target.checked })}
                              className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                            />
                            <label htmlFor="edit_quiz_shuffle_options" className="font-semibold text-xs text-[#EDEFF5]">Shuffle Options</label>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-[#23252C]">
                            <input
                              type="checkbox"
                              id="edit_quiz_strict_mode"
                              checked={editForm.quiz_strict_mode}
                              onChange={(e) => setEditForm({ ...editForm, quiz_strict_mode: e.target.checked })}
                              className="rounded text-[#F0555D] focus:ring-[#F0555D] border-[#23252C]"
                            />
                            <label htmlFor="edit_quiz_strict_mode" className="font-semibold text-xs text-[#EDEFF5]">Enable Strict/Proctored Mode (fullscreen required, tab-switch = forfeited attempt)</label>
                          </div>
                          {editForm.quiz_strict_mode && !editForm.quiz_time_limit && (
                            <p className="text-[10px] text-[#F0555D] font-semibold ml-6">Strict Mode requires a Time Limit to be set above.</p>
                          )}
                        </div>

                        {/* Manage questions during edit */}
                        <div className="border-t border-[#23252C] pt-4 space-y-4">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex justify-between items-center">
                            <span>Quiz Questions ({activityDetails?.questions?.length || 0})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCreatedQuizId(activityDetails?.quiz?.id);
                                setEditingQuestion(null);
                                setNewQuestionText("");
                                setNewQuestionOptions(["", "", "", ""]);
                                setNewQuestionCorrectIndices([0]);
                              }}
                              className="text-[10px] text-[#6E79F4] hover:underline font-bold"
                            >
                              + Add New Question
                            </button>
                          </h4>

                          {/* Existing questions listing in edit mode */}
                          {activityDetails?.questions && activityDetails.questions.length > 0 && (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {activityDetails.questions.map((q: any, idx: number) => (
                                <div key={q.id || idx} className="p-2 border border-[#23252C] rounded-lg bg-[#16171D] flex justify-between items-center gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate text-[11px]">Q{idx + 1}: {q.question_text}</p>
                                    <span className="text-[9px] text-[#C2C6D1] font-mono">({q.question_type} &bull; {q.points} pts)</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCreatedQuizId(activityDetails?.quiz?.id);
                                        handleStartEditQuestion(q);
                                      }}
                                      className="p-1 hover:bg-[#23252C] text-[#6E79F4] rounded transition-colors"
                                      title="Edit Question"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      className="p-1 hover:bg-red-100 text-[#F0555D] rounded transition-colors"
                                      title="Delete Question"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Question editor form in the drawer if createdQuizId matches this quiz */}
                          {createdQuizId === activityDetails?.quiz?.id && (
                            <div className="border border-dashed border-[#6E79F4]/30 bg-[#6E79F4]/5 p-3 rounded-lg space-y-3">
                              <span className="font-bold text-[10px] uppercase text-[#6E79F4] block">
                                {editingQuestion ? "Edit Quiz Question" : "Add Quiz Question"}
                              </span>
                              <div>
                                <label className="block font-semibold text-[#C2C6D1] mb-0.5">Question Text</label>
                                <input
                                  type="text"
                                  value={newQuestionText}
                                  onChange={(e) => setNewQuestionText(e.target.value)}
                                  placeholder="e.g. Question text..."
                                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#6E79F4]"
                                  required
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block font-semibold text-[#C2C6D1] mb-0.5">Type</label>
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
                                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2 py-1 text-xs focus:outline-none"
                                  >
                                    <option value="single_choice">Single Choice</option>
                                    <option value="multiple_choice">Multiple Choice</option>
                                    <option value="true_false">True / False</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block font-semibold text-[#C2C6D1] mb-0.5">Points</label>
                                  <input
                                    type="number"
                                    value={newQuestionPoints}
                                    onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2 py-1 text-xs focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="block font-semibold text-[#C2C6D1] mb-0.5">Options & Key</label>
                                {newQuestionOptions.map((opt, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <input
                                      type={newQuestionType === "multiple_choice" ? "checkbox" : "radio"}
                                      name="correctIndexEdit"
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
                                      className="accent-[#6E79F4]"
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
                                      placeholder={`Option ${idx + 1}`}
                                      className="flex-1 bg-[#131418] border border-[#23252C] rounded px-2 py-0.5 text-xs outline-none"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleAddQuestion}
                                  className="bg-[#6E79F4] text-white px-3 py-1 rounded text-xs font-bold hover:bg-[#6E79F4]/95"
                                >
                                  {editingQuestion ? "Save Question" : "Add Question"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatedQuizId("");
                                    setEditingQuestion(null);
                                  }}
                                  className="border border-[#23252C] text-[#C2C6D1] bg-[#131418] px-3 py-1 rounded text-xs font-bold hover:bg-[#1A1C22]"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Subclass: Project */}
                    {selectedActivity.activity_type_code === "project" && (
                      <div className="border-t border-[#23252C] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1]">Project Configuration</h4>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Project Overview</label>
                          <textarea
                            rows={3}
                            value={editForm.project_overview}
                            onChange={(e) => setEditForm({ ...editForm, project_overview: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Requirements</label>
                          <textarea
                            rows={3}
                            value={editForm.project_requirements}
                            onChange={(e) => setEditForm({ ...editForm, project_requirements: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Deliverables</label>
                          <textarea
                            rows={2}
                            value={editForm.project_deliverables}
                            onChange={(e) => setEditForm({ ...editForm, project_deliverables: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Difficulty Level</label>
                            <select
                              value={editForm.project_difficulty}
                              onChange={(e) => setEditForm({ ...editForm, project_difficulty: e.target.value })}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-[#C2C6D1] uppercase text-[9px]">Estimated Hours</label>
                            <input
                              type="number"
                              value={editForm.project_estimated_hours}
                              onChange={(e) => setEditForm({ ...editForm, project_estimated_hours: Number(e.target.value) })}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

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
                            <select
                              value={editForm.chal_difficulty}
                              onChange={(e) => setEditForm({ ...editForm, chal_difficulty: e.target.value })}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
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

                    {/* Group Schedule / Allocation Updates */}
                    {editForm.assignments && editForm.assignments.length > 0 && (
                      <div className="border-t border-[#23252C] pt-4 space-y-4">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1">
                          <Calendar size={14} className="text-[#6E79F4]" /> Group Scheduling Allocations
                        </h4>
                        <div className="space-y-4">
                          {editForm.assignments.map((assign, index) => {
                            const cohort = cohorts.find(c => c.id === assign.cohort_id);
                            return (
                              <div key={assign.id} className="bg-[#16171D] border border-[#23252C] p-3 rounded-lg space-y-3">
                                <div className="flex justify-between items-center border-b border-[#23252C] pb-2">
                                  <span className="font-bold text-xs text-[#EDEFF5]">
                                    Group: {cohort ? cohort.name : "Unknown Group"}
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
                                      className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                                    />
                                    <label htmlFor={`required_${assign.id}`} className="font-semibold text-[10px] text-[#C2C6D1]">Required</label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block font-semibold text-[#C2C6D1] text-[9px] uppercase">Available From</label>
                                    <input
                                      type="datetime-local"
                                      value={assign.available_from}
                                      onChange={(e) => {
                                        const updated = [...editForm.assignments];
                                        updated[index] = { ...updated[index], available_from: e.target.value };
                                        setEditForm({ ...editForm, assignments: updated });
                                      }}
                                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block font-semibold text-[#C2C6D1] text-[9px] uppercase">Available Until</label>
                                    <input
                                      type="datetime-local"
                                      value={assign.available_until}
                                      onChange={(e) => {
                                        const updated = [...editForm.assignments];
                                        updated[index] = { ...updated[index], available_until: e.target.value };
                                        setEditForm({ ...editForm, assignments: updated });
                                      }}
                                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold"
                                    />
                                  </div>
                                </div>
                                {cohort && (cohort.start_date || cohort.end_date) && (
                                  <div className="text-[9px] text-[#C2C6D1] flex gap-2">
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
                    <div className="border-t border-[#23252C] pt-4 mt-6 space-y-6">
                      {/* Examples Section */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                          <Eye size={14} className="text-[#6E79F4]" /> Modify Examples ({examplesList.length})
                        </h4>
                        {examplesList.length > 0 && (
                          <div className="space-y-2">
                            {examplesList.map((ex, index) => (
                              <div key={ex.id || index} className="p-3 bg-[#16171D] border border-[#23252C] rounded-xl flex justify-between items-start gap-4">
                                <div className="font-mono text-[10px] space-y-1">
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
                              <div key={tc.id || index} className="p-3 bg-[#16171D] border border-[#23252C] rounded-xl flex justify-between items-start gap-4">
                                <div className="font-mono text-[10px] space-y-1">
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
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                            />
                            <textarea
                              placeholder="Expected Output"
                              value={newTcOutput}
                              onChange={(e) => setNewTcOutput(e.target.value)}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_tc_is_hidden"
                              checked={newTcHidden}
                              onChange={(e) => setNewTcHidden(e.target.checked)}
                              className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
                            />
                            <label htmlFor="edit_tc_is_hidden" className="font-semibold text-xs text-[#C2C6D1]">Hidden Test Case</label>
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
                  </>
                ) : (
                  // TAB 1: BLUEPRINT CONFIG DETAILS (PREVIEW MODE)
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
                        <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Guidelines & Submission Rules</span>
                        <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] font-mono leading-relaxed whitespace-pre-wrap">
                          {selectedActivity.instructions}
                        </p>
                      </div>
                    )}

                    {/* Subclass quiz questions */}
                    {selectedActivity.activity_type_code === "quiz" && activityDetails?.questions && (
                      <div className="space-y-3.5 pt-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] border-b border-[#23252C] pb-1">
                          Quiz Syllabus Questions ({activityDetails.questions.length})
                        </h4>
                        <div className="space-y-3">
                          {activityDetails.questions.map((q: any, idx: number) => (
                            <div key={q.id} className="border border-[#23252C] p-3 rounded-lg bg-[#131418] space-y-2">
                              <div className="flex justify-between items-start font-semibold text-[#EDEFF5]">
                                <span>Q{idx + 1}: {q.question_text}</span>
                                <span className="text-[9px] bg-[#1A1C22] px-1.5 py-0.5 rounded font-mono shrink-0 font-normal text-[#C2C6D1]">
                                  {q.points} pts
                                </span>
                              </div>
                              <div className="pl-2.5 border-l-2 border-[#1F2128] space-y-1">
                                {q.options?.map((opt: any) => (
                                  <div key={opt.id} className="flex items-center gap-1.5 text-[11px]">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.is_correct ? "bg-[#2FBF71]" : "bg-[#2E313A]"}`} />
                                    <span className={opt.is_correct ? "text-[#2FBF71] font-medium" : "text-[#C2C6D1]"}>{opt.option_text}</span>
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

                    {/* Subclass project details */}
                    {selectedActivity.activity_type_code === "project" && activityDetails?.project && (
                      <div className="space-y-4 pt-2">
                        {activityDetails.project.project_overview && (
                          <div className="space-y-1">
                            <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Project Overview</span>
                            <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] leading-relaxed">
                              {activityDetails.project.project_overview}
                            </p>
                          </div>
                        )}

                        {activityDetails.project.requirements && (
                          <div className="space-y-1">
                            <span className="font-bold text-[#C2C6D1] uppercase text-[9px] tracking-wider block">Requirements</span>
                            <p className="bg-[#16171D]/50 p-2.5 border border-[#23252C] rounded-lg text-[#EDEFF5] whitespace-pre-wrap leading-relaxed">
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
                  <div className="flex justify-between items-center border-b border-[#23252C] pb-2">
                    <span className="font-bold text-xs uppercase text-[#C2C6D1] tracking-wider">Candidate Grades Status</span>
                    <span className="font-mono text-[10px] text-[#C2C6D1]">{studentProgressList.length} Active Records</span>
                  </div>

                  <div className="space-y-2">
                    {studentProgressList.length > 0 ? (
                      studentProgressList.map((prog: any) => (
                        <div key={prog.id} className="border border-[#23252C] rounded-xl p-3 bg-[#131418] hover:bg-[#16171D]/40 transition-colors flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-[#EDEFF5] block truncate">
                              {prog.student?.full_name || "Unknown Candidate"}
                            </span>
                            <span className="text-[10px] text-[#C2C6D1] block truncate">
                              {prog.student?.email || "No email"}
                            </span>
                            <span className="text-[9px] text-[#C2C6D1] block font-mono mt-1">
                              Updated: {new Date(prog.updated_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              prog.status_code === "completed" ? "bg-[#2FBF71]/10 text-[#2FBF71]" :
                              prog.status_code === "failed" ? "bg-red-50 text-red-600" :
                              "bg-amber-50 text-amber-600"
                            }`}>
                              {prog.status_code}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#EDEFF5]">
                              Score: {prog.score ?? 0} / {selectedActivity.max_score}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-[#A3A9B6]">
                        <AlertCircle className="mx-auto mb-1 text-slate-300" size={20} />
                        <p className="text-[11px] italic">No submission attempts recorded yet for this activity.</p>
                      </div>
                    )}
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
                      const btn = document.getElementById("edit-activity-form-submit");
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="border border-[#23252C] hover:bg-[#1A1C22] text-[#6E79F4] px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit size={14} /> Edit Blueprint
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(selectedActivity.id)}
                        className="border border-red-100 hover:bg-red-50 text-[#F0555D] px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={14} /> Delete Activity
                      </button>
                    </div>
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
      )}

    </div>
  );
}
