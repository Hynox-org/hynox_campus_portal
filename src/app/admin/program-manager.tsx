"use client";
import type { Institution, Program, Module, Lesson, Resource, Lookup, Course } from "@/types/campus";
import { errorMessage } from "@/lib/error-message";

import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurriculumCacheSync } from "@/hooks/use-curriculum-cache-sync";
import {
  createProgramAction,
  deleteProgramAction,
  listCoursesAction,
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  createLessonResourceAction,
  deleteLessonResourceAction,
  updateCourseAction,
  deleteCourseAction,
  createCourseAction,
  getAcademicLookupsAction,
  updateProgramAction
} from "@/app/actions/academic-actions";
import { instantiateCourseTemplateAction } from "@/app/actions/library-actions";
import { useCourseTemplates } from "@/hooks/use-library";
import { usePrograms, useCourses, liveCurriculumKeys, fetchModules, fetchLessons, fetchResources } from "@/hooks/use-academics";
import { 
  Folder, Plus, Trash2, X, ChevronRight, ChevronDown,
  FileText, Calendar, Sparkles, Edit, Video, ExternalLink
} from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SecondaryLoader } from "@/components/secondary-loader";
import { CustomSelect } from "@/components/custom-select";
import { useToast } from "@/components/toast";

interface ProgramManagerProps {
  institutions: Institution[];
  mode?: "explorer" | "examine";
  selectedInstId: string;
  setSelectedInstId: (id: string) => void;
  selectedProgram: Program | null;
  setSelectedProgram: (prog: Program | null) => void;
}

