"use client";

import React, { useState } from "react";
import { Folder, ArrowRight, Eye, Edit, Trash2, Plus, X, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { createProgramAction, updateProgramAction, deleteProgramAction } from "@/app/actions/academic-actions";
import { useRouter } from "next/navigation";

interface ClientProgramListProps {
  initialPrograms: any[];
  primaryRole: string;
  lookups: {
    courseTypes: any[];
    lessonTypes: any[];
    statuses: any[];
    visibilityTypes: any[];
  };
}

export default function ClientProgramList({ initialPrograms, primaryRole, lookups }: ClientProgramListProps) {
  const router = useRouter();
  const [programs, setPrograms] = useState(initialPrograms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isStaff = ["super_admin", "institution_admin", "teacher", "trainer"].includes(primaryRole);

  // Form Modal toggles
  const [isOpen, setIsOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(lookups.statuses.find(s => s.code === "draft")?.id || "");
  const [visibilityId, setVisibilityId] = useState(lookups.visibilityTypes.find(v => v.code === "private")?.id || "");

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setStatusId(lookups.statuses.find(s => s.code === "draft")?.id || "");
    setVisibilityId(lookups.visibilityTypes.find(v => v.code === "private")?.id || "");
    setError("");
    setIsOpen(true);
  };

  const handleOpenEdit = (program: any) => {
    setEditingProgram(program);
    setTitle(program.title);
    setSlug(program.slug);
    setDescription(program.description || "");
    setStatusId(program.status_id);
    setVisibilityId(program.visibility_type_id);
    setError("");
    setIsOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingProgram) {
      // Auto generate slug
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

    if (editingProgram) {
      const res = await updateProgramAction(editingProgram.id, {
        title,
        slug,
        description,
        status_id: statusId,
        visibility_type_id: visibilityId,
      });

      if (res.error) {
        setError(res.error);
      } else if (res.program) {
        setSuccess("Program updated successfully!");
        setIsOpen(false);
        router.refresh();
        // Fallback update state
        setPrograms(prev => prev.map(p => p.id === editingProgram.id ? { ...p, ...res.program } : p));
      }
    } else {
      const res = await createProgramAction({
        title,
        slug,
        description,
        status_id: statusId,
        visibility_type_id: visibilityId,
      });

      if (res.error) {
        setError(res.error);
      } else if (res.program) {
        setSuccess("Program created successfully!");
        setIsOpen(false);
        router.refresh();
        setPrograms(prev => [res.program, ...prev]);
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete program "${name}"? All nested courses will also be isolated.`)) {
      return;
    }

    setLoading(true);
    setError("");
    const res = await deleteProgramAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Program successfully deleted.");
      setPrograms(prev => prev.filter(p => p.id !== id));
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      
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

      {/* Action Header for Staff */}
      {isStaff && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenCreate}
            className="bg-[#2563EB] text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-semibold hover:bg-[#2563EB]/95 transition-all flex items-center gap-1.5"
          >
            <Plus size={15} /> Create Program
          </button>
        </div>
      )}

      {/* Program Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {programs.length > 0 ? (
          programs.map((program) => (
            <div
              key={program.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-[#2563EB]/10 text-[#2563EB] p-2.5 rounded-xl border border-[#2563EB]/20">
                    <Folder size={18} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Badge details */}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                      program.status?.code === "active"
                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                        : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                    }`}>
                      {program.status?.code || "Draft"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-100 text-[#475569] border-[#E2E8F0] capitalize">
                      {program.visibility?.code || "Private"}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#0F172A] truncate mb-2">{program.title}</h3>
                <p className="text-xs text-[#475569] line-clamp-3 mb-6 leading-relaxed">
                  {program.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
                {isStaff ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(program)}
                      className="p-2 border border-[#E2E8F0] rounded-lg hover:bg-slate-50 text-[#475569] transition-colors"
                      title="Edit Program"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(program.id, program.title)}
                      className="p-2 border border-[#E2E8F0] rounded-lg hover:bg-[#DC2626]/5 text-[#DC2626] border-[#DC2626]/10 transition-colors"
                      title="Delete Program"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <Link
                  href={`/academic/${program.slug}`}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline"
                >
                  View Courses <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-[#475569]">
            <Folder className="mx-auto mb-2 text-[#475569]/40" size={32} />
            <p className="font-medium text-[#0F172A]">No Academic Programs Found</p>
            <p className="mt-1">Add programs to isolate syllabus structures by curriculum path.</p>
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      {isOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col text-xs text-[#0F172A]">
            
            <div className="bg-slate-50 px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0F172A]">
                {editingProgram ? "Edit Program Details" : "Create New Program"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#475569] hover:text-[#0F172A] p-1.5"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-[#475569]">Program Title *</label>
                <input
                  type="text"
                  placeholder="e.g. AI Engineering"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#475569]">Subdomain URL Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. ai-engineering"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#475569]">Description</label>
                <textarea
                  placeholder="Brief curriculum scope summary..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] shadow-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  {loading ? "Saving..." : editingProgram ? "Update Program" : "Create Program"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
