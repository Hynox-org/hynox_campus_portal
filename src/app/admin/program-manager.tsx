"use client";

import React, { useState, useEffect } from "react";
import { 
  createProgramAction, 
  deleteProgramAction, 
  listProgramsAction,
  listCoursesAction,
  listModulesAction,
  listLessonsAction,
  listLessonResourcesAction,
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  createLessonResourceAction,
  deleteLessonResourceAction,
  updateCourseAction,
  getAcademicLookupsAction,
  updateProgramAction
} from "@/app/actions/academic-actions";
import { listCourseTemplatesAction, instantiateCourseTemplateAction } from "@/app/actions/library-actions";
import { 
  Folder, Plus, Trash2, X, ChevronRight, ChevronDown, 
  BookOpen, PlusCircle, CheckCircle2, AlertCircle, 
  FileText, Calendar, Clock, Sparkles, Edit, Play, Video, ExternalLink
} from "lucide-react";

interface ProgramManagerProps {
  institutions: any[];
  mode?: "explorer" | "examine";
  selectedInstId: string;
  setSelectedInstId: (id: string) => void;
  selectedProgram: any | null;
  setSelectedProgram: (prog: any | null) => void;
}

export default function ProgramManager({ 
  institutions, 
  mode = "explorer",
  selectedInstId,
  setSelectedInstId,
  selectedProgram,
  setSelectedProgram
}: ProgramManagerProps) {
  const [programs, setPrograms] = useState<any[]>([]);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");

  // Cached data map to prevent refetches
  const [modulesCache, setModulesCache] = useState<Record<string, any[]>>({});
  const [lessonsCache, setLessonsCache] = useState<Record<string, any[]>>({});
  const [resourcesCache, setResourcesCache] = useState<Record<string, any[]>>({});

  // Loading states
  const [loading, setLoading] = useState(false);
  const [modulesLoading, setModulesLoading] = useState<Record<string, boolean>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals / forms for Programs
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programForm, setProgramForm] = useState({ title: "", slug: "", description: "" });

  // Lookups data for editing lessons
  const [lessonTypes, setLessonTypes] = useState<any[]>([]);
  const [defaultStatusId, setDefaultStatusId] = useState("");
  const [defaultLessonTypeId, setDefaultLessonTypeId] = useState("");
  const [statuses, setStatuses] = useState<any[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modals / forms for Course Editing
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", slug: "", duration_minutes: 60 });

  // Modals / forms for Modules
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", position: 1 });

  // Modals / forms for Lessons
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    duration: 30,
    position: 1,
    lesson_type_id: "",
    video_url: "",
    content_text: "",
    is_preview: false
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

  // Fetch blueprints and lookups on mount
  useEffect(() => {
    async function loadInitialData() {
      const bRes = await listCourseTemplatesAction();
      if (bRes.templates) {
        setBlueprints(bRes.templates);
      }
      const lRes = await getAcademicLookupsAction();
      if (lRes.success && lRes.lookups) {
        setLessonTypes(lRes.lookups.lessonTypes);
        setStatuses(lRes.lookups.statuses);
        const textType = lRes.lookups.lessonTypes.find((t: any) => t.code === "text") || lRes.lookups.lessonTypes[0];
        if (textType) setDefaultLessonTypeId(textType.id);
        const activeStatus = lRes.lookups.statuses.find((s: any) => s.code === "active") || lRes.lookups.statuses[0];
        if (activeStatus) setDefaultStatusId(activeStatus.id);
      }
    }
    loadInitialData();
  }, []);

  // Fetch programs when institution changes
  useEffect(() => {
    if (!selectedInstId) {
      setPrograms([]);
      setSelectedProgram(null);
      return;
    }
    // Reset selection to prevent cross-institution leakage
    setSelectedProgram(null);

    async function loadPrograms() {
      setLoading(true);
      setError("");
      const res = await listProgramsAction(selectedInstId);
      if (res.programs) {
        setPrograms(res.programs);
      } else if (res.error) {
        setError(res.error);
      }
      setLoading(false);
    }
    loadPrograms();
  }, [selectedInstId]);

  // Fetch courses when selected program changes (Examine mode)
  useEffect(() => {
    if (!selectedProgram) {
      setCourses([]);
      setSelectedCourseId(null);
      return;
    }
    async function loadCourses() {
      setLoading(true);
      setError("");
      const res = await listCoursesAction(selectedProgram.id);
      if (res.courses) {
        setCourses(res.courses);
        if (res.courses.length > 0) {
          handleSelectCourse(res.courses[0].id);
        } else {
          setSelectedCourseId(null);
        }
      } else if (res.error) {
        setError(res.error);
      }
      setLoading(false);
    }
    loadCourses();
  }, [selectedProgram]);

  // Lazy load modules for a specific course
  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId);
    if (modulesCache[courseId]) return; // use cache

    setModulesLoading(prev => ({ ...prev, [courseId]: true }));
    const res = await listModulesAction(courseId);
    if (res.modules) {
      setModulesCache(prev => ({ ...prev, [courseId]: res.modules }));
    }
    setModulesLoading(prev => ({ ...prev, [courseId]: false }));
  };

  const refreshModules = async (courseId: string) => {
    setModulesLoading(prev => ({ ...prev, [courseId]: true }));
    const res = await listModulesAction(courseId);
    if (res.modules) {
      setModulesCache(prev => ({ ...prev, [courseId]: res.modules }));
    }
    setModulesLoading(prev => ({ ...prev, [courseId]: false }));
  };

  // Lazy load lessons for a module
  const toggleModuleExpand = async (moduleId: string) => {
    const isExpanded = !!expandedModules[moduleId];
    setExpandedModules(prev => ({ ...prev, [moduleId]: !isExpanded }));

    if (isExpanded || lessonsCache[moduleId]) return; // already loaded or collapsing

    setLessonsLoading(prev => ({ ...prev, [moduleId]: true }));
    const res = await listLessonsAction(moduleId);
    if (res.lessons) {
      setLessonsCache(prev => ({ ...prev, [moduleId]: res.lessons }));
    }
    setLessonsLoading(prev => ({ ...prev, [moduleId]: false }));
  };

  const refreshLessons = async (moduleId: string) => {
    setLessonsLoading(prev => ({ ...prev, [moduleId]: true }));
    const res = await listLessonsAction(moduleId);
    if (res.lessons) {
      setLessonsCache(prev => ({ ...prev, [moduleId]: res.lessons }));
    }
    setLessonsLoading(prev => ({ ...prev, [moduleId]: false }));
  };

  // Lazy load resources for a lesson
  const toggleLessonExpand = async (lessonId: string) => {
    const isExpanded = !!expandedLessons[lessonId];
    setExpandedLessons(prev => ({ ...prev, [lessonId]: !isExpanded }));

    if (isExpanded || resourcesCache[lessonId]) return;

    const res = await listLessonResourcesAction(lessonId);
    if (res.resources) {
      setResourcesCache(prev => ({ ...prev, [lessonId]: res.resources }));
    }
  };

  const refreshResources = async (lessonId: string) => {
    const res = await listLessonResourcesAction(lessonId);
    if (res.resources) {
      setResourcesCache(prev => ({ ...prev, [lessonId]: res.resources }));
    }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await createProgramAction({
      ...programForm,
      tenant_id: selectedInstId,
      institution_id: selectedInstId
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Program registered successfully!");
      setProgramModalOpen(false);
      setProgramForm({ title: "", slug: "", description: "" });
      const reloadRes = await listProgramsAction(selectedInstId);
      if (reloadRes.programs) setPrograms(reloadRes.programs);
    }
    setLoading(false);
  };

  const handleInstantiation = async () => {
    if (!selectedBlueprintId || !selectedProgram) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await instantiateCourseTemplateAction(
      selectedBlueprintId,
      selectedProgram.id,
      selectedInstId,
      selectedInstId
    );

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Course template instantiated successfully!");
      setSelectedBlueprintId("");
      
      const cRes = await listCoursesAction(selectedProgram.id);
      if (cRes.courses) {
        setCourses(cRes.courses);
        if (cRes.courses.length > 0) {
          handleSelectCourse(cRes.courses[cRes.courses.length - 1].id);
        }
      }
    }
    setLoading(false);
  };

  // Course Edit handler
  const handleCourseEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !selectedProgram) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await updateCourseAction(editingCourse.id, {
      title: courseForm.title,
      slug: courseForm.slug,
      duration_minutes: Number(courseForm.duration_minutes)
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Course updated successfully!");
      setCourseModalOpen(false);
      setEditingCourse(null);
      const cRes = await listCoursesAction(selectedProgram.id);
      if (cRes.courses) setCourses(cRes.courses);
    }
    setLoading(false);
  };

  // Module Submit handler
  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setLoading(true);
    setError("");
    setSuccess("");

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
      setError(res.error);
    } else {
      setSuccess("Module saved successfully!");
      setModuleModalOpen(false);
      setEditingModule(null);
      await refreshModules(selectedCourseId);
    }
    setLoading(false);
  };

  // Lesson Submit handler
  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleId || !selectedCourseId) return;
    setLoading(true);
    setError("");
    setSuccess("");

    let res;
    if (editingLesson) {
      res = await updateLessonAction(editingLesson.id, {
        title: lessonForm.title,
        lesson_type_id: lessonForm.lesson_type_id || defaultLessonTypeId,
        duration: Number(lessonForm.duration),
        position: Number(lessonForm.position),
        video_url: lessonForm.video_url || undefined,
        content_json: lessonForm.content_text ? { text: lessonForm.content_text, body: lessonForm.content_text } : {},
        is_preview: lessonForm.is_preview
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
        content_json: lessonForm.content_text ? { text: lessonForm.content_text, body: lessonForm.content_text } : {},
        is_preview: lessonForm.is_preview
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Lesson saved successfully!");
      setLessonModalOpen(false);
      setEditingLesson(null);
      await refreshLessons(targetModuleId);
    }
    setLoading(false);
  };

  // Resource Submit handler
  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLessonId) return;
    setLoading(true);
    setError("");
    setSuccess("");

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
      setError(res.error);
    } else {
      setSuccess("Resource attached successfully!");
      setResourceModalOpen(false);
      await refreshResources(targetLessonId);
    }
    setLoading(false);
  };

  const renderExplorerMode = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider">Ongoing Academic Programs</h4>
            <button
              onClick={() => {
                setProgramForm({ title: "", slug: "", description: "" });
                setProgramModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-[#0066cc] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#0066cc]/95 transition-all text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Plus size={14} /> Register Program
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/40 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                  <th className="px-6 py-3">Program Pathway</th>
                  <th className="px-6 py-3">Timeline Details</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]">
                {programs.length > 0 ? (
                  programs.map((prog) => {
                    const startedDate = new Date(prog.created_at);

                    return (
                      <tr key={prog.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#1d1d1f] text-sm">{prog.title}</div>
                          <div className="text-[#86868b] mt-0.5 max-w-sm truncate">{prog.description || "No pathway description provided."}</div>
                          <span className="inline-flex mt-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-[#86868b]">/{prog.slug}</span>
                        </td>
                        <td className="px-6 py-4 text-[#86868b] leading-normal font-medium">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Calendar size={11} className="text-[#86868b]" />
                            <span>Registered: {startedDate.toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 overflow-visible relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === prog.id ? null : prog.id)}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                                statuses.find((s: any) => s.id === prog.status_id)?.code === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80"
                                  : statuses.find((s: any) => s.id === prog.status_id)?.code === "draft"
                                  ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80"
                                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                statuses.find((s: any) => s.id === prog.status_id)?.code === "active"
                                  ? "bg-emerald-500"
                                  : statuses.find((s: any) => s.id === prog.status_id)?.code === "draft"
                                  ? "bg-slate-400"
                                  : "bg-red-500"
                              }`}></span>
                              {statuses.find((s: any) => s.id === prog.status_id)?.code.toUpperCase() || "DRAFT"}
                              <ChevronDown size={11} className="opacity-70" />
                            </button>

                            {openDropdownId === prog.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                                <div className="absolute left-0 mt-1.5 w-32 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 font-semibold text-[10px] overflow-hidden text-slate-700">
                                  {statuses
                                    .filter((s: any) => ["active", "draft", "disabled"].includes(s.code))
                                    .map((s: any) => (
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
                                            setError(res.error);
                                          } else {
                                            setSuccess("Program status updated successfully!");
                                            const reloadRes = await listProgramsAction(selectedInstId);
                                            if (reloadRes.programs) setPrograms(reloadRes.programs);
                                          }
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-all flex items-center gap-2"
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-slate-400" : "bg-red-500"
                                        }`}></span>
                                        {s.code.toUpperCase()}
                                      </button>
                                    ))}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 font-medium">
                          Status toggling controls access controls
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#86868b] font-medium">
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
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left selector column */}
        <div className="lg:col-span-4 bg-white border border-[#d2d2d7] rounded-xl p-4 shadow-sm space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Select Program pathway</h4>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {programs.length > 0 ? (
              programs.map((prog) => {
                const programStatus = statuses.find((s: any) => s.id === prog.status_id)?.code || "draft";
                return (
                  <div
                    key={prog.id}
                    onClick={() => setSelectedProgram(prog)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      selectedProgram?.id === prog.id
                        ? "bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]"
                        : "bg-slate-50/50 hover:bg-slate-50 border-[#d2d2d7] text-[#1d1d1f]"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="font-semibold truncate">{prog.title}</p>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold border capitalize shrink-0 ${
                          programStatus === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : programStatus === "draft"
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {programStatus}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#86868b] font-mono truncate">/{prog.slug}</p>
                    </div>
                    <ChevronRight size={13} className={selectedProgram?.id === prog.id ? "text-[#0066cc]" : "text-[#86868b]"} />
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-[#86868b] text-center py-4 bg-slate-50/50 rounded-lg">No active programs found.</p>
            )}
          </div>

          {selectedProgram && (
            <div className="border-t border-[#d2d2d7] pt-4 mt-2 space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-1">
                <Sparkles size={11} className="text-[#0066cc]" /> Clone Course Blueprint
              </h4>
              <select
                value={selectedBlueprintId}
                onChange={(e) => setSelectedBlueprintId(e.target.value)}
                className="w-full bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
              >
                <option value="">-- Choose Library Template --</option>
                {blueprints.map((bp) => {
                  const isAlreadyCloned = courses.some(c => c.source_template_id === bp.id);
                  return (
                    <option key={bp.id} value={bp.id} disabled={isAlreadyCloned}>
                      {bp.title} {isAlreadyCloned ? "(Already Cloned)" : ""}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={handleInstantiation}
                disabled={loading || !selectedBlueprintId}
                className="w-full bg-[#0066cc] text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-[#0066cc]/95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? "Cloning..." : "Instantiate to Program"}
              </button>
            </div>
          )}
        </div>

        {/* Right workspace details column */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProgram ? (
            <div className="space-y-6">
              
              {/* Program details premium header */}
              <div className="bg-white border border-[#d2d2d7] rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#1d1d1f] font-sans">{selectedProgram.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-100 text-[#475569] border-[#E2E8F0] capitalize">
                        {statuses.find((s: any) => s.id === selectedProgram.status_id)?.code.toUpperCase() || "DRAFT"}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#86868b] font-mono mt-0.5">Slug: /{selectedProgram.slug}</p>
                  </div>

                  {/* Status Dropdown inside Examine Mode */}
                  <div className="relative inline-block text-left self-start sm:self-center">
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === `examine-${selectedProgram.id}` ? null : `examine-${selectedProgram.id}`)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                        statuses.find((s: any) => s.id === selectedProgram.status_id)?.code === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80"
                          : statuses.find((s: any) => s.id === selectedProgram.status_id)?.code === "draft"
                          ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        statuses.find((s: any) => s.id === selectedProgram.status_id)?.code === "active"
                          ? "bg-emerald-500"
                          : statuses.find((s: any) => s.id === selectedProgram.status_id)?.code === "draft"
                          ? "bg-slate-400"
                          : "bg-red-500"
                      }`}></span>
                      Status: {statuses.find((s: any) => s.id === selectedProgram.status_id)?.code.toUpperCase() || "DRAFT"}
                      <ChevronDown size={11} className="opacity-70" />
                    </button>

                    {openDropdownId === `examine-${selectedProgram.id}` && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-0 mt-1.5 w-32 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 font-semibold text-[10px] overflow-hidden text-slate-700">
                          {statuses
                            .filter((s: any) => ["active", "draft", "disabled"].includes(s.code))
                            .map((s: any) => (
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
                                    setError(res.error);
                                  } else {
                                    setSuccess("Program status updated successfully!");
                                    const reloadRes = await listProgramsAction(selectedInstId);
                                    if (reloadRes.programs) {
                                      setPrograms(reloadRes.programs);
                                      const updatedProg = reloadRes.programs.find((p: any) => p.id === selectedProgram.id);
                                      if (updatedProg) setSelectedProgram(updatedProg);
                                    }
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-all flex items-center gap-2"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-slate-400" : "bg-red-500"
                                }`}></span>
                                {s.code.toUpperCase()}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {selectedProgram.description && (
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {selectedProgram.description}
                  </p>
                )}
              </div>

              {/* Courses list */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Instantiated Courses</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {courses.length > 0 ? (
                    courses.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => handleSelectCourse(course.id)}
                        className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between h-28 shadow-sm relative group ${
                          selectedCourseId === course.id
                            ? "bg-[#0066cc]/5 border-[#0066cc] text-[#0066cc] ring-1 ring-[#0066cc]"
                            : "bg-white border-[#d2d2d7] hover:border-[#86868b] text-[#1d1d1f]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate max-w-[80%]">{course.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCourse(course);
                                  setCourseForm({ title: course.title, slug: course.slug, duration_minutes: course.duration_minutes || 60 });
                                  setCourseModalOpen(true);
                                }}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-[#0066cc]"
                                title="Edit Course"
                              >
                                <Edit size={12} />
                              </button>
                            </div>
                          </div>
                          <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-[#86868b] font-mono">
                            /{course.slug}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#86868b] pt-2 border-t border-slate-100 mt-2">
                          <span className="font-semibold">{course.duration_minutes || 0} Minutes</span>
                          <span className="text-[8px] bg-slate-100 px-1 rounded uppercase font-bold text-[#86868b] font-mono">
                            {course.course_type_id ? "Syllabus Course" : "Live Blueprint"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="sm:col-span-2 bg-slate-50 border border-dashed border-[#d2d2d7] rounded-xl py-8 text-center text-xs text-[#86868b]">
                      No active courses instantiated. Select a blueprint template from the left pane to clone.
                    </div>
                  )}
                </div>
              </div>

              {/* Modules list of selected course */}
              {selectedCourseId && (
                <div className="bg-white border border-[#d2d2d7] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Syllabus Curriculum Modules</h4>
                    <button
                      onClick={() => {
                        setEditingModule(null);
                        setModuleForm({ title: "", position: (modulesCache[selectedCourseId]?.length || 0) + 1 });
                        setModuleModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-[#0066cc] hover:underline text-[11px] font-bold cursor-pointer"
                    >
                      <Plus size={12} /> Add Module
                    </button>
                  </div>

                  {modulesLoading[selectedCourseId] ? (
                    <div className="py-8 text-center text-xs text-[#86868b] font-medium">
                      Loading syllabus modules...
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {modulesCache[selectedCourseId] && modulesCache[selectedCourseId].length > 0 ? (
                        modulesCache[selectedCourseId].map((mod) => {
                          const isModExpanded = !!expandedModules[mod.id];
                          const hasLessons = lessonsCache[mod.id] && lessonsCache[mod.id].length > 0;

                          return (
                            <div key={mod.id} className="border border-[#d2d2d7] rounded-lg overflow-hidden text-xs bg-slate-50/10">
                              
                              {/* Module Expand Toggle Header */}
                              <div
                                className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer select-none bg-white font-semibold text-[#1d1d1f] border-b border-slate-100"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1" onClick={() => toggleModuleExpand(mod.id)}>
                                  {isModExpanded ? <ChevronDown size={13} className="text-[#86868b]" /> : <ChevronRight size={13} className="text-[#86868b]" />}
                                  <span>Module {mod.position}: {mod.title}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingModule(mod);
                                      setModuleForm({ title: mod.title, position: mod.position || 1 });
                                      setModuleModalOpen(true);
                                    }}
                                    className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 hover:bg-slate-100 rounded"
                                    title="Edit Module"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm("Delete this module and all its lessons?")) {
                                        const delRes = await deleteModuleAction(mod.id);
                                        if (delRes.error) setError(delRes.error);
                                        else await refreshModules(selectedCourseId);
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
                                    title="Delete Module"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  <span className="text-[9px] text-[#86868b] font-mono bg-slate-100 px-1 rounded shrink-0">
                                    {lessonsCache[mod.id]?.length !== undefined ? `${lessonsCache[mod.id].length} Lessons` : "View Lessons"}
                                  </span>
                                </div>
                              </div>

                              {/* Lessons container */}
                              {isModExpanded && (
                                <div className="p-3 pl-6 space-y-2 bg-slate-50/30 border-t border-slate-50">
                                  <div className="flex justify-end mb-1">
                                    <button
                                      onClick={() => {
                                        setTargetModuleId(mod.id);
                                        setEditingLesson(null);
                                        setLessonForm({ 
                                          title: "", 
                                          duration: 30, 
                                          position: (lessonsCache[mod.id]?.length || 0) + 1,
                                          lesson_type_id: defaultLessonTypeId,
                                          video_url: "",
                                          content_text: "",
                                          is_preview: false
                                        });
                                        setLessonModalOpen(true);
                                      }}
                                      className="flex items-center gap-1 text-[#0066cc] hover:underline text-[10px] font-bold cursor-pointer"
                                    >
                                      <Plus size={11} /> Add Lesson
                                    </button>
                                  </div>

                                  {lessonsLoading[mod.id] ? (
                                    <div className="text-[10px] text-[#86868b] py-2 italic">Loading lessons...</div>
                                  ) : hasLessons ? (
                                    lessonsCache[mod.id].map((les) => {
                                      const isLesExpanded = !!expandedLessons[les.id];
                                      const hasResources = resourcesCache[les.id] && resourcesCache[les.id].length > 0;

                                      return (
                                        <div key={les.id} className="border border-slate-200 rounded-lg p-2.5 bg-white space-y-2">
                                          
                                          {/* Lesson node header */}
                                          <div
                                            className="flex items-center justify-between cursor-pointer select-none"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1" onClick={() => toggleLessonExpand(les.id)}>
                                              {isLesExpanded ? <ChevronDown size={12} className="text-[#86868b]" /> : <ChevronRight size={12} className="text-[#86868b]" />}
                                              <span className="font-medium text-[#1d1d1f] truncate">{les.title}</span>
                                              <span className="text-[8px] bg-slate-100 text-[#86868b] px-1 rounded uppercase font-mono font-bold shrink-0">{les.lesson_type?.code || "lesson"}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 shrink-0">
                                              <span className="text-[10px] text-[#86868b] font-mono shrink-0">{les.duration || 0} mins</span>
                                              <button
                                                onClick={() => {
                                                  setTargetModuleId(mod.id);
                                                  setEditingLesson(les);
                                                  setLessonForm({ 
                                                    title: les.title, 
                                                    duration: les.duration || 30, 
                                                    position: les.position || 1,
                                                    lesson_type_id: les.lesson_type_id || defaultLessonTypeId,
                                                    video_url: les.video_url || "",
                                                    content_text: les.content_json?.text || les.content_json?.body || "",
                                                    is_preview: !!les.is_preview
                                                  });
                                                  setLessonModalOpen(true);
                                                }}
                                                className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 hover:bg-slate-100 rounded"
                                                title="Edit Lesson"
                                              >
                                                <Edit size={11} />
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (confirm("Delete this lesson?")) {
                                                    const delRes = await deleteLessonAction(les.id);
                                                    if (delRes.error) setError(delRes.error);
                                                    else await refreshLessons(mod.id);
                                                  }
                                                }}
                                                className="text-red-500 hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
                                                title="Delete Lesson"
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Lesson resources list (lazy loaded) */}
                                          {isLesExpanded && (
                                            <div className="border-t border-slate-100 pt-2 mt-2 space-y-2 pl-4">
                                              {les.video_url && (
                                                <div className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                                                  <Play size={10} className="fill-[#0066cc] text-[#0066cc] shrink-0" />
                                                  <span className="font-semibold text-slate-700 font-sans">Video Link:</span>
                                                  <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-[#0066cc] font-bold flex-1 font-mono">
                                                    {les.video_url}
                                                  </a>
                                                </div>
                                              )}

                                              {(les.content_json?.text || les.content_json?.body) && (
                                                <div className="text-[10px] bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-[#475569] leading-relaxed whitespace-pre-wrap font-sans">
                                                  <p className="font-semibold text-slate-700 mb-0.5">Content Description:</p>
                                                  {les.content_json?.text || les.content_json?.body}
                                                </div>
                                              )}

                                              <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                                                <span className="text-[9px] uppercase font-bold text-[#86868b] font-sans">Attached Resources</span>
                                                <button
                                                  onClick={() => {
                                                    setTargetLessonId(les.id);
                                                    setResourceForm({ title: "", resource_type: "link", external_url: "", file_url: "" });
                                                    setResourceModalOpen(true);
                                                  }}
                                                  className="flex items-center gap-1 text-[#0066cc] hover:underline text-[9px] font-bold cursor-pointer font-sans"
                                                >
                                                  <Plus size={10} /> Add Resource
                                                </button>
                                              </div>
                                              {resourcesCache[les.id] ? (
                                                hasResources ? (
                                                  resourcesCache[les.id].map((res: any) => (
                                                    <div key={res.id} className="flex items-center justify-between text-[10px] text-[#86868b] py-1 bg-slate-50 px-2 rounded">
                                                      <div className="flex items-center gap-1.5 min-w-0">
                                                        <FileText size={10} className="shrink-0" />
                                                        {res.external_url || res.file_url ? (
                                                          <a
                                                            href={res.external_url || res.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="truncate hover:underline text-[#0066cc] font-semibold font-sans"
                                                          >
                                                            {res.title}
                                                          </a>
                                                        ) : (
                                                          <span className="truncate font-medium font-sans">{res.title}</span>
                                                        )}
                                                        <span className="text-[8px] bg-slate-200 text-[#86868b] px-1 rounded uppercase font-bold shrink-0 font-mono">{res.resource_type}</span>
                                                      </div>
                                                      <button
                                                        onClick={async () => {
                                                          if (confirm("Delete this resource?")) {
                                                            const delRes = await deleteLessonResourceAction(res.id);
                                                            if (delRes.error) setError(delRes.error);
                                                            else await refreshResources(les.id);
                                                          }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
                                                        title="Delete Resource"
                                                      >
                                                        <Trash2 size={11} />
                                                      </button>
                                                    </div>
                                                  ))
                                                ) : (
                                                  <p className="text-[9px] text-[#86868b] italic font-sans">No resources attached to this lesson.</p>
                                                )
                                              ) : (
                                                <p className="text-[9px] text-[#86868b] italic font-sans">Loading resource attachments...</p>
                                              )}
                                            </div>
                                          )}

                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-[10px] text-[#86868b] italic">No lessons in this module.</p>
                                  )}
                                </div>
                              )}

                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-[#86868b] italic">
                          No curriculum modules defined.
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          ) : (
            <div className="bg-white border border-[#d2d2d7] rounded-xl p-12 text-center text-xs text-[#86868b] shadow-sm">
              <Folder className="mx-auto mb-2 text-[#86868b]/40" size={32} />
              <p className="font-semibold text-[#1d1d1f]">Select a program from the left pane</p>
              <p className="mt-1">Inspect course listings and navigate modular curriculum topics.</p>
            </div>
          )}
        </div>

      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Scope banner */}
      <div className="bg-white border border-[#d2d2d7] p-6 rounded-xl shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#86868b] flex items-center gap-1.5">
          <Folder size={15} className="text-[#0066cc]" /> Live Program Scope
        </h3>
        <p className="text-xs text-[#86868b] mb-4">
          Select an institution scope below to explore registered programs and instantiated syllabus courses.
        </p>
        <select
          value={selectedInstId}
          onChange={(e) => setSelectedInstId(e.target.value)}
          className="w-full max-w-md bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
        >
          <option value="">-- Select Institution Campus --</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.institution_code})
            </option>
          ))}
        </select>
      </div>

      {/* Global alert messages */}
      {error && (
        <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 text-xs flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {selectedInstId && (
        mode === "explorer" ? renderExplorerMode() : renderExamineMode()
      )}

      {/* Program Create Modal */}
      {programModalOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#1d1d1f] animate-fadeIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#1d1d1f]">Create New Program</h3>
              <button onClick={() => setProgramModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleProgramSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Program Title *</label>
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
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Program Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. ai-foundations"
                  value={programForm.slug}
                  onChange={(e) => setProgramForm({ ...programForm, slug: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-mono text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Description</label>
                <textarea
                  placeholder="Program objectives, pathway roadmap..."
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm resize-none text-[#1d1d1f]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d2d2d7]">
                <button type="button" onClick={() => setProgramModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d2d2d7] hover:bg-slate-50 font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#0066cc] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0066cc]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Edit Modal */}
      {courseModalOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#1d1d1f] animate-fadeIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#1d1d1f]">Edit Course Pathway</h3>
              <button onClick={() => setCourseModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCourseEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Course Title *</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Course Slug *</label>
                <input
                  type="text"
                  value={courseForm.slug}
                  onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-mono text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Duration (Minutes) *</label>
                <input
                  type="number"
                  value={courseForm.duration_minutes}
                  onChange={(e) => setCourseForm({ ...courseForm, duration_minutes: Number(e.target.value) })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d2d2d7]">
                <button type="button" onClick={() => setCourseModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d2d2d7] hover:bg-slate-50 font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#0066cc] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0066cc]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module Create/Edit Modal */}
      {moduleModalOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#1d1d1f] animate-fadeIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#1d1d1f]">{editingModule ? "Edit Module" : "Create New Module"}</h3>
              <button onClick={() => setModuleModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleModuleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Module Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Getting Started"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Position Order *</label>
                <input
                  type="number"
                  value={moduleForm.position}
                  onChange={(e) => setModuleForm({ ...moduleForm, position: Number(e.target.value) })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d2d2d7]">
                <button type="button" onClick={() => setModuleModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d2d2d7] hover:bg-slate-50 font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#0066cc] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0066cc]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Create/Edit Modal */}
      {lessonModalOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#1d1d1f] animate-fadeIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#1d1d1f]">{editingLesson ? "Edit Lesson" : "Create New Lesson"}</h3>
              <button onClick={() => setLessonModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleLessonSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Lesson Title *</label>
                <input
                  type="text"
                  placeholder="e.g. 1.1 Intro to Layouts"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Lesson Type *</label>
                <select
                  value={lessonForm.lesson_type_id || defaultLessonTypeId}
                  onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_id: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
                >
                  {lessonTypes.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.description || t.code}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#86868b]">Duration (Minutes) *</label>
                  <input
                    type="number"
                    value={lessonForm.duration}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#86868b]">Position Order *</label>
                  <input
                    type="number"
                    value={lessonForm.position}
                    onChange={(e) => setLessonForm({ ...lessonForm, position: Number(e.target.value) })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Video URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://example.com/video.mp4"
                  value={lessonForm.video_url}
                  onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Structured Content / Text (Optional)</label>
                <textarea
                  placeholder="Type lesson text content..."
                  value={lessonForm.content_text}
                  onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                  rows={4}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f] resize-y"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lesson-is-preview"
                  checked={lessonForm.is_preview}
                  onChange={(e) => setLessonForm({ ...lessonForm, is_preview: e.target.checked })}
                  className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]"
                />
                <label htmlFor="lesson-is-preview" className="font-semibold text-[#86868b] select-none cursor-pointer">
                  Available as free preview
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d2d2d7]">
                <button type="button" onClick={() => setLessonModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d2d2d7] hover:bg-slate-50 font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#0066cc] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0066cc]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Save Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resource Attachment Modal */}
      {resourceModalOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#1d1d1f] animate-fadeIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#1d1d1f]">Attach Lesson Resource</h3>
              <button onClick={() => setResourceModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleResourceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Resource Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Reference Guide PDF"
                  value={resourceForm.title}
                  onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#86868b]">Resource Type *</label>
                <select
                  value={resourceForm.resource_type}
                  onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                  className="w-full bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
                >
                  <option value="link">External URL Link</option>
                  <option value="file">File Attachment</option>
                </select>
              </div>

              {resourceForm.resource_type === "link" ? (
                <div>
                  <label className="block font-semibold mb-1 text-[#86868b]">External URL *</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    value={resourceForm.external_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold mb-1 text-[#86868b]">File Storage URL *</label>
                  <input
                    type="text"
                    placeholder="https://storage.hynox.com/file.pdf"
                    value={resourceForm.file_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d2d2d7]">
                <button type="button" onClick={() => setResourceModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d2d2d7] hover:bg-slate-50 font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-[#0066cc] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0066cc]/95 transition-colors disabled:opacity-50 cursor-pointer">
                  Attach Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
