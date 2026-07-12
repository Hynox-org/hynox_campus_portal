"use client";

import React, { useState } from "react";
import { BookOpen, ArrowRight, Edit, Trash2, Plus, X, GraduationCap, Clock } from "lucide-react";
import Link from "next/link";
import { createCourseAction, updateCourseAction, deleteCourseAction } from "@/app/actions/academic-actions";
import { useRouter } from "next/navigation";

interface ClientCourseListProps {
  program: any;
  initialCourses: any[];
  primaryRole: string;
  lookups: {
    courseTypes: any[];
    lessonTypes: any[];
    statuses: any[];
    visibilityTypes: any[];
  };
}

export default function ClientCourseList({ program, initialCourses, primaryRole, lookups }: ClientCourseListProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isStaff = ["super_admin", "institution_admin", "teacher", "trainer"].includes(primaryRole);

  // Modal toggles
  const [isOpen, setIsOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [enrollmentMode, setEnrollmentMode] = useState<string>("open");
  const [thumbnailPath, setThumbnailPath] = useState("");
  const [courseTypeId, setCourseTypeId] = useState(lookups.courseTypes[0]?.id || "");
  const [statusId, setStatusId] = useState(lookups.statuses.find(s => s.code === "draft")?.id || "");
  const [visibilityId, setVisibilityId] = useState(lookups.visibilityTypes.find(v => v.code === "private")?.id || "");

  const handleOpenCreate = () => {
    setEditingCourse(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setDurationMinutes(60);
    setEnrollmentMode("open");
    setThumbnailPath("");
    setCourseTypeId(lookups.courseTypes[0]?.id || "");
    setStatusId(lookups.statuses.find(s => s.code === "draft")?.id || "");
    setVisibilityId(lookups.visibilityTypes.find(v => v.code === "private")?.id || "");
    setError("");
    setIsOpen(true);
  };

  const handleOpenEdit = (course: any) => {
    setEditingCourse(course);
    setTitle(course.title);
    setSlug(course.slug);
    setDescription(course.description || "");
    setDurationMinutes(course.duration_minutes || 0);
    setEnrollmentMode(course.enrollment_mode || "open");
    setThumbnailPath(course.thumbnail_path || "");
    setCourseTypeId(course.course_type_id || "");
    setStatusId(course.status_id);
    setVisibilityId(course.visibility_type_id);
    setError("");
    setIsOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingCourse) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "")
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      program_id: program.id,
      title,
      slug,
      description,
      duration_minutes: durationMinutes,
      enrollment_mode: enrollmentMode as any,
      thumbnail_path: thumbnailPath,
      course_type_id: courseTypeId || null,
      status_id: statusId,
      visibility_type_id: visibilityId,
    };

    if (editingCourse) {
      const res = await updateCourseAction(editingCourse.id, payload);
      if (res.error) {
        setError(res.error);
      } else if (res.course) {
        setSuccess("Course updated successfully!");
        setIsOpen(false);
        router.refresh();
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...res.course } : c));
      }
    } else {
      const res = await createCourseAction(payload);
      if (res.error) {
        setError(res.error);
      } else if (res.course) {
        setSuccess("Course created successfully!");
        setIsOpen(false);
        router.refresh();
        setCourses(prev => [res.course, ...prev]);
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete course "${name}"? This removes modules and lessons.`)) {
      return;
    }

    setLoading(true);
    setError("");
    const res = await deleteCourseAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Course successfully deleted.");
      setCourses(prev => prev.filter(c => c.id !== id));
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      
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

      {isStaff && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenCreate}
            className="bg-[#2563EB] text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center gap-1.5"
          >
            <Plus size={15} /> Create Course
          </button>
        </div>
      )}

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.length > 0 ? (
          courses.map((course) => (
            <div
              key={course.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-[#2563EB]/10 text-[#2563EB] p-2.5 rounded-xl border border-[#2563EB]/20">
                    <BookOpen size={18} />
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-50 text-[#475569] border-[#E2E8F0]">
                      {course.course_type?.code || "Theory"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                      course.status?.code === "active"
                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                        : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                    }`}>
                      {course.status?.code || "Draft"}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#0F172A] mb-1">{course.title}</h3>
                <div className="flex items-center gap-3 text-[10px] text-[#475569] mb-4">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {course.duration_minutes || 0} mins
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                  <span>Enrollment: <strong className="font-semibold capitalize text-[#0F172A]">{course.enrollment_mode}</strong></span>
                </div>

                <p className="text-xs text-[#475569] line-clamp-2 mb-6 leading-relaxed">
                  {course.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
                {isStaff ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(course)}
                      className="p-2 border border-[#E2E8F0] rounded-lg hover:bg-slate-50 text-[#475569] transition-colors"
                      title="Edit Course"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      className="p-2 border border-[#E2E8F0] rounded-lg hover:bg-[#DC2626]/5 text-[#DC2626] border-[#DC2626]/10 transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <Link
                  href={`/academic/${program.slug}/${course.slug}`}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline"
                >
                  Enter Course Space <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-[#475569]">
            <BookOpen className="mx-auto mb-2 text-[#475569]/40" size={32} />
            <p className="font-medium text-[#0F172A]">No Courses Found Under This Program</p>
            <p className="mt-1">Add courses to build curriculum modules and lesson chapters.</p>
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      {isOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col text-xs text-[#0F172A]">
            
            <div className="bg-slate-50 px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0F172A]">
                {editingCourse ? "Edit Course Details" : "Create New Teachable Course"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#475569] hover:text-[#0F172A] p-1.5"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#475569]">Course Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. React Fundamentals"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#475569]">Course URL Slug *</label>
                  <input
                    type="text"
                    placeholder="e.g. react-fundamentals"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#475569]">Course Description</label>
                  <textarea
                    placeholder="Provide overview details, pre-requisites..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Estimated Duration (Minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Enrollment Mode *</label>
                  <select
                    value={enrollmentMode}
                    onChange={(e) => setEnrollmentMode(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  >
                    <option value="open">Open (Publicly Joinable)</option>
                    <option value="approval">Approval (Awaiting Admin validation)</option>
                    <option value="private">Private (Invite Link Only)</option>
                    <option value="institution_only">Institution Only (Linked Tenant domain)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Course Type *</label>
                  <select
                    value={courseTypeId}
                    onChange={(e) => setCourseTypeId(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  >
                    {lookups.courseTypes.map((c) => (
                      <option key={c.id} value={c.id}>{c.description}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Thumbnail Path (Storage)</label>
                  <input
                    type="text"
                    placeholder="e.g. course-thumbnails/react.jpg"
                    value={thumbnailPath}
                    onChange={(e) => setThumbnailPath(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Workflow Status *</label>
                  <select
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  >
                    {lookups.statuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.description}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#475569]">Visibility Type *</label>
                  <select
                    value={visibilityId}
                    onChange={(e) => setVisibilityId(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  >
                    {lookups.visibilityTypes.map((v) => (
                      <option key={v.id} value={v.id}>{v.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0] mt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2563EB]/95 transition-colors disabled:opacity-50"
                >
                  {loading ? "Saving..." : editingCourse ? "Update Course" : "Create Course"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