export default function ProgramManager({ 
  institutions, 
  mode = "explorer",
  selectedInstId,
  setSelectedInstId,
  selectedProgram,
  setSelectedProgram
}: ProgramManagerProps) {
  const queryClient = useQueryClient();
  const { data: programs = [], isLoading: loadingPrograms, error: programError, refetch: retryPrograms } = usePrograms(selectedInstId);
  const { data: blueprints = [] } = useCourseTemplates();
  const { data: courses = [], isLoading: loadingCourses, error: courseError, refetch: retryCourses } = useCourses(selectedProgram?.id || "");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");

  // Cached data map to prevent refetches
  const [modulesCache, setModulesCache] = useState<Record<string, Module[]>>({});
  const [lessonsCache, setLessonsCache] = useState<Record<string, Lesson[]>>({});
  const [resourcesCache, setResourcesCache] = useState<Record<string, Resource[]>>({});
  useCurriculumCacheSync("academic-modules", setModulesCache);
  useCurriculumCacheSync("academic-lessons", setLessonsCache);
  useCurriculumCacheSync("academic-resources", setResourcesCache);

  // Loading states
  const [saving, setSaving] = useState(false);
  const loading = loadingPrograms || loadingCourses || saving;
  const [modulesLoading, setModulesLoading] = useState<Record<string, boolean>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({});
  const { showSuccess, showError } = useToast();

  // Modals / forms for Programs
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programForm, setProgramForm] = useState({ title: "", slug: "", description: "" });

  // Lookups data for editing lessons
  const [lessonTypes, setLessonTypes] = useState<Lookup[]>([]);
  const [defaultStatusId, setDefaultStatusId] = useState("");
  const [defaultLessonTypeId, setDefaultLessonTypeId] = useState("");
  const [statuses, setStatuses] = useState<Lookup[]>([]);
  const [visibilityTypes, setVisibilityTypes] = useState<Array<{ id: string; code: string }>>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modals / forms for Course Editing
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", slug: "", duration_minutes: 60, status_id: "", visibility_type_id: "" });

  // Modals / forms for Modules
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", position: 1 });

  // Modals / forms for Lessons
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    duration: 30,
    position: 1,
    lesson_type_id: "",
    video_url: "",
    content_text: ""
  });

  // Modals / forms for Resources
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState({
    title: "",
    resource_type: "link",
    external_url: "",
    file_url: ""
  });

  // Fetch lookups on mount (course template blueprints come from the shared useCourseTemplates cache)
  useEffect(() => {
    async function loadLookups() {
      const lRes = await getAcademicLookupsAction();
      if (lRes.success && lRes.lookups) {
        setLessonTypes(lRes.lookups.lessonTypes);
        setStatuses(lRes.lookups.statuses);
        setVisibilityTypes(lRes.lookups.visibilityTypes);
        const textType = lRes.lookups.lessonTypes.find((t) => t.code === "text") || lRes.lookups.lessonTypes[0];
        if (textType) setDefaultLessonTypeId(textType.id);
        const activeStatus = lRes.lookups.statuses.find((s) => s.code === "active") || lRes.lookups.statuses[0];
        if (activeStatus) setDefaultStatusId(activeStatus.id);
      }
    }
    loadLookups();
  }, []);

  // Descendants load only for the selected course; avoid a campus-wide request fan-out.
  const handleCampusChange = (campusId: string) => {
    setSelectedProgram(null);
    setSelectedCourseId(null);
    setModulesCache({}); setLessonsCache({}); setResourcesCache({});
    setSelectedInstId(campusId);
  };

  // Scroll lock when any sidebar drawer is open to prevent background viewport scrolling
  useEffect(() => {
    const isOpen = programModalOpen || courseModalOpen || moduleModalOpen || lessonModalOpen || resourceModalOpen;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [programModalOpen, courseModalOpen, moduleModalOpen, lessonModalOpen, resourceModalOpen]);

  // Fetch one opened branch at a time; a failed branch stays retryable.
  const handleSelectCourse = useCallback(async (courseId: string) => {
    setSelectedCourseId(courseId);
    if (modulesCache[courseId] || modulesLoading[courseId]) return;
    setModulesLoading(previous => ({ ...previous, [courseId]: true }));
    try {
      const modules = await fetchModules(queryClient, courseId);
      setModulesCache(previous => ({ ...previous, [courseId]: modules }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to load modules."); }
    finally { setModulesLoading(previous => ({ ...previous, [courseId]: false })); }
  }, [modulesCache, modulesLoading, queryClient, showError]);

  // Auto-select the first course when the selected program's courses load (Examine mode); useCourses handles the fetch/cache.
  useEffect(() => {
    async function selectInitialCourse() {
    if (!selectedProgram) {
      setSelectedCourseId(null);
      return;
    }
    if (courses.length > 0) {
      if (!courses.some(course => course.id === selectedCourseId)) await handleSelectCourse(courses[0].id);
    } else {
      setSelectedCourseId(null);
    }
    }
    void selectInitialCourse();
  }, [selectedProgram, courses, selectedCourseId, handleSelectCourse]);

  const refreshModules = async (courseId: string) => {
    setModulesLoading(previous => ({ ...previous, [courseId]: true }));
    try {
      await queryClient.invalidateQueries({ queryKey: liveCurriculumKeys.modules(courseId) });
      const modules = await fetchModules(queryClient, courseId);
      setModulesCache(previous => ({ ...previous, [courseId]: modules }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to refresh modules."); }
    finally { setModulesLoading(previous => ({ ...previous, [courseId]: false })); }
  };

  const toggleModuleExpand = async (moduleId: string) => {
    const closing = !!expandedModules[moduleId];
    setExpandedModules(previous => ({ ...previous, [moduleId]: !closing }));
    if (closing || lessonsCache[moduleId] || lessonsLoading[moduleId]) return;
    setLessonsLoading(previous => ({ ...previous, [moduleId]: true }));
    try {
      const lessons = await fetchLessons(queryClient, moduleId);
      setLessonsCache(previous => ({ ...previous, [moduleId]: lessons }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to load lessons."); }
    finally { setLessonsLoading(previous => ({ ...previous, [moduleId]: false })); }
  };

  const refreshLessons = async (moduleId: string) => {
    setLessonsLoading(previous => ({ ...previous, [moduleId]: true }));
    try {
      await queryClient.invalidateQueries({ queryKey: liveCurriculumKeys.lessons(moduleId) });
      const lessons = await fetchLessons(queryClient, moduleId);
      setLessonsCache(previous => ({ ...previous, [moduleId]: lessons }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to refresh lessons."); }
    finally { setLessonsLoading(previous => ({ ...previous, [moduleId]: false })); }
  };

  const toggleLessonExpand = async (lessonId: string) => {
    const closing = !!expandedLessons[lessonId];
    setExpandedLessons(previous => ({ ...previous, [lessonId]: !closing }));
    if (closing || resourcesCache[lessonId]) return;
    try {
      const resources = await fetchResources(queryClient, lessonId);
      setResourcesCache(previous => ({ ...previous, [lessonId]: resources }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to load resources."); }
  };

  const refreshResources = async (lessonId: string) => {
    try {
      await queryClient.invalidateQueries({ queryKey: liveCurriculumKeys.resources(lessonId) });
      const resources = await fetchResources(queryClient, lessonId);
      setResourcesCache(previous => ({ ...previous, [lessonId]: resources }));
    } catch (error) { showError(error instanceof Error ? errorMessage(error) : "Unable to refresh resources."); }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const res = await createProgramAction({
      ...programForm,
      tenant_id: selectedInstId,
      institution_id: selectedInstId
    });

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Program registered successfully!");
      setProgramModalOpen(false);
      setProgramForm({ title: "", slug: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: ["programs", selectedInstId] });
    }
    setSaving(false);
  };

  const handleInstantiation = async () => {
    if (!selectedBlueprintId || !selectedProgram) return;

    setSaving(true);

    const res = await instantiateCourseTemplateAction(
      selectedBlueprintId,
      selectedProgram.id,
      selectedInstId,
      selectedInstId
    );

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Course template instantiated successfully!");
      setSelectedBlueprintId("");

      await queryClient.invalidateQueries({ queryKey: ["courses", selectedProgram.id] });
      const cRes = await listCoursesAction(selectedProgram.id);
      if (cRes.courses && cRes.courses.length > 0) {
        handleSelectCourse(cRes.courses[cRes.courses.length - 1].id);
      }
    }
    setSaving(false);
  };

  // Course Create/Edit handler
  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    setSaving(true);

    if (editingCourse) {
      // Edit mode
      const res = await updateCourseAction(editingCourse.id, {
        title: courseForm.title,
        slug: courseForm.slug,
        duration_minutes: Number(courseForm.duration_minutes),
        status_id: courseForm.status_id || undefined,
        visibility_type_id: courseForm.visibility_type_id || undefined
      });
      if (res.error) {
        showError(res.error);
      } else {
        showSuccess("Course updated successfully!");
        setCourseModalOpen(false);
        setEditingCourse(null);
        await queryClient.invalidateQueries({ queryKey: ["courses", selectedProgram.id] });
      }
    } else {
      // Create mode
      const res = await createCourseAction({
        program_id: selectedProgram.id,
        title: courseForm.title,
        slug: courseForm.slug,
        duration_minutes: Number(courseForm.duration_minutes),
        status_id: courseForm.status_id || undefined,
        visibility_type_id: courseForm.visibility_type_id || undefined
      });
      if (res.error) {
        showError(res.error);
      } else {
        showSuccess("Course created successfully!");
        setCourseModalOpen(false);
        await queryClient.invalidateQueries({ queryKey: ["courses", selectedProgram.id] });
        if (res.course?.id) {
          handleSelectCourse(res.course.id);
        }
      }
    }
    setSaving(false);
  };

  // Module Submit handler
  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setSaving(true);

    let res;
    if (editingModule) {
      res = await updateModuleAction(editingModule.id, {
        title: moduleForm.title,
        position: Number(moduleForm.position)
      });
    } else {
      res = await createModuleAction({
        course_id: selectedCourseId,
        title: moduleForm.title,
        position: Number(moduleForm.position),
        tenant_id: selectedInstId,
        institution_id: selectedInstId
      });
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Module saved successfully!");
      setModuleModalOpen(false);
      setEditingModule(null);
      await refreshModules(selectedCourseId);
    }
    setSaving(false);
  };

  // Lesson Submit handler
  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleId || !selectedCourseId) return;
    setSaving(true);

    let res;
    if (editingLesson) {
      res = await updateLessonAction(editingLesson.id, {
        title: lessonForm.title,
        lesson_type_id: lessonForm.lesson_type_id || defaultLessonTypeId,
        duration: Number(lessonForm.duration),
        position: Number(lessonForm.position),
        video_url: lessonForm.video_url || undefined,
        content_json: lessonForm.content_text ? { text: lessonForm.content_text, body: lessonForm.content_text } : {}
      });
    } else {
      res = await createLessonAction({
        module_id: targetModuleId,
        title: lessonForm.title,
        lesson_type_id: lessonForm.lesson_type_id || defaultLessonTypeId,
        duration: Number(lessonForm.duration),
        position: Number(lessonForm.position),
        status_id: defaultStatusId,
        tenant_id: selectedInstId,
        institution_id: selectedInstId,
        video_url: lessonForm.video_url || undefined,
        content_json: lessonForm.content_text ? { text: lessonForm.content_text, body: lessonForm.content_text } : {}
      });
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Lesson saved successfully!");
      setLessonModalOpen(false);
      setEditingLesson(null);
      await refreshLessons(targetModuleId);
    }
    setSaving(false);
  };

  // Resource Submit handler
  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLessonId) return;
    setSaving(true);

    const res = await createLessonResourceAction({
      lesson_id: targetLessonId,
      title: resourceForm.title,
      resource_type: resourceForm.resource_type,
      external_url: resourceForm.resource_type === "link" ? resourceForm.external_url : undefined,
      file_url: resourceForm.resource_type === "file" ? resourceForm.file_url : undefined,
      position: 1,
      tenant_id: selectedInstId,
      institution_id: selectedInstId
    });

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Resource attached successfully!");
      setResourceModalOpen(false);
      await refreshResources(targetLessonId);
    }
    setSaving(false);
  };

  const renderExplorerMode = () => {
    return (
      <div className="space-y-6">
        <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
          <div className="bg-[#16171D] px-6 py-4 border-b border-[#23252C] flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider">Ongoing Academic Programs</h4>
            <button
              onClick={() => {
                setProgramForm({ title: "", slug: "", description: "" });
                setProgramModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-[#6E79F4] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Plus size={14} /> Register Program
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#16171D]/40 border-b border-[#23252C] font-bold text-[#C2C6D1]">
                  <th className="px-6 py-3">Program Pathway</th>
                  <th className="px-6 py-3">Timeline Details</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23252C]">
                {programs.length > 0 ? (
                  programs.map((prog) => {
                    const startedDate = new Date(prog.created_at);

                    return (
                      <tr key={prog.id} className="hover:bg-[#16171D]/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#EDEFF5] text-sm">{prog.title}</div>
                          <div className="text-[#C2C6D1] mt-0.5 max-w-sm truncate">{prog.description || "No pathway description provided."}</div>
                          <span className="inline-flex mt-1.5 px-2 py-0.5 bg-[#1A1C22] rounded text-[10px] font-mono text-[#C2C6D1]">/{prog.slug}</span>
                        </td>
                        <td className="px-6 py-4 text-[#C2C6D1] leading-normal font-medium">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Calendar size={11} className="text-[#C2C6D1]" />
                            <span>Registered: {startedDate.toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 overflow-visible relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === prog.id ? null : prog.id)}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                                statuses.find((s) => s.id === prog.status_id)?.code === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80"
                                  : statuses.find((s) => s.id === prog.status_id)?.code === "draft"
                                  ? "bg-[#1A1C22] text-[#E2E4EB] border-[#23252C] hover:bg-[#23252C]/80"
                                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                statuses.find((s) => s.id === prog.status_id)?.code === "active"
                                  ? "bg-emerald-500"
                                  : statuses.find((s) => s.id === prog.status_id)?.code === "draft"
                                  ? "bg-[#3A3F4B]"
                                  : "bg-red-500"
                              }`}></span>
                              {statuses.find((s) => s.id === prog.status_id)?.code.toUpperCase() || "DRAFT"}
                              <ChevronDown size={11} className="opacity-70" />
                            </button>

                            {openDropdownId === prog.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                                <div className="absolute left-0 mt-1.5 w-32 bg-[#131418] border border-[#23252C] rounded-xl shadow-lg z-20 py-1 font-semibold text-[10px] overflow-hidden text-[#E2E4EB]">
                                  {statuses
                                    .filter((s) => ["active", "draft", "disabled"].includes(s.code))
                                    .map((s) => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={async () => {
                                          setOpenDropdownId(null);
                                          const res = await updateProgramAction(prog.id, {
                                            title: prog.title,
                                            slug: prog.slug,
                                            description: prog.description || "",
                                            status_id: s.id,
                                            visibility_type_id: prog.visibility_type_id
                                          });
                                          if (res.error) {
                                            showError(res.error);
                                          } else {
                                            showSuccess("Program status updated successfully!");
                                            await queryClient.invalidateQueries({ queryKey: ["programs", selectedInstId] });
                                          }
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-[#16171D] transition-all flex items-center gap-2"
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-[#3A3F4B]" : "bg-red-500"
                                        }`}></span>
                                        {s.code.toUpperCase()}
                                      </button>
                                    ))}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-[#A3A9B6] font-medium">
                          Status toggling controls access controls
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#C2C6D1] font-medium">
                      No active academic programs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderExamineMode = () => {
    if (!selectedProgram) {
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#23252C]/50 pb-4 mb-6">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider">Select Academic Pathway to Examine</h4>
                <p className="text-[11px] text-[#C2C6D1] mt-0.5">Explore instantiated courses, syllabus modules, lessons, and learning material.</p>
              </div>
              <button
                onClick={() => {
                  setProgramForm({ title: "", slug: "", description: "" });
                  setProgramModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-[#6E79F4] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-xs font-semibold shadow-sm cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus size={14} /> Register Program
              </button>
            </div>

            {programs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programs.map((prog) => {
                  const programStatus = statuses.find((s) => s.id === prog.status_id)?.code || "draft";
                  return (
                    <div 
                      key={prog.id} 
                      className="bg-[#131418] border border-[#23252C] rounded-xl p-5 hover:shadow-md hover:border-[#9BA1AE] transition-all duration-200 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                              programStatus === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : programStatus === "draft"
                                ? "bg-[#1A1C22] text-[#E2E4EB] border-[#23252C]"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}>
                              {programStatus}
                            </span>
                            <span className="text-[9px] font-mono text-[#C2C6D1] truncate">/{prog.slug}</span>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Delete this program pathway and all its instantiated courses?")) {
                                setSaving(true);
                                const res = await deleteProgramAction(prog.id);
                                if (res.error) {
                                  showError(res.error);
                                } else {
                                  showSuccess("Program deleted successfully!");
                                  await queryClient.invalidateQueries({ queryKey: ["programs", selectedInstId] });
                                }
                                setSaving(false);
                              }
                            }}
                            className="p-1 hover:bg-red-50 rounded text-[#C2C6D1] hover:text-red-600 transition-colors shrink-0"
                            title="Delete Program"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <h4 className="font-bold text-sm text-[#EDEFF5]">{prog.title}</h4>
                        <p className="text-xs text-[#C2C6D1] line-clamp-3 min-h-[48px]">{prog.description || "No pathway description provided."}</p>
                      </div>

                      <button
                        onClick={() => setSelectedProgram(prog)}
                        className="mt-6 w-full flex items-center justify-center gap-1 bg-[#6E79F4]/10 hover:bg-[#6E79F4] text-[#6E79F4] hover:text-white px-4 py-2 rounded-lg transition-all text-xs font-semibold cursor-pointer border border-transparent"
                      >
                        Examine Pathway & Syllabus <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-[#C2C6D1] font-medium border border-dashed border-[#23252C] rounded-xl bg-[#16171D]/50">
                No active academic programs found in this campus scope.
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Back navigation header */}
        <div className="flex items-center gap-3 bg-[#131418] border border-[#23252C] px-6 py-4 rounded-xl shadow-sm">
          <button
            onClick={() => setSelectedProgram(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#23252C] hover:bg-[#16171D] text-[#EDEFF5] font-semibold text-xs transition-colors cursor-pointer"
          >
            ← Back to Pathways List
          </button>
          <div className="h-6 w-px bg-[#23252C]" />
          <div>
            <span className="text-[9px] uppercase tracking-wider font-bold text-[#C2C6D1]">Examining Pathway</span>
            <h3 className="font-bold text-[#EDEFF5] text-sm mt-0.5">{selectedProgram.title}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Courses and Actions */}
          <div className="lg:col-span-4 bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-5">
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1]">Pathway Details</h4>
              <p className="text-xs text-[#EDEFF5] leading-relaxed font-medium">{selectedProgram.description || "No pathway description provided."}</p>
              <div className="pt-2 flex items-center justify-between text-[10px] text-[#C2C6D1]">
                <span>Status:</span>
                <span className="capitalize font-bold">{statuses.find((s) => s.id === selectedProgram.status_id)?.code || "Draft"}</span>
              </div>
            </div>

            {/* Status Dropdown inside Examine Mode */}
            <div className="relative inline-block text-left w-full border-t border-[#1F2128] pt-4">
              <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-2">Change Pathway Status</label>
              <button
                onClick={() => setOpenDropdownId(openDropdownId === `examine-${selectedProgram.id}` ? null : `examine-${selectedProgram.id}`)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-bold border flex items-center justify-between cursor-pointer shadow-xs transition-all ${
                  statuses.find((s) => s.id === selectedProgram.status_id)?.code === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80"
                    : statuses.find((s) => s.id === selectedProgram.status_id)?.code === "draft"
                    ? "bg-[#1A1C22] text-[#E2E4EB] border-[#23252C] hover:bg-[#23252C]/80"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    statuses.find((s) => s.id === selectedProgram.status_id)?.code === "active"
                      ? "bg-emerald-500"
                      : statuses.find((s) => s.id === selectedProgram.status_id)?.code === "draft"
                      ? "bg-[#3A3F4B]"
                      : "bg-red-500"
                  }`}></span>
                  {statuses.find((s) => s.id === selectedProgram.status_id)?.code.toUpperCase() || "DRAFT"}
                </span>
                <ChevronDown size={14} className="opacity-70" />
              </button>

              {openDropdownId === `examine-${selectedProgram.id}` && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                  <div className="absolute left-0 right-0 mt-1.5 bg-[#131418] border border-[#23252C] rounded-xl shadow-lg z-20 py-1 font-semibold text-xs overflow-hidden text-[#E2E4EB] animate-fadeIn">
                    {statuses
                      .filter((s) => ["active", "draft", "disabled"].includes(s.code))
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={async () => {
                            setOpenDropdownId(null);
                            const res = await updateProgramAction(selectedProgram.id, {
                              title: selectedProgram.title,
                              slug: selectedProgram.slug,
                              description: selectedProgram.description || "",
                              status_id: s.id,
                              visibility_type_id: selectedProgram.visibility_type_id
                            });
                            if (res.error) {
                              showError(res.error);
                            } else {
                              showSuccess("Program status updated successfully!");
                              await queryClient.invalidateQueries({ queryKey: ["programs", selectedInstId] });
                              const refreshedPrograms = queryClient.getQueryData<Program[]>(["programs", selectedInstId]) || [];
                              const updatedProg = refreshedPrograms.find((p) => p.id === selectedProgram.id);
                              if (updatedProg) setSelectedProgram(updatedProg);
                            }
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#16171D] transition-all flex items-center gap-2"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-[#3A3F4B]" : "bg-red-500"
                          }`}></span>
                          {s.code.toUpperCase()}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[#23252C] pt-4 space-y-3">
              <label htmlFor="program-visibility" className="block text-[10px] font-bold uppercase text-[#C2C6D1]">Program visibility</label>
              <select id="program-visibility" value={selectedProgram.visibility_type_id || ""} disabled={saving}
                className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs text-[#EDEFF5]"
                onChange={async event => {
                  const visibility_type_id = event.target.value;
                  setSaving(true);
                  try {
                    const result = await updateProgramAction(selectedProgram.id, { visibility_type_id });
                    if (result.error) showError(result.error);
                    else {
                      setSelectedProgram({ ...selectedProgram, visibility_type_id });
                      await queryClient.invalidateQueries({ queryKey: ["programs", selectedInstId] });
                      showSuccess("Program visibility updated.");
                    }
                  } finally { setSaving(false); }
                }}>
                <option value="" disabled>Select visibility</option>
                {visibilityTypes.map(type => <option key={type.id} value={type.id}>{type.code}</option>)}
              </select>
            </div>

            <div className="border-t border-[#23252C] pt-4 space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1">
                <Sparkles size={11} className="text-[#6E79F4]" /> Clone Course Blueprint
              </h4>
              <CustomSelect
                options={blueprints.map(bp => {
                  const isAlreadyCloned = courses.some(c => c.source_template_id === bp.id);
                  return { ...bp, name: `${bp.title} ${isAlreadyCloned ? "(Already Cloned)" : ""}`, disabled: isAlreadyCloned };
                })}
                value={selectedBlueprintId}
                onChange={(val) => setSelectedBlueprintId(val)}
                placeholder="-- Choose Library Template --"
              />
              <button
                onClick={handleInstantiation}
                disabled={loading || !selectedBlueprintId}
                className="w-full bg-[#6E79F4] text-white py-2 rounded-lg text-xs font-bold hover:bg-[#6E79F4]/95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? "Cloning..." : "Instantiate to Program"}
              </button>
            </div>
          </div>

          {/* Right panel: Course details, curriculum modules & syllabus */}
          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1]">Instantiated Courses</h4>
                <button
                  onClick={() => {
                    setEditingCourse(null);
                    setCourseForm({ title: "", slug: "", duration_minutes: 60, status_id: statuses.find(status => status.code === "draft")?.id || "", visibility_type_id: visibilityTypes.find(type => type.code === "tenant_only")?.id || "" });
                    setCourseModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-[#6E79F4] hover:underline text-[11px] font-bold cursor-pointer"
                >
                  <Plus size={12} /> New Course
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loadingCourses ? (
                  <div className="sm:col-span-2 py-8 bg-[#131418] border border-dashed border-[#23252C] rounded-xl flex flex-col items-center justify-center">
                    <SecondaryLoader variant="skeleton" message="Loading instantiated courses..." className="!border-0 !p-0 shadow-none bg-transparent" />
                  </div>
                ) : courses.length > 0 ? (
                  courses.map((course) => (
                    <div
                      key={course.id}
                      onClick={() => handleSelectCourse(course.id)}
                      className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between h-28 shadow-sm relative group ${
                        selectedCourseId === course.id
                          ? "bg-[#6E79F4]/5 border-[#6E79F4] text-[#6E79F4] ring-1 ring-[#6E79F4]"
                          : "bg-[#131418] border-[#23252C] hover:border-[#9BA1AE] text-[#EDEFF5]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs truncate max-w-[70%]">{course.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingCourse(course);
                                setCourseForm({ title: course.title, slug: course.slug, duration_minutes: course.duration_minutes ?? 60, status_id: course.status_id || "", visibility_type_id: course.visibility_type_id || "" });
                                setCourseModalOpen(true);
                              }}
                              className="p-0.5 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#6E79F4]"
                              title="Edit Course"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm("Delete this course and all its modules/lessons?")) {
                                  setSaving(true);
                                  const res = await deleteCourseAction(course.id);
                                  if (res.error) {
                                    showError(res.error);
                                  } else {
                                    showSuccess("Course deleted successfully!");
                                    await queryClient.invalidateQueries({ queryKey: ["courses", selectedProgram.id] });
                                    if (selectedCourseId === course.id) {
                                      setSelectedCourseId(null);
                                    }
                                  }
                                  setSaving(false);
                                }
                              }}
                              className="p-0.5 hover:bg-red-50 rounded text-[#A3A9B6] hover:text-red-600"
                              title="Delete Course"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-[#1A1C22] rounded text-[#C2C6D1] font-mono">
                          /{course.slug}
                        </span>
                      </div>
                      <div className="flex items-center justify-end text-[10px] text-[#C2C6D1] pt-2 border-t border-[#1F2128] mt-2">
                        <span className="text-[8px] bg-[#1A1C22] px-1 rounded uppercase font-bold text-[#C2C6D1] font-mono">
                          {course.course_type_id ? "Syllabus Course" : "Live Blueprint"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sm:col-span-2 bg-[#16171D] border border-dashed border-[#23252C] rounded-xl py-8 text-center text-xs text-[#C2C6D1]">
                    No active courses instantiated. Select a blueprint template from the left panel to clone.
                  </div>
                )}
              </div>
            </div>

            {/* Modules list of selected course */}
            {selectedCourseId && (
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2128] pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1]">Syllabus Curriculum Modules</h4>
                  <button
                    onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: "", position: (modulesCache[selectedCourseId]?.length || 0) + 1 });
                      setModuleModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[#6E79F4] hover:underline text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    <Plus size={12} /> New Module
                  </button>
                </div>

                {modulesLoading[selectedCourseId] ? (
                  <div className="py-8 flex flex-col items-center justify-center">
                    <SecondaryLoader variant="skeleton" message="Loading syllabus modules and topics..." className="!border-0 !p-0 shadow-none bg-transparent" />
                  </div>
                ) : (() => {
                  const courseModules = modulesCache[selectedCourseId] || [];
                  return courseModules.length > 0 ? (
                    <div className="space-y-4">
                      {courseModules.map((mod) => {
                        const isExpanded = !!expandedModules[mod.id];
                        const moduleLessons = lessonsCache[mod.id] || [];
                        const isLessonsLoading = !!lessonsLoading[mod.id];

                        return (
                          <div key={mod.id} className="border border-[#23252C] rounded-lg overflow-hidden">
                            {/* Module Header Row */}
                            <div
                              onClick={() => toggleModuleExpand(mod.id)}
                              className="bg-[#16171D]/50 hover:bg-[#16171D] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer border-b border-[#23252C]/40 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isExpanded ? <ChevronDown size={14} className="text-[#C2C6D1] shrink-0" /> : <ChevronRight size={14} className="text-[#C2C6D1] shrink-0" />}
                                <Folder size={14} className="text-[#6E79F4] shrink-0" />
                                <span className="font-bold text-[#EDEFF5] text-xs">
                                  Module {mod.position}: {mod.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setEditingModule(mod);
                                    setModuleForm({ title: mod.title, position: mod.position });
                                    setModuleModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-[#23252C] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                                  title="Edit Module"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this module and all its lessons?")) {
                                      setSaving(true);
                                      const res = await deleteModuleAction(mod.id);
                                      if (res.error) showError(res.error);
                                      else await refreshModules(selectedCourseId);
                                      setSaving(false);
                                    }
                                  }}
                                  className="p-1 hover:bg-red-50 rounded text-[#A3A9B6] hover:text-red-600"
                                  title="Delete Module"
                                >
                                  <Trash2 size={11} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingLesson(null);
                                    setTargetModuleId(mod.id);
                                    setLessonForm({
                                      title: "",
                                      duration: 30,
                                      position: (lessonsCache[mod.id]?.length || 0) + 1,
                                      lesson_type_id: defaultLessonTypeId,
                                      video_url: "",
                                      content_text: ""
                                    });
                                    setLessonModalOpen(true);
                                  }}
                                  className="flex items-center gap-0.5 text-[#6E79F4] hover:underline text-[10px] font-bold px-1.5 py-0.5 hover:bg-[#6E79F4]/5 rounded"
                                >
                                  <Plus size={10} /> Add Lesson
                                </button>
                              </div>
                            </div>

                            {/* Module Lessons Container with Animation */}
                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                              <div className="overflow-hidden">
                                <div className="p-4 bg-[#131418] space-y-3 divide-y divide-[#1F2128]">
                                  {isLessonsLoading ? (
                                    <SecondaryLoader variant="skeleton" message="Loading lessons..." className="!border-0 !p-2 shadow-none bg-transparent" />
                                  ) : moduleLessons.length > 0 ? (
                                    moduleLessons.map((les) => {
                                      const isLessonExpanded = !!expandedLessons[les.id];
                                      const lessonResources = resourcesCache[les.id] || [];
                                      const lessonTypeObj = lessonTypes.find(t => t.id === les.lesson_type_id);
                                      const lessonTypeName = lessonTypeObj?.name || "Topic";

                                      return (
                                        <div key={les.id} className="pt-3 first:pt-0 space-y-2">
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                            <div
                                              onClick={() => toggleLessonExpand(les.id)}
                                              className="flex items-center gap-1.5 cursor-pointer text-[#EDEFF5] hover:text-[#6E79F4] transition-colors min-w-0"
                                            >
                                              {isLessonExpanded ? <ChevronDown size={12} className="text-[#C2C6D1] shrink-0" /> : <ChevronRight size={12} className="text-[#C2C6D1] shrink-0" />}
                                              <span className="font-semibold">{les.position}. {les.title}</span>
                                              <span className="text-[9px] bg-[#1A1C22] px-1.5 py-0.5 rounded text-[#C2C6D1] border border-[#23252C] capitalize font-medium shrink-0">{lessonTypeName}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 pl-5 sm:pl-0 shrink-0">
                                              <button
                                                onClick={() => {
                                                  setEditingLesson(les);
                                                  setTargetModuleId(mod.id);
                                                  setLessonForm({
                                                    title: les.title,
                                                    duration: les.duration || 30,
                                                    position: les.position || 1,
                                                    lesson_type_id: les.lesson_type_id || "",
                                                    video_url: les.video_url || "",
                                                    content_text: les.content_json?.text || les.content_json?.body || ""
                                                  });
                                                  setLessonModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                                                title="Edit Lesson"
                                              >
                                                <Edit size={10} />
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (confirm("Delete this lesson topic?")) {
                                                    setSaving(true);
                                                    const res = await deleteLessonAction(les.id);
                                                    if (res.error) showError(res.error);
                                                    else await refreshLessons(mod.id);
                                                    setSaving(false);
                                                  }
                                                }}
                                                className="p-1 hover:bg-red-50 rounded text-[#A3A9B6] hover:text-red-600"
                                                title="Delete Lesson"
                                              >
                                                <Trash2 size={10} />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setTargetLessonId(les.id);
                                                  setResourceForm({ title: "", resource_type: "link", external_url: "", file_url: "" });
                                                  setResourceModalOpen(true);
                                                }}
                                                className="text-[#6E79F4] hover:underline text-[9px] font-bold"
                                              >
                                                + Resource
                                              </button>
                                            </div>
                                          </div>

                                          {/* Expandable Lesson detail block with animation */}
                                          <div className={`grid transition-all duration-300 ease-in-out ${isLessonExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                            <div className="overflow-hidden pl-6">
                                              <div className="bg-[#16171D]/40 border border-[#23252C]/50 p-3 rounded-lg space-y-3 mt-2">
                                                {les.video_url && (
                                                  <div className="flex items-center gap-1.5 text-[10px] text-[#6E79F4]">
                                                    <Video size={12} />
                                                    <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-0.5">
                                                      Video pathway link <ExternalLink size={10} />
                                                    </a>
                                                  </div>
                                                )}

                                                {(les.content_json?.text || les.content_json?.body) && (
                                                  <div className="bg-[#131418] p-3 rounded border border-[#23252C]/40 text-xs text-[#EDEFF5] max-w-none">
                                                    <MarkdownRenderer content={les.content_json.text || les.content_json.body} />
                                                  </div>
                                                )}

                                                {/* Lesson Resources List */}
                                                <div className="space-y-1.5 pt-1 border-t border-[#1F2128]">
                                                  <p className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Lesson Attachments</p>
                                                  {resourcesCache[les.id] ? (
                                                    lessonResources.length > 0 ? (
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {lessonResources.map((res) => (
                                                          <div key={res.id} className="bg-[#131418] border border-[#23252C]/60 rounded p-2 flex items-center justify-between text-[11px]">
                                                            <span className="font-medium text-[#EDEFF5] truncate max-w-[80%] flex items-center gap-1">
                                                              <FileText size={10} className="text-[#C2C6D1]" />
                                                              {res.title}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                              <a href={res.external_url || res.file_url || undefined} target="_blank" rel="noopener noreferrer" className="p-0.5 hover:bg-[#1A1C22] rounded text-[#6E79F4]">
                                                                <ExternalLink size={10} />
                                                              </a>
                                                              <button
                                                                onClick={async () => {
                                                                  if (confirm("Detach this asset resource?")) {
                                                                    await deleteLessonResourceAction(res.id);
                                                                    await refreshResources(les.id);
                                                                  }
                                                                }}
                                                                className="p-0.5 hover:bg-red-50 rounded text-[#A3A9B6] hover:text-red-600"
                                                              >
                                                                <Trash2 size={10} />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <p className="text-[9px] text-[#C2C6D1] italic font-sans">No resources attached to this lesson.</p>
                                                    )
                                                  ) : (
                                                    <SecondaryLoader variant="skeleton" message="Loading resource attachments..." className="!border-0 !p-1 shadow-none bg-transparent" />
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-[10px] text-[#C2C6D1] italic py-2">No lessons in this module.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#C2C6D1] italic border border-dashed border-[#23252C] rounded-xl bg-[#16171D]/50">
                      No curriculum modules defined.
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Scope banner */}
      <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#C2C6D1] flex items-center gap-1.5">
          <Folder size={15} className="text-[#6E79F4]" /> Live Program Scope
        </h3>
        <p className="text-xs text-[#C2C6D1] mb-4">
          Select an institution scope below to explore registered programs and instantiated syllabus courses.
        </p>
        <CustomSelect
          options={institutions.map((inst) => ({ id: inst.id, name: inst.name, code: inst.institution_code }))}
          value={selectedInstId}
          onChange={handleCampusChange}
          placeholder="-- Select Institution Campus --"
          className="max-w-md"
        />
      </div>

      {selectedInstId && (
        programError || courseError ? (
          <div role="alert" className="p-6 border border-red-400/30 rounded-xl text-sm">
            <p>Unable to load academic {programError ? "programs" : "courses"}.</p>
            <button type="button" className="mt-3 underline" onClick={() => void (programError ? retryPrograms() : retryCourses())}>Retry</button>
          </div>
        ) : loadingPrograms ? (
          <div className="py-16 bg-[#131418] border border-[#23252C] rounded-xl flex flex-col items-center justify-center shadow-sm animate-fadeIn">
            <SecondaryLoader variant="spinner" message="Loading campus programs..." />
          </div>
        ) : (
          mode === "explorer" ? renderExplorerMode() : renderExamineMode()
        )
      )}
      {/* Program Create Drawer */}
      {programModalOpen && (
        <>
          <div
            onClick={() => setProgramModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/35 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">Register Program</h3>
              <button onClick={() => setProgramModalOpen(false)} className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5 cursor-pointer rounded-full hover:bg-[#1A1C22] transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleProgramSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Program Title *</label>
                <input
                  type="text"
                  placeholder="e.g. AI Foundations"
                  value={programForm.title}
                  onChange={(e) => {
                    setProgramForm({
                      ...programForm,
                      title: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                    });
                  }}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Program Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. ai-foundations"
                  value={programForm.slug}
                  onChange={(e) => setProgramForm({ ...programForm, slug: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Description</label>
                <textarea
                  placeholder="Program objectives, pathway roadmap..."
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  rows={4}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none text-[#EDEFF5]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#23252C]/60 mt-6 flex-wrap">
                <button type="button" onClick={() => setProgramModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Program
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Course Edit/Create Drawer */}
      {courseModalOpen && (
        <>
          <div
            onClick={() => setCourseModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/35 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">{editingCourse ? "Edit Course Pathway" : "Create Course Pathway"}</h3>
              <button onClick={() => setCourseModalOpen(false)} className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5 cursor-pointer rounded-full hover:bg-[#1A1C22] transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCourseSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label htmlFor="course-title" className="block font-semibold mb-1 text-[#C2C6D1]">Course Title *</label>
                <input
                  type="text" id="course-title"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ 
                    ...courseForm, 
                    title: e.target.value,
                    slug: editingCourse ? courseForm.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                  })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label htmlFor="course-slug" className="block font-semibold mb-1 text-[#C2C6D1]">Course Slug *</label>
                <input
                  type="text" id="course-slug"
                  value={courseForm.slug}
                  onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="course-duration" className="block font-semibold mb-1 text-[#C2C6D1]">Duration (minutes)</label>
                  <input
                    type="number" id="course-duration"
                    value={courseForm.duration_minutes}
                    onChange={(e) => setCourseForm({ ...courseForm, duration_minutes: Number(e.target.value) })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="course-status" className="block font-semibold mb-1 text-[#C2C6D1]">Course status</label>
                  <select id="course-status" value={courseForm.status_id} required
                    onChange={event => setCourseForm({ ...courseForm, status_id: event.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs text-[#EDEFF5]">
                    <option value="" disabled>Select status</option>
                    {statuses.map(status => <option key={status.id} value={status.id}>{status.code}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="course-visibility" className="block font-semibold mb-1 text-[#C2C6D1]">Course visibility</label>
                  <select id="course-visibility" value={courseForm.visibility_type_id} required
                    onChange={event => setCourseForm({ ...courseForm, visibility_type_id: event.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs text-[#EDEFF5]">
                    <option value="" disabled>Select visibility</option>
                    {visibilityTypes.map(type => <option key={type.id} value={type.id}>{type.code}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#23252C]/60 mt-6 flex-wrap">
                <button type="button" onClick={() => setCourseModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Module Create/Edit Drawer */}
      {moduleModalOpen && (
        <>
          <div
            onClick={() => setModuleModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/35 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">{editingModule ? "Edit Module" : "Create New Module"}</h3>
              <button onClick={() => setModuleModalOpen(false)} className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5 cursor-pointer rounded-full hover:bg-[#1A1C22] transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleModuleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Module Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Getting Started"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Position Order *</label>
                <input
                  type="number"
                  value={moduleForm.position}
                  onChange={(e) => setModuleForm({ ...moduleForm, position: Number(e.target.value) })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#23252C]/60 mt-6 flex-wrap">
                <button type="button" onClick={() => setModuleModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Module
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Lesson Create/Edit Drawer */}
      {lessonModalOpen && (
        <>
          <div
            onClick={() => setLessonModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/35 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">{editingLesson ? "Edit Lesson" : "Create New Lesson"}</h3>
              <button onClick={() => setLessonModalOpen(false)} className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5 cursor-pointer rounded-full hover:bg-[#1A1C22] transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleLessonSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Title *</label>
                <input
                  type="text"
                  placeholder="e.g. 1.1 Intro to Layouts"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Type *</label>
                <select
                  value={lessonForm.lesson_type_id || defaultLessonTypeId}
                  onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_id: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs text-[#EDEFF5] focus:outline-none focus:border-[#6E79F4] shadow-sm"
                >
                  {lessonTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.description || t.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Position Order *</label>
                <input
                  type="number"
                  value={lessonForm.position}
                  onChange={(e) => setLessonForm({ ...lessonForm, position: Number(e.target.value) })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Video URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://example.com/video.mp4"
                  value={lessonForm.video_url}
                  onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Structured Content / Text (Optional)</label>
                <textarea
                  placeholder="Type lesson text content..."
                  value={lessonForm.content_text}
                  onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                  rows={4}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5] resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#23252C]/60 mt-6 flex-wrap">
                <button type="button" onClick={() => setLessonModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Lesson
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Resource Attachment Drawer */}
      {resourceModalOpen && (
        <>
          <div
            onClick={() => setResourceModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/35 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">Attach Lesson Resource</h3>
              <button onClick={() => setResourceModalOpen(false)} className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5 cursor-pointer rounded-full hover:bg-[#1A1C22] transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleResourceSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Resource Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Reference Guide PDF"
                  value={resourceForm.title}
                  onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#C2C6D1]">Resource Type *</label>
                <select
                  value={resourceForm.resource_type}
                  onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                  className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-2.5 py-1.5 text-xs text-[#EDEFF5] focus:outline-none focus:border-[#6E79F4] shadow-sm"
                >
                  <option value="link">External URL Link</option>
                  <option value="file">File Attachment</option>
                </select>
              </div>

              {resourceForm.resource_type === "link" ? (
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">External URL *</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    value={resourceForm.external_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">File Storage URL *</label>
                  <input
                    type="text"
                    placeholder="https://storage.hynox.com/file.pdf"
                    value={resourceForm.file_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#23252C]/60 mt-6 flex-wrap">
                <button type="button" onClick={() => setResourceModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Attach Resource
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  );
}
