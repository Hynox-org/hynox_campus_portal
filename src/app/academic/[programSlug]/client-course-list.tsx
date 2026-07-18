"use client";

import React, { useState } from "react";
import { BookOpen, ArrowRight, Edit, Trash2, Plus, X, GraduationCap, Clock } from "lucide-react";
import Link from "next/link";
import { createCourseAction, updateCourseAction, deleteCourseAction } from "@/app/actions/academic-actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

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
  const { showSuccess, showError } = useToast();

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
        showError(res.error);
      } else if (res.course) {
        showSuccess("Course updated successfully!");
        setIsOpen(false);
        router.refresh();
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...res.course } : c));
      }
    } else {
      const res = await createCourseAction(payload);
      if (res.error) {
        showError(res.error);
      } else if (res.course) {
        showSuccess("Course created successfully!");
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
    const res = await deleteCourseAction(id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Course successfully deleted.");
      setCourses(prev => prev.filter(c => c.id !== id));
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">

      {isStaff && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenCreate}
            className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center gap-1.5"
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
              className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm hover:shadow-md hover:border-[#6E79F4]/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2.5 rounded-xl border border-[#6E79F4]/20">
                    <BookOpen size={18} />
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#16171D] text-[#C2C6D1] border-[#23252C]">
                      {course.course_type?.code || "Theory"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                      course.status?.code === "active"
                        ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
                        : "bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20"
                    }`}>
                      {course.status?.code || "Draft"}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#EDEFF5] mb-1">{course.title}</h3>
                <div className="flex items-center gap-3 text-[10px] text-[#C2C6D1] mb-4">
                  <span>Enrollment: <strong className="font-semibold capitalize text-[#EDEFF5]">{course.enrollment_mode}</strong></span>
                </div>

                <p className="text-xs text-[#C2C6D1] line-clamp-2 mb-6 leading-relaxed">
                  {course.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#23252C]">
                {isStaff ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(course)}
                      className="p-2 border border-[#23252C] rounded-lg hover:bg-[#16171D] text-[#C2C6D1] transition-colors"
                      title="Edit Course"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      className="p-2 border border-[#23252C] rounded-lg hover:bg-[#F0555D]/5 text-[#F0555D] border-[#F0555D]/10 transition-colors"
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
                  className="flex items-center gap-1 text-[11px] font-bold text-[#6E79F4] hover:underline"
                >
                  Enter Course Space <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-[#131418] border border-[#23252C] rounded-xl p-12 text-center text-xs text-[#C2C6D1]">
            <BookOpen className="mx-auto mb-2 text-[#C2C6D1]/40" size={32} />
            <p className="font-medium text-[#EDEFF5]">No Courses Found Under This Program</p>
            <p className="mt-1">Add courses to build curriculum modules and lesson chapters.</p>
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      {isOpen && (
        <div className="fixed inset-0 bg-[#6E79F4]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col text-xs text-[#EDEFF5]">
            
            <div className="bg-[#16171D] px-6 py-4 border-b border-[#23252C] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#EDEFF5]">
                {editingCourse ? "Edit Course Details" : "Create New Teachable Course"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#C2C6D1] hover:text-[#EDEFF5] p-1.5"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Course Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. React Fundamentals"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Course URL Slug *</label>
                  <input
                    type="text"
                    placeholder="e.g. react-fundamentals"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-mono"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Course Description</label>
                  <textarea
                    placeholder="Provide overview details, pre-requisites..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none"
                  />
                </div>



                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Enrollment Mode *</label>
                  <select
                    value={enrollmentMode}
                    onChange={(e) => setEnrollmentMode(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    <option value="open">Open (Publicly Joinable)</option>
                    <option value="approval">Approval (Awaiting Admin validation)</option>
                    <option value="private">Private (Invite Link Only)</option>
                    <option value="institution_only">Institution Only (Linked Tenant domain)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Course Type *</label>
                  <select
                    value={courseTypeId}
                    onChange={(e) => setCourseTypeId(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    {lookups.courseTypes.map((c) => (
                      <option key={c.id} value={c.id}>{c.description}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Thumbnail Path (Storage)</label>
                  <input
                    type="text"
                    placeholder="e.g. course-thumbnails/react.jpg"
                    value={thumbnailPath}
                    onChange={(e) => setThumbnailPath(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Workflow Status *</label>
                  <select
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    {lookups.statuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.description}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#C2C6D1]">Visibility Type *</label>
                  <select
                    value={visibilityId}
                    onChange={(e) => setVisibilityId(e.target.value)}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                  >
                    {lookups.visibilityTypes.map((v) => (
                      <option key={v.id} value={v.id}>{v.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#23252C] mt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#23252C] hover:bg-[#16171D] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6E79F4]/95 transition-colors disabled:opacity-50"
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
