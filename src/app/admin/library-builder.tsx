"use client";

import React, { useState, useEffect } from "react";
import { 
  listCourseTemplatesAction, 
  createCourseTemplateAction, 
  updateCourseTemplateAction, 
  deleteCourseTemplateAction,
  listModuleTemplatesAction,
  createModuleTemplateAction,
  updateModuleTemplateAction,
  deleteModuleTemplateAction,
  listLessonTemplatesAction,
  createLessonTemplateAction,
  updateLessonTemplateAction,
  deleteLessonTemplateAction,
  listResourceTemplatesAction,
  createResourceTemplateAction,
  deleteResourceTemplateAction
} from "@/app/actions/library-actions";
import { 
  BookOpen, Plus, Edit, Trash2, X, FolderPlus, 
  Folder, ArrowRight, Save, Clock, ChevronRight, 
  ChevronDown, FileText, Link2, ExternalLink, Sparkles, Play
} from "lucide-react";

export default function LibraryBuilder() {
  const [courseTemplates, setCourseTemplates] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  // Lazy Loaded Cache States (Consistent with program-manager.tsx)
  const [modulesCache, setModulesCache] = useState<Record<string, any[]>>({});
  const [lessonsCache, setLessonsCache] = useState<Record<string, any[]>>({});
  const [resourcesCache, setResourcesCache] = useState<Record<string, any[]>>({});

  // Loading indicator maps for individual nodes
  const [modulesLoading, setModulesLoading] = useState<Record<string, boolean>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Node toggle states
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});

  // Drawer states
  const [courseDrawerOpen, setCourseDrawerOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
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
    position: 1,
    is_preview: false
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

  // Fetch course templates on mount
  useEffect(() => {
    async function loadCourses() {
      setLoading(true);
      const res = await listCourseTemplatesAction();
      if (res.templates) {
        setCourseTemplates(res.templates);
      } else if (res.error) {
        setError(res.error);
      }
      setLoading(false);
    }
    loadCourses();
  }, []);

  // Lazy load modules for a specific course
  const handleSelectCourse = async (courseId: string) => {
    const course = courseTemplates.find(c => c.id === courseId);
    if (course) setSelectedCourse(course);
    
    if (modulesCache[courseId]) return; // use cache

    setModulesLoading(prev => ({ ...prev, [courseId]: true }));
    const res = await listModuleTemplatesAction(courseId);
    if (res.modules) {
      setModulesCache(prev => ({ ...prev, [courseId]: res.modules }));
    }
    setModulesLoading(prev => ({ ...prev, [courseId]: false }));
  };

  const refreshModules = async (courseId: string) => {
    setModulesLoading(prev => ({ ...prev, [courseId]: true }));
    const res = await listModuleTemplatesAction(courseId);
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
    const res = await listLessonTemplatesAction(moduleId);
    if (res.lessons) {
      setLessonsCache(prev => ({ ...prev, [moduleId]: res.lessons }));
    }
    setLessonsLoading(prev => ({ ...prev, [moduleId]: false }));
  };

  const refreshLessons = async (moduleId: string) => {
    setLessonsLoading(prev => ({ ...prev, [moduleId]: true }));
    const res = await listLessonTemplatesAction(moduleId);
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

    const res = await listResourceTemplatesAction(lessonId);
    if (res.resources) {
      setResourcesCache(prev => ({ ...prev, [lessonId]: res.resources }));
    }
  };

  const refreshResources = async (lessonId: string) => {
    const res = await listResourceTemplatesAction(lessonId);
    if (res.resources) {
      setResourcesCache(prev => ({ ...prev, [lessonId]: res.resources }));
    }
  };

  const refreshCourseList = async () => {
    const res = await listCourseTemplatesAction();
    if (res.templates) {
      setCourseTemplates(res.templates);
      if (selectedCourse) {
        const updated = res.templates.find(t => t.id === selectedCourse.id);
        if (updated) setSelectedCourse(updated);
      }
    }
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    let res;
    if (editingCourse) {
      res = await updateCourseTemplateAction(editingCourse.id, courseForm);
    } else {
      res = await createCourseTemplateAction(courseForm);
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Course template saved successfully!");
      setCourseDrawerOpen(false);
      setEditingCourse(null);
      await refreshCourseList();
    }
    setLoading(false);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

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
      setError(res.error);
    } else {
      setSuccess("Module template saved!");
      setModuleDrawerOpen(false);
      setEditingModule(null);
      await refreshModules(selectedCourse.id);
    }
    setLoading(false);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

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
        position: lessonForm.position,
        is_preview: lessonForm.is_preview
      });
    } else {
      res = await createLessonTemplateAction({
        module_template_id: selectedModuleId,
        title: lessonForm.title,
        lesson_type_code: lessonForm.lesson_type_code,
        content_json,
        video_url: lessonForm.video_url || undefined,
        duration: lessonForm.duration,
        position: lessonForm.position,
        is_preview: lessonForm.is_preview
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Lesson template saved!");
      setLessonDrawerOpen(false);
      setEditingLesson(null);
      await refreshLessons(selectedModuleId);
    }
    setLoading(false);
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await createResourceTemplateAction({
      lesson_template_id: selectedLessonId,
      title: resourceForm.title,
      resource_type: resourceForm.resource_type,
      file_url: resourceForm.file_url || undefined,
      external_url: resourceForm.external_url || undefined,
      position: resourceForm.position
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Resource template added!");
      setResourceDrawerOpen(false);
      await refreshResources(selectedLessonId);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 col-span-full w-full">
      {/* Alert Banners */}
      {error && (
        <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 text-xs">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left selector column */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#2563EB]" /> Course Blueprints
            </h4>
            <button
              onClick={() => {
                setEditingCourse(null);
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
              className="flex items-center gap-1 bg-[#2563EB] text-white px-2 py-1 rounded-lg hover:bg-[#2563EB]/95 transition-all text-[10px] font-bold shadow-sm cursor-pointer"
            >
              <Plus size={12} /> New Template
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {courseTemplates.length > 0 ? (
              courseTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectCourse(template.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedCourse?.id === template.id
                      ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-[#2563EB]"
                      : "bg-slate-50/50 hover:bg-slate-50 border-[#E2E8F0] text-[#0F172A]"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold truncate">{template.title}</p>
                    <p className="text-[10px] text-[#475569] font-mono truncate">/{template.slug}</p>
                  </div>
                  <ChevronRight size={13} className={selectedCourse?.id === template.id ? "text-[#2563EB]" : "text-[#475569]"} />
                </div>
              ))
            ) : (
              <p className="text-[11px] text-[#475569] text-center py-4 bg-slate-50/50 rounded-lg">No course templates created yet.</p>
            )}
          </div>
        </div>

        {/* Right workspace details column */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCourse ? (
            <div className="space-y-6">
              
              {/* Selected Blueprint Detail Header */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm relative group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-bold text-[#2563EB] tracking-wider bg-[#2563EB]/10 px-2 py-0.5 rounded border border-[#2563EB]/25">
                        Blueprint Blueprint
                      </span>
                      <span className="text-[9px] bg-slate-100 text-[#475569] px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                        {selectedCourse.course_type_code || "theory"}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#0F172A] mt-2 flex items-center gap-2">
                      {selectedCourse.title}
                    </h3>
                    <p className="text-xs text-[#475569] mt-1 line-clamp-2">
                      {selectedCourse.description || "No description set for this blueprint."}
                    </p>
                    <p className="text-[10px] text-[#475569] mt-1.5 font-mono">
                      Slug: /{selectedCourse.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingCourse(selectedCourse);
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
                      className="p-1 hover:bg-slate-100 rounded text-[#475569] hover:text-[#0F172A]"
                      title="Edit Blueprint"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this course template blueprint?")) {
                          const res = await deleteCourseTemplateAction(selectedCourse.id);
                          if (res.error) setError(res.error);
                          else {
                            setSuccess("Course blueprint deleted!");
                            setSelectedCourse(null);
                            await refreshCourseList();
                          }
                        }
                      }}
                      className="p-1 hover:bg-red-50 rounded text-[#DC2626] hover:text-red-700"
                      title="Delete Blueprint"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] text-[#0F172A] border border-[#E2E8F0] font-mono font-semibold shrink-0">
                      Duration: {selectedCourse.duration_minutes || 0} mins
                    </div>
                  </div>
                </div>
              </div>

              {/* Modules list of selected course blueprint */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                    <FolderPlus size={14} className="text-[#2563EB]" /> Blueprint Structure (Modules & Lessons)
                  </h4>
                  <button
                    onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: "", description: "", position: (modulesCache[selectedCourse.id]?.length || 0) + 1 });
                      setModuleDrawerOpen(true);
                    }}
                    className="flex items-center gap-1 text-[#2563EB] hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    <Plus size={12} /> Add Module Template
                  </button>
                </div>

                {modulesLoading[selectedCourse.id] ? (
                  <div className="py-8 text-center text-xs text-[#475569] font-medium">
                    Loading blueprint modules...
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {modulesCache[selectedCourse.id] && modulesCache[selectedCourse.id].length > 0 ? (
                      modulesCache[selectedCourse.id].map((mod) => {
                        const isModExpanded = !!expandedModules[mod.id];
                        const hasLessons = lessonsCache[mod.id] && lessonsCache[mod.id].length > 0;

                        return (
                          <div key={mod.id} className="border border-[#E2E8F0] rounded-lg overflow-hidden text-xs bg-slate-50/10">
                            
                            {/* Module Expand Toggle Header */}
                            <div
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer select-none bg-white font-semibold text-[#0F172A] border-b border-slate-100"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1" onClick={() => toggleModuleExpand(mod.id)}>
                                {isModExpanded ? <ChevronDown size={13} className="text-[#475569]" /> : <ChevronRight size={13} className="text-[#475569]" />}
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
                                  className="text-[#475569] hover:text-[#0F172A] p-0.5 hover:bg-slate-100 rounded"
                                  title="Edit Module"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this module and all its lessons?")) {
                                      const delRes = await deleteModuleTemplateAction(mod.id);
                                      if (delRes.error) setError(delRes.error);
                                      else await refreshModules(selectedCourse.id);
                                    }
                                  }}
                                  className="text-[#DC2626] hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
                                  title="Delete Module"
                                >
                                  <Trash2 size={12} />
                                </button>
                                <span className="text-[9px] text-[#475569] font-mono bg-slate-100 px-1 rounded shrink-0">
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
                                      setSelectedModuleId(mod.id);
                                      setEditingLesson(null);
                                      setLessonForm({ 
                                        title: "", 
                                        lesson_type_code: "text",
                                        content_text: "",
                                        video_url: "",
                                        duration: 15, 
                                        position: (lessonsCache[mod.id]?.length || 0) + 1,
                                        is_preview: false
                                      });
                                      setLessonDrawerOpen(true);
                                    }}
                                    className="flex items-center gap-1 text-[#2563EB] hover:underline text-[10px] font-bold cursor-pointer"
                                  >
                                    <Plus size={11} /> Add Lesson Template
                                  </button>
                                </div>

                                {lessonsLoading[mod.id] ? (
                                  <div className="text-[10px] text-[#475569] py-2 italic">Loading lessons...</div>
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
                                            {isLesExpanded ? <ChevronDown size={12} className="text-[#475569]" /> : <ChevronRight size={12} className="text-[#475569]" />}
                                            <span className="font-medium text-[#0F172A] truncate">{les.title}</span>
                                            <span className="text-[8px] bg-slate-100 text-[#475569] px-1 rounded uppercase font-mono font-bold shrink-0">{les.lesson_type_code || "text"}</span>
                                            {les.is_preview && (
                                              <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 rounded font-bold border border-emerald-100 shrink-0">
                                                Preview
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2.5 shrink-0">
                                            <span className="text-[10px] text-[#475569] font-mono shrink-0">{les.duration || 0} mins</span>
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
                                                  position: les.position || 1,
                                                  is_preview: les.is_preview || false
                                                });
                                                setLessonDrawerOpen(true);
                                              }}
                                              className="text-[#475569] hover:text-[#0F172A] p-0.5 hover:bg-slate-100 rounded"
                                              title="Edit Lesson"
                                            >
                                              <Edit size={11} />
                                            </button>
                                            <button
                                              onClick={async () => {
                                                if (confirm("Delete this lesson template?")) {
                                                  const delRes = await deleteLessonTemplateAction(les.id);
                                                  if (delRes.error) setError(delRes.error);
                                                  else await refreshLessons(mod.id);
                                                }
                                              }}
                                              className="text-[#DC2626] hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
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
                                                <Play size={10} className="fill-[#2563EB] text-[#2563EB] shrink-0" />
                                                <span className="font-semibold text-slate-700">Video Link:</span>
                                                <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-[#2563EB] font-bold flex-1">
                                                  {les.video_url}
                                                </a>
                                              </div>
                                            )}
                                            {(les.content_json?.body || les.content_json?.text) && (
                                              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                <div className="font-bold text-[#86868b] text-[8px] uppercase tracking-wider mb-1 font-sans">Blueprint Learning Content</div>
                                                {les.content_json.body || les.content_json.text}
                                              </div>
                                            )}
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-1 mb-1">
                                              <span className="text-[9px] uppercase font-bold text-[#86868b]">Attached Resources</span>
                                              <button
                                                onClick={() => {
                                                  setSelectedLessonId(les.id);
                                                  setResourceForm({ title: "", resource_type: "link", external_url: "", file_url: "", position: (resourcesCache[les.id]?.length || 0) + 1 });
                                                  setResourceDrawerOpen(true);
                                                }}
                                                className="flex items-center gap-1 text-[#2563EB] hover:underline text-[9px] font-bold cursor-pointer"
                                              >
                                                <Plus size={10} /> Add Resource Blueprint
                                              </button>
                                            </div>
                                            {resourcesCache[les.id] ? (
                                              hasResources ? (
                                                resourcesCache[les.id].map((resrc: any) => (
                                                  <div key={resrc.id} className="flex items-center justify-between text-[10px] text-[#475569] py-1 bg-slate-50 px-2 rounded">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <FileText size={10} className="shrink-0" />
                                                      <span className="truncate">{resrc.title}</span>
                                                      <span className="text-[8px] bg-slate-200 text-[#475569] px-1 rounded uppercase font-bold shrink-0">{resrc.resource_type}</span>
                                                      {(resrc.file_url || resrc.external_url) && (
                                                        <a 
                                                          href={resrc.file_url || resrc.external_url} 
                                                          target="_blank" 
                                                          rel="noopener noreferrer" 
                                                          className="text-[#2563EB] hover:underline shrink-0"
                                                        >
                                                          <ExternalLink size={9} />
                                                        </a>
                                                      )}
                                                    </div>
                                                    <button
                                                      onClick={async () => {
                                                        if (confirm("Delete this resource template?")) {
                                                          const delRes = await deleteResourceTemplateAction(resrc.id);
                                                          if (delRes.error) setError(delRes.error);
                                                          else await refreshResources(les.id);
                                                        }
                                                      }}
                                                      className="text-[#DC2626] hover:text-red-700 p-0.5 hover:bg-slate-100 rounded"
                                                      title="Delete Resource"
                                                    >
                                                      <Trash2 size={11} />
                                                    </button>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-[9px] text-[#475569] italic">No resources attached to this lesson.</p>
                                              )
                                            ) : (
                                              <p className="text-[9px] text-[#475569] italic">Loading resource attachments...</p>
                                            )}
                                          </div>
                                        )}

                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-[10px] text-[#475569] italic">No lessons in this module.</p>
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-[#475569] italic">
                        No curriculum modules defined.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-[#475569] shadow-sm">
              <BookOpen className="mx-auto mb-2 text-[#475569]/40" size={32} />
              <p className="font-semibold text-[#0F172A]">Select a Course Blueprint from the left pane</p>
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
            className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#0F172A]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <BookOpen size={16} className="text-[#2563EB]" /> {editingCourse ? "Edit Course Blueprint" : "Create Course Blueprint"}
                </h3>
                <p className="text-[10px] text-[#475569] mt-0.5">Define metadata and structures for courses cloned later into paths.</p>
              </div>
              <button
                onClick={() => setCourseDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCourseSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Blueprint Title *</label>
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
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Blueprint URL Slug *</label>
                  <input
                    type="text"
                    placeholder="e.g. react-fundamentals"
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono text-[#0F172A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Description</label>
                  <textarea
                    placeholder="Course blueprint details, objectives..."
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm resize-none text-[#0F172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#475569]">Course Type *</label>
                    <select
                      value={courseForm.course_type_code}
                      onChange={(e) => setCourseForm({ ...courseForm, course_type_code: e.target.value })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-medium text-[#0F172A]"
                    >
                      <option value="theory">Theory</option>
                      <option value="practical">Practical/Lab</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="project">Project-based</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#475569]">Duration (minutes)</label>
                    <input
                      type="number"
                      value={courseForm.duration_minutes}
                      onChange={(e) => setCourseForm({ ...courseForm, duration_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-[#E2E8F0] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setCourseDrawerOpen(false)}
                  className="border border-[#E2E8F0] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Blueprint"}
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
            className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#0F172A]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <Folder size={16} className="text-[#2563EB]" /> {editingModule ? "Edit Module Template" : "Add Module Template"}
                </h3>
                <p className="text-[10px] text-[#475569] mt-0.5">Organize course syllabus chapters or learning sections.</p>
              </div>
              <button
                onClick={() => setModuleDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleModuleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Module Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Introduction to Routing"
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Description</label>
                  <textarea
                    placeholder="Summary of module learning goals..."
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm resize-none text-[#0F172A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Order Position</label>
                  <input
                    type="number"
                    value={moduleForm.position}
                    onChange={(e) => setModuleForm({ ...moduleForm, position: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    min={1}
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-[#E2E8F0] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModuleDrawerOpen(false)}
                  className="border border-[#E2E8F0] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Module"}
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
            className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#0F172A]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <FileText size={16} className="text-[#2563EB]" /> {editingLesson ? "Edit Lesson Template" : "Add Lesson Template"}
                </h3>
                <p className="text-[10px] text-[#475569] mt-0.5">Map dynamic content lessons to the module parent template.</p>
              </div>
              <button
                onClick={() => setLessonDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLessonSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Lesson Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Page Routing"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#475569]">Lesson Type *</label>
                    <select
                      value={lessonForm.lesson_type_code}
                      onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_code: e.target.value })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-medium text-[#0F172A]"
                    >
                      <option value="text">Text Document</option>
                      <option value="video">Video Lecture</option>
                      <option value="pdf">PDF Document</option>
                      <option value="assignment">Assignment File</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#475569]">Duration (minutes)</label>
                    <input
                      type="number"
                      value={lessonForm.duration}
                      onChange={(e) => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Video URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://vimeo.com/... or cloud storage URL"
                    value={lessonForm.video_url}
                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono text-[#0F172A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Learning Content (Markdown / Text) *</label>
                  <textarea
                    placeholder="Enter markdown or text content for this lesson template..."
                    value={lessonForm.content_text}
                    onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                    rows={6}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isPreview"
                    checked={lessonForm.is_preview}
                    onChange={(e) => setLessonForm({ ...lessonForm, is_preview: e.target.checked })}
                    className="rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <label htmlFor="isPreview" className="font-semibold text-[#475569] select-none cursor-pointer">Previewable by non-enrolled students</label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-[#E2E8F0] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setLessonDrawerOpen(false)}
                  className="border border-[#E2E8F0] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Lesson"}
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
            className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#0F172A]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <Link2 size={16} className="text-[#2563EB]" /> Add Resource Template
                </h3>
                <p className="text-[10px] text-[#475569] mt-0.5">Attach static documents, files, or reference links to the lesson.</p>
              </div>
              <button
                onClick={() => setResourceDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleResourceSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Resource Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Repository, Assignment PDF"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm text-[#0F172A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">Resource Type *</label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-medium text-[#0F172A]"
                  >
                    <option value="link">External Web Link</option>
                    <option value="pdf">PDF File</option>
                    <option value="zip">ZIP Archive</option>
                    <option value="doc">Text Document</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">External URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    value={resourceForm.external_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono text-[#0F172A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#475569]">File URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="course-assets/handouts/assignment-1.pdf"
                    value={resourceForm.file_url}
                    onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-[#E2E8F0] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setResourceDrawerOpen(false)}
                  className="border border-[#E2E8F0] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#2563EB]/95 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Resource Template"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  );
}
