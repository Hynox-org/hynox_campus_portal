"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createCourseTemplateAction,
  updateCourseTemplateAction,
  deleteCourseTemplateAction,
  createModuleTemplateAction,
  updateModuleTemplateAction,
  deleteModuleTemplateAction,
  createLessonTemplateAction,
  updateLessonTemplateAction,
  deleteLessonTemplateAction,
  createResourceTemplateAction,
  deleteResourceTemplateAction
} from "@/app/actions/library-actions";
import {
  useCourseTemplates,
  libraryKeys,
  fetchModuleTemplates,
  fetchLessonTemplates,
  fetchResourceTemplates
} from "@/hooks/use-library";
import { 
  BookOpen, Plus, Edit, Trash2, X, FolderPlus, 
  Folder, ArrowRight, Save, Clock, ChevronRight, 
  ChevronDown, FileText, Link2, ExternalLink, Sparkles, Play
} from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SecondaryLoader } from "@/components/secondary-loader";
import { useToast } from "@/components/toast";

export default function LibraryBuilder() {
  const queryClient = useQueryClient();
  const { data: courseTemplates = [], isLoading: loading } = useCourseTemplates();
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Lazy Loaded Cache States (Consistent with program-manager.tsx)
  const [modulesCache, setModulesCache] = useState<Record<string, any[]>>({});
  const [lessonsCache, setLessonsCache] = useState<Record<string, any[]>>({});
  const [resourcesCache, setResourcesCache] = useState<Record<string, any[]>>({});

  // Loading indicator maps for individual nodes
  const [modulesLoading, setModulesLoading] = useState<Record<string, boolean>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({});
  
  const [saving, setSaving] = useState(false);
  const [courseDataLoading, setCourseDataLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  // Node toggle states
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});

  // Drawer states
  const [courseDrawerOpen, setCourseDrawerOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [isCourseTypeDropdownOpen, setIsCourseTypeDropdownOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: "",
    slug: "",
    description: "",
    course_type_code: "theory",
    enrollment_mode: "open",
    duration_minutes: 60,
    thumbnail_path: "",
    is_published: false
  });

  const [moduleDrawerOpen, setModuleDrawerOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
    position: 1
  });

  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [lessonForm, setLessonForm] = useState({
    title: "",
    lesson_type_code: "text",
    content_text: "",
    video_url: "",
    duration: 15,
    position: 1
  });

  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [resourceForm, setResourceForm] = useState({
    title: "",
    resource_type: "link",
    file_url: "",
    external_url: "",
    position: 1
  });

  // Scroll lock when any sidebar drawer is open to prevent background viewport scrolling
  useEffect(() => {
    const isOpen = courseDrawerOpen || moduleDrawerOpen || lessonDrawerOpen || resourceDrawerOpen;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [courseDrawerOpen, moduleDrawerOpen, lessonDrawerOpen, resourceDrawerOpen]);

  // Lazy load modules for a specific course, backed by the React Query cache
  const handleSelectCourse = async (courseId: string) => {
    const course = courseTemplates.find((c: any) => c.id === courseId);
    if (course) setSelectedCourse(course);

    if (modulesCache[courseId]) return; // use local cache

    setCourseDataLoading(true);
    try {
      const modulesList = await fetchModuleTemplates(queryClient, courseId);
      setModulesCache(prev => ({ ...prev, [courseId]: modulesList }));

      // Fetch lessons for all modules in parallel
      const lessonsResults = await Promise.all(
        modulesList.map(async (mod: any) => ({
          moduleId: mod.id,
          lessons: await fetchLessonTemplates(queryClient, mod.id)
        }))
      );
      const newLessonsCache: Record<string, any[]> = {};
      const allLessonsToFetch: any[] = [];

      lessonsResults.forEach(item => {
        newLessonsCache[item.moduleId] = item.lessons;
        allLessonsToFetch.push(...item.lessons);
      });

      setLessonsCache(prev => ({ ...prev, ...newLessonsCache }));

      // Fetch resources for all lessons in parallel
      const resourcesResults = await Promise.all(
        allLessonsToFetch.map(async (les: any) => ({
          lessonId: les.id,
          resources: await fetchResourceTemplates(queryClient, les.id)
        }))
      );
      const newResourcesCache: Record<string, any[]> = {};

      resourcesResults.forEach(item => {
        newResourcesCache[item.lessonId] = item.resources;
      });

      setResourcesCache(prev => ({ ...prev, ...newResourcesCache }));
    } catch (err) {
      console.error("Error loading complete course blueprint curriculum:", err);
    } finally {
      setCourseDataLoading(false);
    }
  };

  const refreshModules = async (courseId: string) => {
    setModulesLoading(prev => ({ ...prev, [courseId]: true }));
    await queryClient.invalidateQueries({ queryKey: libraryKeys.moduleTemplates(courseId) });
    const modules = await fetchModuleTemplates(queryClient, courseId);
    setModulesCache(prev => ({ ...prev, [courseId]: modules }));
    setModulesLoading(prev => ({ ...prev, [courseId]: false }));
  };

  // Lazy load lessons for a module
  const toggleModuleExpand = async (moduleId: string) => {
    const isExpanded = !!expandedModules[moduleId];
    setExpandedModules(prev => ({ ...prev, [moduleId]: !isExpanded }));

    if (isExpanded || lessonsCache[moduleId]) return; // already loaded or collapsing

    setLessonsLoading(prev => ({ ...prev, [moduleId]: true }));
    const lessons = await fetchLessonTemplates(queryClient, moduleId);
    setLessonsCache(prev => ({ ...prev, [moduleId]: lessons }));
    setLessonsLoading(prev => ({ ...prev, [moduleId]: false }));
  };

  const refreshLessons = async (moduleId: string) => {
    setLessonsLoading(prev => ({ ...prev, [moduleId]: true }));
    await queryClient.invalidateQueries({ queryKey: libraryKeys.lessonTemplates(moduleId) });
    const lessons = await fetchLessonTemplates(queryClient, moduleId);
    setLessonsCache(prev => ({ ...prev, [moduleId]: lessons }));
    setLessonsLoading(prev => ({ ...prev, [moduleId]: false }));
  };

  // Lazy load resources for a lesson
  const toggleLessonExpand = async (lessonId: string) => {
    const isExpanded = !!expandedLessons[lessonId];
    setExpandedLessons(prev => ({ ...prev, [lessonId]: !isExpanded }));

    if (isExpanded || resourcesCache[lessonId]) return;

    const resources = await fetchResourceTemplates(queryClient, lessonId);
    setResourcesCache(prev => ({ ...prev, [lessonId]: resources }));
  };

  const refreshResources = async (lessonId: string) => {
    await queryClient.invalidateQueries({ queryKey: libraryKeys.resourceTemplates(lessonId) });
    const resources = await fetchResourceTemplates(queryClient, lessonId);
    setResourcesCache(prev => ({ ...prev, [lessonId]: resources }));
  };

  const refreshCourseList = async (keepSelectedId?: string) => {
    await queryClient.invalidateQueries({ queryKey: libraryKeys.courseTemplates });
    if (keepSelectedId) {
      const templates = queryClient.getQueryData<any[]>(libraryKeys.courseTemplates) || [];
      const updated = templates.find((t: any) => t.id === keepSelectedId);
      if (updated) setSelectedCourse(updated);
    }
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let res;
    if (editingCourse) {
      res = await updateCourseTemplateAction(editingCourse.id, courseForm);
    } else {
      res = await createCourseTemplateAction(courseForm);
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Course template saved successfully!");
      setCourseDrawerOpen(false);
      const savedId = editingCourse?.id;
      setEditingCourse(null);
      await refreshCourseList(savedId);
    }
    setSaving(false);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let res;
    if (editingModule) {
      res = await updateModuleTemplateAction(editingModule.id, moduleForm);
    } else {
      res = await createModuleTemplateAction({
        ...moduleForm,
        course_template_id: selectedCourse.id
      });
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Module template saved!");
      setModuleDrawerOpen(false);
      setEditingModule(null);
      await refreshModules(selectedCourse.id);
    }
    setSaving(false);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const content_json = {
      body: lessonForm.content_text,
      text: lessonForm.content_text
    };

    let res;
    if (editingLesson) {
      res = await updateLessonTemplateAction(editingLesson.id, {
        title: lessonForm.title,
        lesson_type_code: lessonForm.lesson_type_code,
        content_json,
        video_url: lessonForm.video_url || undefined,
        duration: lessonForm.duration,
        position: lessonForm.position
      });
    } else {
      res = await createLessonTemplateAction({
        module_template_id: selectedModuleId,
        title: lessonForm.title,
        lesson_type_code: lessonForm.lesson_type_code,
        content_json,
        video_url: lessonForm.video_url || undefined,
        duration: lessonForm.duration,
        position: lessonForm.position
      });
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Lesson template saved!");
      setLessonDrawerOpen(false);
      setEditingLesson(null);
      await refreshLessons(selectedModuleId);
    }
    setSaving(false);
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const res = await createResourceTemplateAction({
      lesson_template_id: selectedLessonId,
      title: resourceForm.title,
      resource_type: resourceForm.resource_type,
      file_url: resourceForm.file_url || undefined,
      external_url: resourceForm.external_url || undefined,
      position: resourceForm.position
    });

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Resource template added!");
      setResourceDrawerOpen(false);
      await refreshResources(selectedLessonId);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 col-span-full w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left selector column */}
        <div className="lg:col-span-4 bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#6E79F4]" /> Course Blueprints
            </h4>
            <button
              onClick={() => {
                setEditingCourse(null);
                setIsCourseTypeDropdownOpen(false);
                setCourseForm({
                  title: "",
                  slug: "",
                  description: "",
                  course_type_code: "theory",
                  enrollment_mode: "open",
                  duration_minutes: 60,
                  thumbnail_path: "",
                  is_published: false
                });
                setCourseDrawerOpen(true);
              }}
              className="flex items-center gap-1 bg-[#6E79F4] text-white px-2.5 py-1 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-[10px] font-bold shadow-sm cursor-pointer"
            >
              <Plus size={12} /> New Template
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search blueprints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#16171D] border border-[#23252C] rounded-lg px-3 py-1.5 text-xs text-[#EDEFF5] focus:outline-none focus:border-[#6E79F4] focus:bg-[#131418] transition-all pl-7"
            />
            <span className="absolute left-2.5 top-2 text-[#C2C6D1]/60 text-[10px]">🔍</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <SecondaryLoader variant="skeleton" message="Loading course blueprints..." className="!border-0 !p-0 shadow-none mt-2" />
            ) : (() => {
              const filtered = courseTemplates.filter(c =>
                c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.slug.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (filtered.length > 0) {
                return filtered.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectCourse(template.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-2 relative ${
                      selectedCourse?.id === template.id
                        ? "bg-[#6E79F4]/5 border-[#6E79F4]/40 text-[#6E79F4] shadow-xs"
                        : "bg-[#131418] hover:bg-[#16171D] border-[#23252C] text-[#EDEFF5]"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                        <p className="font-sans font-semibold text-[13px] text-[#EDEFF5] hover:text-[#6E79F4] transition-colors truncate">{template.title}</p>
                      </div>
                      <span className="text-[8px] bg-[#1A1C22] text-[#C2C6D1] px-1 rounded uppercase font-bold shrink-0 font-mono border border-[#23252C]">
                        {template.course_type_code || "theory"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end text-[9px] text-[#C2C6D1] border-t border-[#1F2128]/80 pt-1.5 mt-0.5">
                      <span className="font-semibold text-[#6E79F4] flex items-center gap-0.5">
                        View details <ChevronRight size={10} />
                      </span>
                    </div>
                  </div>
                ));
              }

              return (
                <p className="text-[11px] text-[#C2C6D1] text-center py-4 bg-[#16171D]/50 rounded-lg">No course templates found.</p>
              );
            })()}
          </div>
        </div>

        {/* Right workspace details column */}
        <div className="lg:col-span-8 space-y-6">
          {courseDataLoading ? (
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-12 text-center text-xs text-[#C2C6D1] shadow-sm flex flex-col items-center justify-center min-h-[300px]">
              <SecondaryLoader variant="spinner" message="Loading full course blueprint data (modules, lessons & resources)..." />
            </div>
          ) : selectedCourse ? (
            <div className="space-y-6">
              
              {/* Selected Blueprint Detail Header */}
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm relative group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-bold text-[#6E79F4] tracking-wider bg-[#6E79F4]/10 px-2 py-0.5 rounded border border-[#6E79F4]/25">
                        Blueprint Blueprint
                      </span>
                      <span className="text-[9px] bg-[#1A1C22] text-[#C2C6D1] px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                        {selectedCourse.course_type_code || "theory"}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#EDEFF5] mt-2 flex items-center gap-2">
                      {selectedCourse.title}
                    </h3>
                    <p className="text-xs text-[#C2C6D1] mt-1 line-clamp-2">
                      {selectedCourse.description || "No description set for this blueprint."}
                    </p>
                    <p className="text-[10px] text-[#C2C6D1] mt-1.5 font-mono">
                      Slug: /{selectedCourse.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingCourse(selectedCourse);
                        setIsCourseTypeDropdownOpen(false);
                        setCourseForm({
                          title: selectedCourse.title,
                          slug: selectedCourse.slug,
                          description: selectedCourse.description || "",
                          course_type_code: selectedCourse.course_type_code || "theory",
                          enrollment_mode: selectedCourse.enrollment_mode || "open",
                          duration_minutes: selectedCourse.duration_minutes || 60,
                          thumbnail_path: selectedCourse.thumbnail_path || "",
                          is_published: selectedCourse.is_published || false
                        });
                        setCourseDrawerOpen(true);
                      }}
                      className="p-1 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                      title="Edit Blueprint"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this course template blueprint?")) {
                          const res = await deleteCourseTemplateAction(selectedCourse.id);
                          if (res.error) showError(res.error);
                          else {
                            showSuccess("Course blueprint deleted!");
                            setSelectedCourse(null);
                            await refreshCourseList();
                          }
                        }
                      }}
                      className="p-1 hover:bg-red-50 rounded text-[#F0555D] hover:text-red-700"
                      title="Delete Blueprint"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modules list of selected course blueprint */}
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#1F2128] pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                    <FolderPlus size={14} className="text-[#6E79F4]" /> Blueprint Structure (Modules & Lessons)
                  </h4>
                  <button
                    onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: "", description: "", position: (modulesCache[selectedCourse.id]?.length || 0) + 1 });
                      setModuleDrawerOpen(true);
                    }}
                    className="flex items-center gap-1 text-[#6E79F4] hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    <Plus size={12} /> Add Module Template
                  </button>
                </div>

                {modulesLoading[selectedCourse.id] ? (
                  <SecondaryLoader variant="skeleton" message="Loading blueprint modules..." className="!border-0 !p-0 shadow-none bg-transparent" />
                ) : (
                  <div className="space-y-2.5">
                    {modulesCache[selectedCourse.id] && modulesCache[selectedCourse.id].length > 0 ? (
                      modulesCache[selectedCourse.id].map((mod) => {
                        const isModExpanded = !!expandedModules[mod.id];
                        const hasLessons = lessonsCache[mod.id] && lessonsCache[mod.id].length > 0;

                        return (
                          <div key={mod.id} className="border border-[#23252C] rounded-lg overflow-hidden text-xs bg-[#16171D]/10">
                            
                            {/* Module Expand Toggle Header */}
                            <div
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-[#16171D] cursor-pointer select-none bg-[#131418] font-semibold text-[#EDEFF5] border-b border-[#1F2128]"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1" onClick={() => toggleModuleExpand(mod.id)}>
                                {isModExpanded ? <ChevronDown size={13} className="text-[#C2C6D1]" /> : <ChevronRight size={13} className="text-[#C2C6D1]" />}
                                <span>Module {mod.position}: {mod.title}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingModule(mod);
                                    setModuleForm({ 
                                      title: mod.title, 
                                      description: mod.description || "",
                                      position: mod.position || 1 
                                    });
                                    setModuleDrawerOpen(true);
                                  }}
                                  className="text-[#C2C6D1] hover:text-[#EDEFF5] p-0.5 hover:bg-[#1A1C22] rounded"
                                  title="Edit Module"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this module and all its lessons?")) {
                                      const delRes = await deleteModuleTemplateAction(mod.id);
                                      if (delRes.error) showError(delRes.error);
                                      else await refreshModules(selectedCourse.id);
                                    }
                                  }}
                                  className="text-[#F0555D] hover:text-red-700 p-0.5 hover:bg-[#1A1C22] rounded"
                                  title="Delete Module"
                                >
                                  <Trash2 size={12} />
                                </button>
                                <span className="text-[9px] text-[#C2C6D1] font-mono bg-[#1A1C22] px-1 rounded shrink-0">
                                  {lessonsCache[mod.id]?.length !== undefined ? `${lessonsCache[mod.id].length} Lessons` : "View Lessons"}
                                </span>
                              </div>
                            </div>

                            {/* Lessons container */}
                            <div className={`grid transition-all duration-300 ease-in-out ${isModExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                              <div className="overflow-hidden">
                                <div className="p-3 pl-6 space-y-2 bg-[#16171D]/30 border-t border-[#1A1C22]">
                                <div className="flex justify-end mb-1">
                                  <button
                                    onClick={() => {
                                      setSelectedModuleId(mod.id);
                                      setEditingLesson(null);
                                      setLessonForm({ 
                                        title: "", 
                                        lesson_type_code: "text",
                                        content_text: "",
                                        video_url: "",
                                        duration: 15,
                                        position: (lessonsCache[mod.id]?.length || 0) + 1
                                      });
                                      setLessonDrawerOpen(true);
                                    }}
                                    className="flex items-center gap-1 text-[#6E79F4] hover:underline text-[10px] font-bold cursor-pointer"
                                  >
                                    <Plus size={11} /> Add Lesson Template
                                  </button>
                                </div>

                                {lessonsLoading[mod.id] ? (
                                  <SecondaryLoader variant="skeleton" message="Loading lessons..." className="!border-0 !p-2 shadow-none bg-transparent" />
                                ) : hasLessons ? (
                                  lessonsCache[mod.id].map((les) => {
                                    const isLesExpanded = !!expandedLessons[les.id];
                                    const hasResources = resourcesCache[les.id] && resourcesCache[les.id].length > 0;

                                    return (
                                      <div key={les.id} className="border border-[#23252C] rounded-lg p-2.5 bg-[#131418] space-y-2">
                                        
                                        {/* Lesson node header */}
                                        <div
                                          className="flex items-center justify-between cursor-pointer select-none"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1" onClick={() => toggleLessonExpand(les.id)}>
                                            {isLesExpanded ? <ChevronDown size={12} className="text-[#C2C6D1]" /> : <ChevronRight size={12} className="text-[#C2C6D1]" />}
                                            <span className="font-medium text-[#EDEFF5] truncate">{les.title}</span>
                                            <span className="text-[8px] bg-[#1A1C22] text-[#C2C6D1] px-1 rounded uppercase font-mono font-bold shrink-0">{les.lesson_type_code || "text"}</span>
                                          </div>
                                          <div className="flex items-center gap-2.5 shrink-0">
                                            <button
                                              onClick={() => {
                                                setSelectedModuleId(mod.id);
                                                setEditingLesson(les);
                                                setLessonForm({ 
                                                  title: les.title, 
                                                  lesson_type_code: les.lesson_type_code,
                                                  content_text: les.content_json?.body || les.content_json?.text || "",
                                                  video_url: les.video_url || "",
                                                  duration: les.duration || 15,
                                                  position: les.position || 1
                                                });
                                                setLessonDrawerOpen(true);
                                              }}
                                              className="text-[#C2C6D1] hover:text-[#EDEFF5] p-0.5 hover:bg-[#1A1C22] rounded"
                                              title="Edit Lesson"
                                            >
                                              <Edit size={11} />
                                            </button>
                                            <button
                                              onClick={async () => {
                                                if (confirm("Delete this lesson template?")) {
                                                  const delRes = await deleteLessonTemplateAction(les.id);
                                                  if (delRes.error) showError(delRes.error);
                                                  else await refreshLessons(mod.id);
                                                }
                                              }}
                                              className="text-[#F0555D] hover:text-red-700 p-0.5 hover:bg-[#1A1C22] rounded"
                                              title="Delete Lesson"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Lesson resources list (lazy loaded) */}
                                        <div className={`grid transition-all duration-300 ease-in-out ${isLesExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                          <div className="overflow-hidden">
                                            <div className="border-t border-[#1F2128] pt-2 mt-2 space-y-2 pl-4">
                                            {les.video_url && (
                                              <div className="flex items-center gap-1.5 text-[10px] bg-[#16171D] px-2 py-1.5 rounded-lg border border-[#23252C]">
                                                <Play size={10} className="fill-[#6E79F4] text-[#6E79F4] shrink-0" />
                                                <span className="font-semibold text-[#E2E4EB]">Video Link:</span>
                                                <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-[#6E79F4] font-bold flex-1">
                                                  {les.video_url}
                                                </a>
                                              </div>
                                            )}
                                            {(les.content_json?.body || les.content_json?.text) && (
                                              <div className="bg-[#16171D] border border-[#23252C] p-4 rounded-xl space-y-2 shadow-inner">
                                                <div className="flex justify-between items-center border-b border-[#23252C]/50 pb-1">
                                                  <span className="font-bold text-[#C2C6D1] text-[8px] uppercase tracking-wider font-sans">Blueprint Learning Content (Markdown)</span>
                                                  <span className="text-[8px] bg-[#23252C] text-[#C2C6D1] px-1.5 py-0.2 rounded font-mono font-bold">Rendered</span>
                                                </div>
                                                <div className="max-h-80 overflow-y-auto pr-1">
                                                  <MarkdownRenderer content={les.content_json.body || les.content_json.text} />
                                                </div>
                                              </div>
                                            )}
                                            <div className="flex items-center justify-between border-b border-[#1A1C22] pb-1 mb-1">
                                              <span className="text-[9px] uppercase font-bold text-[#C2C6D1]">Attached Resources</span>
                                              <button
                                                onClick={() => {
                                                  setSelectedLessonId(les.id);
                                                  setResourceForm({ title: "", resource_type: "link", external_url: "", file_url: "", position: (resourcesCache[les.id]?.length || 0) + 1 });
                                                  setResourceDrawerOpen(true);
                                                }}
                                                className="flex items-center gap-1 text-[#6E79F4] hover:underline text-[9px] font-bold cursor-pointer"
                                              >
                                                <Plus size={10} /> Add Resource Blueprint
                                              </button>
                                            </div>
                                            {resourcesCache[les.id] ? (
                                              hasResources ? (
                                                resourcesCache[les.id].map((resrc: any) => (
                                                  <div key={resrc.id} className="flex items-center justify-between text-[10px] text-[#C2C6D1] py-1 bg-[#16171D] px-2 rounded">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <FileText size={10} className="shrink-0" />
                                                      <span className="truncate">{resrc.title}</span>
                                                      <span className="text-[8px] bg-[#23252C] text-[#C2C6D1] px-1 rounded uppercase font-bold shrink-0">{resrc.resource_type}</span>
                                                      {(resrc.file_url || resrc.external_url) && (
                                                        <a 
                                                          href={resrc.file_url || resrc.external_url} 
                                                          target="_blank" 
                                                          rel="noopener noreferrer" 
                                                          className="text-[#6E79F4] hover:underline shrink-0"
                                                        >
                                                          <ExternalLink size={9} />
                                                        </a>
                                                      )}
                                                    </div>
                                                    <button
                                                      onClick={async () => {
                                                        if (confirm("Delete this resource template?")) {
                                                          const delRes = await deleteResourceTemplateAction(resrc.id);
                                                          if (delRes.error) showError(delRes.error);
                                                          else await refreshResources(les.id);
                                                        }
                                                      }}
                                                      className="text-[#F0555D] hover:text-red-700 p-0.5 hover:bg-[#1A1C22] rounded"
                                                      title="Delete Resource"
                                                    >
                                                      <Trash2 size={11} />
                                                    </button>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-[9px] text-[#C2C6D1] italic">No resources attached to this lesson.</p>
                                              )
                                            ) : (
                                              <SecondaryLoader variant="skeleton" message="Loading resource attachments..." className="!border-0 !p-1 shadow-none bg-transparent" />
                                            )}
                                            </div>
                                          </div>
                                        </div>

                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-[10px] text-[#C2C6D1] italic">No lessons in this module.</p>
                                )}
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-[#C2C6D1] italic">
                        No curriculum modules defined.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-12 text-center text-xs text-[#C2C6D1] shadow-sm">
              <BookOpen className="mx-auto mb-2 text-[#C2C6D1]/40" size={32} />
              <p className="font-semibold text-[#EDEFF5]">Select a Course Blueprint from the left pane</p>
              <p className="mt-1">Manage nested syllabus templates, lessons, and assets without affecting student live classes.</p>
            </div>
          )}
        </div>

      </div>

      {/* Course Blueprint Right Sidebar Panel (Drawer) */}
      {courseDrawerOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setCourseDrawerOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#6E79F4]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <BookOpen size={16} className="text-[#6E79F4]" /> {editingCourse ? "Edit Course Blueprint" : "Create Course Blueprint"}
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Define metadata and structures for courses cloned later into paths.</p>
              </div>
              <button
                onClick={() => setCourseDrawerOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCourseSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Blueprint Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. React Fundamentals"
                    value={courseForm.title}
                    onChange={(e) => {
                      setCourseForm({
                        ...courseForm,
                        title: e.target.value,
                        slug: editingCourse ? courseForm.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                      });
                    }}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Blueprint URL Slug *</label>
                  <input
                    type="text"
                    placeholder="e.g. react-fundamentals"
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Description</label>
                  <textarea
                    placeholder="Course blueprint details, objectives..."
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none text-[#EDEFF5]"
                  />
                </div>

                <div className="space-y-1 relative">
                  <label className="block font-bold text-[#C2C6D1]">Course Type *</label>
                  <button
                    type="button"
                    onClick={() => setIsCourseTypeDropdownOpen(!isCourseTypeDropdownOpen)}
                    onBlur={() => setTimeout(() => setIsCourseTypeDropdownOpen(false), 200)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium text-[#EDEFF5] flex justify-between items-center cursor-pointer"
                  >
                    <span>
                      {courseForm.course_type_code === "theory" && "Theory"}
                      {courseForm.course_type_code === "hybrid" && "Hybrid"}
                      {courseForm.course_type_code === "project" && "Project-based"}
                    </span>
                    <ChevronDown size={14} className={`text-[#C2C6D1] transition-transform duration-200 ${isCourseTypeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isCourseTypeDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-[#131418] border border-[#23252C] rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn">
                      <div
                        onMouseDown={() => {
                          setCourseForm({ ...courseForm, course_type_code: "theory" });
                          setIsCourseTypeDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-[#16171D] transition-colors ${courseForm.course_type_code === "theory" ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#EDEFF5]"}`}
                      >
                        Theory
                      </div>
                      <div
                        onMouseDown={() => {
                          setCourseForm({ ...courseForm, course_type_code: "hybrid" });
                          setIsCourseTypeDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-[#16171D] transition-colors ${courseForm.course_type_code === "hybrid" ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#EDEFF5]"}`}
                      >
                        Hybrid
                      </div>
                      <div
                        onMouseDown={() => {
                          setCourseForm({ ...courseForm, course_type_code: "project" });
                          setIsCourseTypeDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-[#16171D] transition-colors ${courseForm.course_type_code === "project" ? "bg-[#6E79F4]/5 text-[#6E79F4] font-bold" : "text-[#EDEFF5]"}`}
                      >
                        Project-based
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setCourseDrawerOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Blueprint"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Module Template Right Sidebar Panel (Drawer) */}
      {moduleDrawerOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setModuleDrawerOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#6E79F4]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <Folder size={16} className="text-[#6E79F4]" /> {editingModule ? "Edit Module Template" : "Add Module Template"}
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Organize course syllabus chapters or learning sections.</p>
              </div>
              <button
                onClick={() => setModuleDrawerOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleModuleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Module Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Introduction to Routing"
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Description</label>
                  <textarea
                    placeholder="Summary of module learning goals..."
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none text-[#EDEFF5]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Order Position</label>
                  <input
                    type="number"
                    value={moduleForm.position}
                    onChange={(e) => setModuleForm({ ...moduleForm, position: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    min={1}
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModuleDrawerOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Module"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Lesson Template Right Sidebar Panel (Drawer) */}
      {lessonDrawerOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setLessonDrawerOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#6E79F4]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <FileText size={16} className="text-[#6E79F4]" /> {editingLesson ? "Edit Lesson Template" : "Add Lesson Template"}
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Map dynamic content lessons to the module parent template.</p>
              </div>
              <button
                onClick={() => setLessonDrawerOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLessonSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Lesson Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Page Routing"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Lesson Type *</label>
                  <select
                    value={lessonForm.lesson_type_code}
                    onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_code: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium text-[#EDEFF5]"
                  >
                    <option value="text">Text Document</option>
                    <option value="video">Video Lecture</option>
                    <option value="pdf">PDF Document</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Video URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://vimeo.com/... or cloud storage URL"
                    value={lessonForm.video_url}
                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Learning Content (Markdown / Text) *</label>
                  <textarea
                    placeholder="Enter markdown or text content for this lesson template..."
                    value={lessonForm.content_text}
                    onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                    rows={6}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>

              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setLessonDrawerOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Lesson"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Resource Template Right Sidebar Panel (Drawer) */}
      {resourceDrawerOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setResourceDrawerOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#6E79F4]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <Link2 size={16} className="text-[#6E79F4]" /> Add Resource Template
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Attach static documents, files, or reference links to the lesson.</p>
              </div>
              <button
                onClick={() => setResourceDrawerOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#C2C6D1] hover:text-[#EDEFF5] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleResourceSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Resource Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Repository, Assignment PDF"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Resource Type *</label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium text-[#EDEFF5]"
                  >
                    <option value="link">External Web Link</option>
                    <option value="pdf">PDF File</option>
                    <option value="zip">ZIP Archive</option>
                    <option value="doc">Text Document</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">External URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    value={resourceForm.external_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">File URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="course-assets/handouts/assignment-1.pdf"
                    value={resourceForm.file_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono text-[#EDEFF5]"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setResourceDrawerOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Resource Template"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  );
}
