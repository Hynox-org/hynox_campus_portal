"use client";

import React, { useState, useEffect } from "react";
import { 
  FolderPlus, Plus, ChevronDown, ChevronRight, Edit2, Trash2, 
  BookOpen, Video, FileText, Link2, File, Sparkles, UserCheck, 
  Users, Save, Settings, X, GraduationCap, Clock, ExternalLink 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useToast } from "@/components/toast";
import { 
  assignCourseInstructorsAction,
  createModuleAction, updateModuleAction, deleteModuleAction,
  createLessonAction, updateLessonAction, deleteLessonAction,
  createLessonResourceAction, deleteLessonResourceAction,
  listLessonsAction, listLessonResourcesAction
} from "@/app/actions/academic-actions";

interface CourseSpaceConsoleProps {
  program: any;
  course: any;
  initialInstructors: any[];
  tenantInstructors: any[];
  initialModules: any[];
  primaryRole: string;
  lookups: {
    courseTypes: any[];
    lessonTypes: any[];
    statuses: any[];
    visibilityTypes: any[];
  };
}

export default function CourseSpaceConsole({
  program,
  course,
  initialInstructors,
  tenantInstructors,
  initialModules,
  primaryRole,
  lookups
}: CourseSpaceConsoleProps) {
  const router = useRouter();
  const [modules, setModules] = useState<any[]>(initialModules);
  const [instructors, setInstructors] = useState<any[]>(initialInstructors);
  
  // Expanded modules state mapping
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [moduleLessons, setModuleLessons] = useState<Record<string, any[]>>({});
  const [lessonResources, setLessonResources] = useState<Record<string, any[]>>({});

  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const isStaff = ["super_admin", "institution_admin", "teacher", "trainer"].includes(primaryRole);

  // Instructors selector state
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>(
    initialInstructors.map(i => i.user_id)
  );

  // Modals state
  const [activeModal, setActiveModal] = useState<"module" | "lesson" | "resource" | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form inputs
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [modulePos, setModulePos] = useState<number>(1);
  const [moduleStatusId, setModuleStatusId] = useState(lookups.statuses.find(s => s.code === "active")?.id || "");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonTypeId, setLessonTypeId] = useState(lookups.lessonTypes[0]?.id || "");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDuration, setLessonDuration] = useState<number>(10);
  const [lessonPos, setLessonPos] = useState<number>(1);
  const [lessonIsPreview, setLessonIsPreview] = useState(false);
  const [lessonStatusId, setLessonStatusId] = useState(lookups.statuses.find(s => s.code === "active")?.id || "");

  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState("pdf");
  const [resFileUrl, setResFileUrl] = useState("");
  const [resExtUrl, setResExtUrl] = useState("");
  const [resPos, setResPos] = useState<number>(1);

  // Fetch lessons when expanding module
  const toggleModule = async (moduleId: string) => {
    const isCurrentlyExpanded = expandedModules[moduleId];
    setExpandedModules(prev => ({ ...prev, [moduleId]: !isCurrentlyExpanded }));

    if (!isCurrentlyExpanded && !moduleLessons[moduleId]) {
      setLoading(true);
      const res = await listLessonsAction(moduleId);
      if (res.lessons) {
        setModuleLessons(prev => ({ ...prev, [moduleId]: res.lessons }));
      }
      setLoading(false);
    }
  };

  // Fetch resources when selecting lesson
  const handleSelectLesson = async (lesson: any) => {
    setSelectedLesson(lesson);

    if (!lessonResources[lesson.id]) {
      setLoading(true);
      const res = await listLessonResourcesAction(lesson.id);
      if (res.resources) {
        setLessonResources(prev => ({ ...prev, [lesson.id]: res.resources }));
      }
      setLoading(false);
    }
  };

  // Instructor assignment action
  const handleSaveInstructors = async () => {
    setLoading(true);

    const res = await assignCourseInstructorsAction(course.id, selectedInstructorIds);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Assigned instructors updated successfully!");
      router.refresh();
    }
    setLoading(false);
  };

  // Module CRUD submissions
  const handleOpenCreateModule = () => {
    setEditingItem(null);
    setModuleTitle("");
    setModuleDesc("");
    setModulePos(modules.length + 1);
    setModuleStatusId(lookups.statuses.find(s => s.code === "active")?.id || "");
    setActiveModal("module");
  };

  const handleOpenEditModule = (mod: any) => {
    setEditingItem(mod);
    setModuleTitle(mod.title);
    setModuleDesc(mod.description || "");
    setModulePos(mod.position);
    setModuleStatusId(mod.status_id);
    setActiveModal("module");
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      course_id: course.id,
      title: moduleTitle,
      description: moduleDesc,
      position: modulePos,
      status_id: moduleStatusId
    };

    if (editingItem) {
      const res = await updateModuleAction(editingItem.id, payload);
      if (res.error) {
        showError(res.error);
      } else if (res.module) {
        setModules(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...res.module } : m));
        setActiveModal(null);
      }
    } else {
      const res = await createModuleAction(payload);
      if (res.error) {
        showError(res.error);
      } else if (res.module) {
        setModules(prev => [...prev, res.module].sort((a, b) => a.position - b.position));
        setActiveModal(null);
      }
    }
    setLoading(false);
  };

  const handleDeleteModule = async (moduleId: string, name: string) => {
    if (!confirm(`Delete module "${name}"? This removes nested lessons.`)) return;
    setLoading(true);
    const res = await deleteModuleAction(moduleId);
    if (res.error) {
      showError(res.error);
    } else {
      setModules(prev => prev.filter(m => m.id !== moduleId));
      if (selectedLesson && selectedLesson.module_id === moduleId) {
        setSelectedLesson(null);
      }
    }
    setLoading(false);
  };

  // Lesson CRUD submissions
  const [activeModuleIdForLess, setActiveModuleIdForLess] = useState("");

  const handleOpenCreateLesson = (moduleId: string) => {
    setEditingItem(null);
    setActiveModuleIdForLess(moduleId);
    setLessonTitle("");
    setLessonTypeId(lookups.lessonTypes[0]?.id || "");
    setLessonContent("");
    setLessonVideoUrl("");
    setLessonDuration(15);
    setLessonPos((moduleLessons[moduleId]?.length || 0) + 1);
    setLessonIsPreview(false);
    setLessonStatusId(lookups.statuses.find(s => s.code === "active")?.id || "");
    setActiveModal("lesson");
  };

  const handleOpenEditLesson = (less: any) => {
    setEditingItem(less);
    setActiveModuleIdForLess(less.module_id);
    setLessonTitle(less.title);
    setLessonTypeId(less.lesson_type_id);
    setLessonContent(less.content_json?.text || "");
    setLessonVideoUrl(less.video_url || "");
    setLessonDuration(less.duration || 0);
    setLessonPos(less.position);
    setLessonIsPreview(less.is_preview || false);
    setLessonStatusId(less.status_id);
    setActiveModal("lesson");
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      module_id: activeModuleIdForLess,
      title: lessonTitle,
      lesson_type_id: lessonTypeId,
      content_json: { text: lessonContent },
      video_url: lessonVideoUrl || undefined,
      duration: lessonDuration,
      position: lessonPos,
      is_preview: lessonIsPreview,
      status_id: lessonStatusId
    };

    if (editingItem) {
      const res = await updateLessonAction(editingItem.id, payload);
      if (res.error) {
        showError(res.error);
      } else if (res.lesson) {
        setModuleLessons(prev => ({
          ...prev,
          [activeModuleIdForLess]: prev[activeModuleIdForLess].map(l => l.id === editingItem.id ? { ...l, ...res.lesson } : l)
        }));
        if (selectedLesson?.id === editingItem.id) {
          setSelectedLesson({ ...selectedLesson, ...res.lesson });
        }
        setActiveModal(null);
      }
    } else {
      const res = await createLessonAction(payload);
      if (res.error) {
        showError(res.error);
      } else if (res.lesson) {
        setModuleLessons(prev => ({
          ...prev,
          [activeModuleIdForLess]: [...(prev[activeModuleIdForLess] || []), res.lesson].sort((a, b) => a.position - b.position)
        }));
        setActiveModal(null);
      }
    }
    setLoading(false);
  };

  const handleDeleteLesson = async (less: any) => {
    if (!confirm(`Delete lesson "${less.title}"?`)) return;
    setLoading(true);
    const res = await deleteLessonAction(less.id);
    if (res.error) {
      showError(res.error);
    } else {
      setModuleLessons(prev => ({
        ...prev,
        [less.module_id]: prev[less.module_id].filter(l => l.id !== less.id)
      }));
      if (selectedLesson?.id === less.id) {
        setSelectedLesson(null);
      }
    }
    setLoading(false);
  };

  // Lesson Resources Submissions
  const handleOpenCreateResource = () => {
    setEditingItem(null);
    setResTitle("");
    setResType("pdf");
    setResFileUrl("");
    setResExtUrl("");
    setResPos((lessonResources[selectedLesson.id]?.length || 0) + 1);
    setActiveModal("resource");
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      lesson_id: selectedLesson.id,
      title: resTitle,
      resource_type: resType,
      file_url: resFileUrl || undefined,
      external_url: resExtUrl || undefined,
      position: resPos
    };

    const res = await createLessonResourceAction(payload);
    if (res.error) {
      showError(res.error);
    } else if (res.resource) {
      setLessonResources(prev => ({
        ...prev,
        [selectedLesson.id]: [...(prev[selectedLesson.id] || []), res.resource].sort((a, b) => a.position - b.position)
      }));
      setActiveModal(null);
    }
    setLoading(false);
  };

  const handleDeleteResource = async (resId: string) => {
    if (!confirm("Remove this resource attachment?")) return;
    setLoading(true);
    const res = await deleteLessonResourceAction(resId);
    if (res.error) {
      showError(res.error);
    } else {
      setLessonResources(prev => ({
        ...prev,
        [selectedLesson.id]: prev[selectedLesson.id].filter(r => r.id !== resId)
      }));
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LEFT COLUMN: MODULES EXPLORER / SYLLABUS TREE */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-[#131418] border border-[#23252C] p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#23252C]">
            <span className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1]">Syllabus Tree</span>
            {isStaff && (
              <button
                onClick={handleOpenCreateModule}
                className="bg-[#6E79F4] text-white p-1.5 rounded-lg hover:bg-[#6E79F4]/90 transition-colors flex items-center gap-1 text-[10px] font-bold shadow-sm"
              >
                <Plus size={12} /> Add Module
              </button>
            )}
          </div>

          <div className="space-y-3">
            {modules.length > 0 ? (
              modules.map((mod) => {
                const isExpanded = expandedModules[mod.id];
                const lessons = moduleLessons[mod.id] || [];

                return (
                  <div key={mod.id} className="border border-[#23252C] rounded-xl overflow-hidden">
                    {/* Module Accordion Header */}
                    <div 
                      className="bg-[#16171D]/50 hover:bg-[#16171D] px-4 py-3 flex items-center justify-between cursor-pointer transition-colors"
                      onClick={() => toggleModule(mod.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? <ChevronDown size={14} className="text-[#C2C6D1]" /> : <ChevronRight size={14} className="text-[#C2C6D1]" />}
                        <span className="font-bold text-xs text-[#EDEFF5] truncate" title={mod.title}>
                          {mod.title}
                        </span>
                      </div>
                      
                      {isStaff && (
                        <div className="flex items-center gap-1 onClick-stopPropagation" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditModule(mod)}
                            className="p-1 text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#1A1C22] rounded"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteModule(mod.id, mod.title)}
                            className="p-1 text-[#F0555D] hover:bg-[#F0555D]/5 rounded"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Nested Lessons List */}
                    {isExpanded && (
                      <div className="divide-y divide-[#23252C] bg-[#131418] text-xs">
                        {lessons.length > 0 ? (
                          lessons.map((less) => {
                            const isSelected = selectedLesson?.id === less.id;
                            const isVideo = lookups.lessonTypes.find(t => t.id === less.lesson_type_id)?.code === "video";

                            return (
                              <div
                                key={less.id}
                                className={`px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#16171D]/60 transition-colors ${
                                  isSelected ? "bg-[#6E79F4]/5 border-l-2 border-[#6E79F4]" : ""
                                }`}
                                onClick={() => handleSelectLesson(less)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isVideo ? <Video size={13} className="text-[#A3A9B6] shrink-0" /> : <FileText size={13} className="text-[#A3A9B6] shrink-0" />}
                                  <span className={`truncate ${isSelected ? "font-bold text-[#6E79F4]" : "text-[#C2C6D1]"}`}>
                                    {less.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                  {less.is_preview && (
                                    <span className="bg-[#2FBF71]/10 text-[#2FBF71] text-[8px] font-extrabold px-1 rounded uppercase">Preview</span>
                                  )}
                                  
                                  {isStaff && (
                                    <>
                                      <button
                                        onClick={() => handleOpenEditLesson(less)}
                                        className="p-1 text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#1A1C22] rounded"
                                      >
                                        <Edit2 size={10} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLesson(less)}
                                        className="p-1 text-[#F0555D] hover:bg-[#F0555D]/5 rounded"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-4 text-center text-[10px] text-[#C2C6D1]">
                            No chapters/lessons mapped yet.
                          </div>
                        )}

                        {isStaff && (
                          <div className="p-2 bg-[#16171D]/30 flex justify-end">
                            <button
                              onClick={() => handleOpenCreateLesson(mod.id)}
                              className="text-[10px] font-bold text-[#6E79F4] hover:underline flex items-center gap-0.5"
                            >
                              <Plus size={11} /> Add Lesson
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-[11px] text-[#C2C6D1]">
                Syllabus is currently empty.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: WORKSPACE CORE (LESSON VIEWER OR INSTRUCTOR CONFIG) */}
      <div className="lg:col-span-2 space-y-6">

        {selectedLesson ? (
          // LESSON WORKSPACE VIEW
          <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#23252C]">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#C2C6D1] tracking-widest">Selected Lesson</span>
                <h2 className="text-base font-bold text-[#EDEFF5] mt-0.5">{selectedLesson.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedLesson(null)}
                className="text-[#C2C6D1] hover:text-[#EDEFF5] text-xs font-semibold hover:underline"
              >
                Close View
              </button>
            </div>

            {/* Video preview if available */}
            {selectedLesson.video_url && (
              <div className="aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-[#23252C] flex items-center justify-center text-white text-xs relative">
                <Video size={36} className="text-[#6E79F4] mb-2" />
                <span className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold">
                  Video URL: {selectedLesson.video_url}
                </span>
              </div>
            )}

            {/* Lesson Structured Content */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-[#C2C6D1] block">Lesson Overview & Content</span>
              <div className="bg-[#16171D] border border-[#23252C] p-5 rounded-xl">
                {selectedLesson.content_json?.text ? (
                  <MarkdownRenderer content={selectedLesson.content_json.text} />
                ) : (
                  <span className="text-xs text-[#C2C6D1] italic">No learning text content provided for this lesson.</span>
                )}
              </div>
            </div>

            {/* Resource Attachments Explorer */}
            <div className="border-t border-[#23252C] pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1">
                  <Link2 size={13} /> Resource Attachments
                </span>
                {isStaff && (
                  <button
                    onClick={handleOpenCreateResource}
                    className="text-[10px] font-bold text-[#6E79F4] hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={11} /> Add Attachment
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {(lessonResources[selectedLesson.id] || []).length > 0 ? (
                  (lessonResources[selectedLesson.id] || []).map((res) => {
                    const downloadUrl = res.external_url || res.file_url || res.resource_url;
                    const isLink = res.resource_type === "link" || res.resource_type === "youtube" || res.resource_type === "google_drive" || !!res.external_url;
                    
                    return (
                      <div 
                        key={res.id} 
                        className="bg-[#131418] border border-[#23252C] rounded-xl px-4 py-3 flex items-center justify-between text-xs hover:bg-[#16171D]/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isLink ? <Link2 size={13} className="text-[#6E79F4] shrink-0" /> : <File size={13} className="text-[#A3A9B6] shrink-0" />}
                          <span className="font-semibold truncate text-[#EDEFF5]">{res.title}</span>
                          <span className="px-1.5 py-0.2 bg-[#1A1C22] rounded text-[9px] text-[#C2C6D1] uppercase font-bold">{res.resource_type}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {downloadUrl && (
                            <a 
                              href={downloadUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[#6E79F4] hover:underline flex items-center gap-0.5 text-[10px]"
                            >
                              {isLink ? "Open Link" : "Download File"} <ExternalLink size={10} />
                            </a>
                          )}

                          {isStaff && (
                            <button
                              onClick={() => handleDeleteResource(res.id)}
                              className="text-[#F0555D] hover:bg-[#F0555D]/5 p-1 rounded"
                              title="Delete Attachment"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 bg-[#16171D]/50 border border-[#23252C] rounded-xl text-[10px] text-[#C2C6D1]">
                    No resource attachments mapped to this learning unit.
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          // DEFAULT COURSE SUMMARY & INSTRUCTOR ASSIGNMENTS
          <>
            <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-[#EDEFF5]">Course Management Dashboard</h3>
              <p className="text-xs text-[#C2C6D1] leading-relaxed">
                Welcome to the workspace for <strong>{course.title}</strong>. Expand the syllabus modules on the left sidebar to add and configure lessons, preview contents, or attach documentation.
              </p>
            </div>

            {/* Instructor Assignment Console */}
            {isStaff && (
              <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-[#23252C]">
                  <Users className="text-[#6E79F4]" size={16} />
                  <span className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1]">Faculty & Course Instructors</span>
                </div>

                <p className="text-xs text-[#C2C6D1] leading-relaxed">
                  Select the trainers and teachers responsible for validating submissions and updating curriculum parameters for this course.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto border border-[#23252C] rounded-xl p-4 bg-[#16171D]/40">
                  {tenantInstructors.length > 0 ? (
                    tenantInstructors.map((teacher) => {
                      const isChecked = selectedInstructorIds.includes(teacher.id);
                      return (
                        <label 
                          key={teacher.id} 
                          className="flex items-center gap-2.5 bg-[#131418] border border-[#23252C] hover:border-[#6E79F4]/30 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shadow-sm select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInstructorIds(prev => [...prev, teacher.id]);
                              } else {
                                setSelectedInstructorIds(prev => prev.filter(id => id !== teacher.id));
                              }
                            }}
                            className="rounded text-[#6E79F4] focus:ring-[#6E79F4]"
                          />
                          <div className="text-[11px] min-w-0">
                            <div className="font-bold text-[#EDEFF5] truncate">{teacher.full_name || "Trainer"}</div>
                            <div className="text-[#C2C6D1] truncate">{teacher.email}</div>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-4 text-center text-[#C2C6D1]">
                      No teachers found on your campus workspace.
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveInstructors}
                    disabled={loading}
                    className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save size={14} /> Save Assigned Instructors
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DIALOG POPUPS */}
      {activeModal && (
        <div className="fixed inset-0 bg-[#6E79F4]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#EDEFF5]">
            
            <div className="bg-[#16171D] px-6 py-4 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">
                {activeModal === "module" && (editingItem ? "Edit Module Parameters" : "Create New Module")}
                {activeModal === "lesson" && (editingItem ? "Configure Lesson Unit" : "Add Lesson Unit")}
                {activeModal === "resource" && "Add Resource Attachment"}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* MODULE FORM */}
            {activeModal === "module" && (
              <form onSubmit={handleModuleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Module Title *</label>
                  <input
                    type="text"
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                    placeholder="e.g. Authentication & State"
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Description</label>
                  <textarea
                    value={moduleDesc}
                    onChange={(e) => setModuleDesc(e.target.value)}
                    placeholder="Module chapters scope summary..."
                    rows={3}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Order Position *</label>
                    <input
                      type="number"
                      value={modulePos}
                      onChange={(e) => setModulePos(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Workflow Status *</label>
                    <select
                      value={moduleStatusId}
                      onChange={(e) => setModuleStatusId(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    >
                      {lookups.statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.description}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#23252C] mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Module"}
                  </button>
                </div>
              </form>
            )}

            {/* LESSON FORM */}
            {activeModal === "lesson" && (
              <form onSubmit={handleLessonSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Title *</label>
                  <input
                    type="text"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="e.g. Setting Up Redux Store"
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Type *</label>
                  <select
                    value={lessonTypeId}
                    onChange={(e) => setLessonTypeId(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    {lookups.lessonTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Text/Markdown Learning Content *</label>
                  <textarea
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    placeholder="Structured learning descriptions, instructions..."
                    rows={4}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-y"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Video URL</label>
                  <input
                    type="text"
                    value={lessonVideoUrl}
                    onChange={(e) => setLessonVideoUrl(e.target.value)}
                    placeholder="e.g. https://storage.googleapis.com/hynox/lesson1.mp4"
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Order Position *</label>
                  <input
                    type="number"
                    value={lessonPos}
                    onChange={(e) => setLessonPos(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <label className="flex items-center gap-2 font-semibold text-[#C2C6D1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonIsPreview}
                      onChange={(e) => setLessonIsPreview(e.target.checked)}
                      className="rounded text-[#6E79F4] focus:ring-[#6E79F4]"
                    />
                    Mark as Preview Unit
                  </label>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                    <select
                      value={lessonStatusId}
                      onChange={(e) => setLessonStatusId(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    >
                      {lookups.statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.description}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#23252C] mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Lesson"}
                  </button>
                </div>
              </form>
            )}

            {/* RESOURCE FORM */}
            {activeModal === "resource" && (
              <form onSubmit={handleResourceSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Attachment Name *</label>
                  <input
                    type="text"
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="e.g. Core Redux Setup Cheatsheet"
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Resource Format Type *</label>
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="link">External Web URL</option>
                    <option value="github">GitHub Repository</option>
                    <option value="zip">Archive File (ZIP/RAR)</option>
                    <option value="doc">Word/Text Document</option>
                  </select>
                </div>
                {resType === "link" || resType === "github" ? (
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">External Link URL *</label>
                    <input
                      type="url"
                      value={resExtUrl}
                      onChange={(e) => setResExtUrl(e.target.value)}
                      placeholder="e.g. https://github.com/hynox-org"
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Storage File Path *</label>
                    <input
                      type="text"
                      value={resFileUrl}
                      onChange={(e) => setResFileUrl(e.target.value)}
                      placeholder="e.g. course-resources/react-redux-handout.pdf"
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Ordering Index (Position) *</label>
                  <input
                    type="number"
                    value={resPos}
                    onChange={(e) => setResPos(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#23252C] mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Adding..." : "Add Attachment"}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
