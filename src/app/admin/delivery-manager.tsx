"use client";

import React, { useState, useEffect } from "react";
import {
  createCohortAction,
  updateCohortAction,
  deleteCohortAction,
  enrollStudentAction,
  updateEnrollmentStatusAction,
  removeEnrollmentAction,
  assignCourseAction,
  removeCourseAssignmentAction,
  listCohortsAction,
  listEnrollmentsAction,
  listCourseAssignmentsAction,
  listInstitutionStudentsAction,
  getDeliveryLookupsAction,
  getStudentDeliveryDataAction,
  listStudentLessonProgressAction
} from "@/app/actions/delivery-actions";
import { listProgramsAction, listCoursesAction, listLessonsForCourseAction } from "@/app/actions/academic-actions";
import { useQueryClient } from "@tanstack/react-query";
import { useDeliveryData, useLearningData } from "@/hooks/use-delivery";
import { usePrograms } from "@/hooks/use-academics";
import { useToast } from "@/components/toast";
import { 
  Building, 
  Users, 
  UserCheck, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit,
  Check,
  FileText,
  TrendingUp,
  Award,
  Clock,
  ExternalLink,
  ChevronDown,
  X
} from "lucide-react";
import { SecondaryLoader } from "@/components/secondary-loader";
import { CustomSelect } from "@/components/custom-select";

interface DeliveryManagerProps {
  institutions: any[];
  initialTab: "cohorts" | "enrollments" | "assignments";
  isTeacherMode?: boolean;
}

export default function DeliveryManager({ institutions, initialTab, isTeacherMode = false }: DeliveryManagerProps) {
  const [selectedInstId, setSelectedInstId] = useState(institutions[0]?.id || "");
  const [activeSubTab, setActiveSubTab] = useState<"cohorts" | "enrollments" | "assignments">(initialTab as any);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const queryClient = useQueryClient();

  // React Query prefetching hooks
  const { data: deliveryData } = useDeliveryData(selectedInstId);
  const { data: learningData } = useLearningData(selectedInstId);
  const { data: acadPrograms } = usePrograms(selectedInstId);

  // Derive list views instantly from cache
  const cohorts = deliveryData?.cohorts || [];
  const enrollments = deliveryData?.enrollments || [];
  const assignments = deliveryData?.assignments || [];
  const students = deliveryData?.students || [];
  
  const activities = learningData?.activities || [];
  const quizAttempts = learningData?.quizAttempts || [];
  const projectSubmissions = learningData?.projectSubmissions || [];
  const challengeSubmissions = learningData?.challengeSubmissions || [];

  const programs = acadPrograms || [];
  // For assignments, we need all courses in the institution. We can get them from acadPrograms or prefetch.
  // Actually we can just leave allCourses empty if not strictly required, or fetch on demand.
  const [allCourses, setAllCourses] = useState<any[]>([]);

  // Lookup structures
  const [cohortStatuses, setCohortStatuses] = useState<any[]>([]);
  const [enrollmentStatuses, setEnrollmentStatuses] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  // Modals & Form states
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<any | null>(null);
  const [cohortForm, setCohortForm] = useState({
    name: "",
    code: "",
    start_date: "",
    end_date: "",
    status_code: "active",
    program_id: ""
  });

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [enrollForm, setEnrollForm] = useState({
    user_id: "",
    cohort_id: "",
    status_code: "active"
  });
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    cohort_id: "",
    course_id: "",
    start_date: "",
    due_date: "",
    is_required: true
  });

  // Selected Student Drawer States
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [activeStudentProgress, setActiveStudentProgress] = useState<any[]>([]);
  const [activeStudentLessonsProgress, setActiveStudentLessonsProgress] = useState<any[]>([]);
  const [drawerLessonsCache, setDrawerLessonsCache] = useState<Record<string, any[]>>({});
  const [studentDetailTab, setStudentDetailTab] = useState<"overview" | "syllabus" | "quizzes" | "projects" | "challenges">("overview");

  // Accordion drawer selection states
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Scroll lock when any sidebar drawer is open to prevent background viewport scrolling
  useEffect(() => {
    const isOpen = cohortModalOpen || enrollModalOpen || assignModalOpen || !!selectedStudent;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [cohortModalOpen, enrollModalOpen, assignModalOpen, selectedStudent]);

  // Fetch drawer details on student click
  useEffect(() => {
    if (selectedStudent) {
      const studentId = selectedStudent.user_id;

      getStudentDeliveryDataAction(studentId).then(res => {
        if (res.success && res.programs) setActiveStudentProgress(res.programs);
        else setActiveStudentProgress([]);
      });

      listStudentLessonProgressAction(studentId).then(res => {
        if (res.success && res.progressList) setActiveStudentLessonsProgress(res.progressList);
        else setActiveStudentLessonsProgress([]);
      });
    } else {
      setActiveStudentProgress([]);
      setActiveStudentLessonsProgress([]);
    }
  }, [selectedStudent]);

  // Lazy load lessons inside selected student drawer
  useEffect(() => {
    if (expandedCourseId && !drawerLessonsCache[expandedCourseId]) {
      listLessonsForCourseAction(expandedCourseId).then(res => {
        if (res.success && res.lessons) {
          setDrawerLessonsCache(prev => ({ ...prev, [expandedCourseId]: res.lessons }));
        }
      });
    }
  }, [expandedCourseId, drawerLessonsCache]);

  // Load initial lookups
  useEffect(() => {
    async function loadLookups() {
      const res = await getDeliveryLookupsAction();
      if (res.lookups) {
        setCohortStatuses(res.lookups.cohortStatuses || []);
        setEnrollmentStatuses(res.lookups.enrollmentStatuses || []);
      }
    }
    loadLookups();
  }, []);

  const refreshLists = async () => {
    await queryClient.invalidateQueries({ queryKey: ["delivery-prefetch", selectedInstId] });
  };

  const handleCohortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingCohort) {
        const res = await updateCohortAction(editingCohort.id, {
          name: cohortForm.name,
          code: cohortForm.code,
          start_date: cohortForm.start_date || undefined,
          end_date: cohortForm.end_date || undefined,
          status_code: cohortForm.status_code
        });
        if (res.error) {
          showError(res.error);
        } else {
          showSuccess("Group updated successfully!");
          setCohortModalOpen(false);
          setEditingCohort(null);
          await refreshLists();
        }
      } else {
        const res = await createCohortAction({
          tenant_id: selectedInstId,
          institution_id: selectedInstId,
          program_id: cohortForm.program_id,
          name: cohortForm.name,
          code: cohortForm.code,
          start_date: cohortForm.start_date || undefined,
          end_date: cohortForm.end_date || undefined,
          status_code: cohortForm.status_code
        });
        if (res.error) {
          showError(res.error);
        } else {
          showSuccess("Group created successfully!");
          setCohortModalOpen(false);
          await refreshLists();
        }
      }
    } catch (err: any) {
      showError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCohortClick = (cohort: any) => {
    setEditingCohort(cohort);
    setCohortForm({
      name: cohort.name,
      code: cohort.code,
      start_date: cohort.start_date ? cohort.start_date.substring(0, 10) : "",
      end_date: cohort.end_date ? cohort.end_date.substring(0, 10) : "",
      status_code: cohort.status_code,
      program_id: cohort.program_id
    });
    setCohortModalOpen(true);
  };

  const handleDeleteCohort = async (id: string) => {
    if (!confirm("Are you sure you want to soft delete this group?")) return;
    const res = await deleteCohortAction(id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Group deleted successfully!");
      await refreshLists();
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStudentIds.length === 0) {
      showError("Please select at least one student to enroll.");
      return;
    }

    setLoading(true);
    try {
      const enrollPromises = selectedStudentIds.map(userId =>
        enrollStudentAction({
          user_id: userId,
          cohort_id: enrollForm.cohort_id,
          status_code: enrollForm.status_code
        })
      );
      
      const results = await Promise.all(enrollPromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        showError(`Enrolled some students, but encountered errors: ${errors.map(e => e.error).join(", ")}`);
      } else {
        showSuccess(`Successfully enrolled ${selectedStudentIds.length} student(s) into the group!`);
        setEnrollModalOpen(false);
      }
    } catch (err: any) {
      showError(err.message || "Failed to enroll students.");
    } finally {
      setLoading(false);
      await refreshLists();
    }
  };

  const handleEnrollStatusChange = async (id: string, newStatus: string) => {
    const res = await updateEnrollmentStatusAction(id, newStatus);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Enrollment status updated!");
      await refreshLists();
    }
  };

  const handleRemoveEnrollment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this enrollment?")) return;
    const res = await removeEnrollmentAction(id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Enrollment removed successfully!");
      await refreshLists();
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isAlreadyAssigned = assignments.some(
        ass => ass.cohort_id === assignForm.cohort_id && ass.course_id === assignForm.course_id
      );
      if (isAlreadyAssigned) {
        showError("This course is already assigned to the selected group.");
        return;
      }

      const res = await assignCourseAction({
        cohort_id: assignForm.cohort_id,
        course_id: assignForm.course_id,
        start_date: assignForm.start_date || undefined,
        due_date: assignForm.due_date || undefined,
        is_required: assignForm.is_required
      });

      if (res.error) {
        showError(res.error);
      } else {
        showSuccess("Course successfully assigned to group!");
        setAssignModalOpen(false);
        await refreshLists();
      }
    } catch (err: any) {
      showError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this course assignment?")) return;
    const res = await removeCourseAssignmentAction(id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess("Course assignment removed!");
      await refreshLists();
    }
  };

  return (
    <div className="space-y-6 text-xs text-[#EDEFF5]">
      
      {/* Institution Scope selector */}
      <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-[#C2C6D1] flex items-center gap-1.5">
            <Building size={15} /> Delivery Scope Management
          </h3>
          <p className="text-[10px] text-[#C2C6D1] leading-relaxed">
            Manage student batches, enroll students, and assign courses to groups.
          </p>
        </div>
        <CustomSelect
          options={institutions.map((inst) => ({ id: inst.id, name: inst.name, code: inst.institution_code }))}
          value={selectedInstId}
          onChange={setSelectedInstId}
          required
          className="sm:max-w-xs"
        />
      </div>

      {/* Sub Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-[#23252C] scrollbar-none">
        <button
          onClick={() => setActiveSubTab("cohorts")}
          className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "cohorts"
              ? "border-[#6E79F4] text-[#6E79F4]"
              : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
          }`}
        >
          <Users size={14} />
          Groups ({cohorts.length})
        </button>
        {!isTeacherMode && (
          <button
            onClick={() => setActiveSubTab("enrollments")}
            className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "enrollments"
                ? "border-[#6E79F4] text-[#6E79F4]"
                : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
            }`}
          >
            <UserCheck size={14} />
            Enrollments ({enrollments.length})
          </button>
        )}
        {!isTeacherMode && (
          <button
            onClick={() => setActiveSubTab("assignments")}
            className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "assignments"
                ? "border-[#6E79F4] text-[#6E79F4]"
                : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
            }`}
          >
            <BookOpen size={14} />
            Course Assignments ({assignments.length})
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <SecondaryLoader variant="spinner" message="Syncing delivery records..." />
      )}

      {/* cohorts view */}
      {!loading && activeSubTab === "cohorts" && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h4 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wider">Active Groups</h4>
            {!isTeacherMode && (
              <button
                onClick={() => {
                  setEditingCohort(null);
                  setCohortForm({ name: "", code: "", start_date: "", end_date: "", status_code: "active", program_id: programs[0]?.id || "" });
                  setCohortModalOpen(true);
                }}
                className="bg-[#6E79F4] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center gap-1 shrink-0"
              >
                <Plus size={13} /> Create Group
              </button>
            )}
          </div>

          <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                    <th className="px-6 py-3">Group Name</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Program</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Timeline</th>
                    {!isTeacherMode && <th className="px-6 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252C]">
                  {cohorts.length > 0 ? (
                    cohorts.map((cohort) => (
                      <tr key={cohort.id} className="hover:bg-[#16171D]/30">
                        <td className="px-6 py-3.5 font-semibold text-[#EDEFF5]">{cohort.name}</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1] font-mono">{cohort.code}</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1]">{cohort.program?.title}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            cohort.status_code === "active" ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20" : "bg-[#1A1C22] text-[#C2C6D1] border-[#23252C]"
                          }`}>
                            {cohort.status_code}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#C2C6D1] font-mono">
                          {cohort.start_date ? cohort.start_date.substring(0, 10) : "N/A"} to {cohort.end_date ? cohort.end_date.substring(0, 10) : "N/A"}
                        </td>
                        {!isTeacherMode && (
                          <td className="px-6 py-3.5 text-right flex items-center justify-end gap-2.5">
                            <button onClick={() => handleEditCohortClick(cohort)} className="text-[#6E79F4] hover:text-[#6E79F4]/80" title="Edit">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteCohort(cohort.id)} className="text-[#F0555D] hover:text-[#F0555D]/80" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isTeacherMode ? 5 : 6} className="px-6 py-8 text-center text-[#C2C6D1] font-semibold bg-[#16171D]/10">
                        No groups defined under this campus yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* enrollments view */}
      {!loading && activeSubTab === "enrollments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#16171D] p-4 border border-[#23252C] rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <label className="font-bold text-xs text-[#C2C6D1] uppercase tracking-wider whitespace-nowrap">Filter Group Batch:</label>
              <CustomSelect
                options={cohorts.map(coh => ({ id: coh.id, name: coh.name, code: coh.code }))}
                value={selectedCohortFilter}
                onChange={setSelectedCohortFilter}
                placeholder="-- All Groups --"
                className="sm:min-w-[200px] sm:w-auto"
              />
            </div>
            
            <button
              onClick={() => {
                const defaultCohortId = cohorts[0]?.id || "";
                setEnrollForm({ user_id: "", cohort_id: defaultCohortId, status_code: "active" });
                // Filter out students already enrolled in this cohort
                const eligible = students.filter(stu => 
                  !enrollments.some(e => e.cohort_id === defaultCohortId && e.user_id === stu.id)
                );
                setSelectedStudentIds(eligible.map(s => s.id));
                setStudentSearchQuery("");
                setEnrollModalOpen(true);
              }}
              className="bg-[#6E79F4] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center justify-center gap-1 shrink-0 w-full sm:w-auto text-xs"
            >
              <Plus size={13} /> Enroll Students
            </button>
          </div>

          <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Group</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Enrolled At</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252C]">
                  {(() => {
                    const filteredEnrollments = selectedCohortFilter
                      ? enrollments.filter(e => e.cohort_id === selectedCohortFilter)
                      : enrollments;
                    return filteredEnrollments.length > 0 ? (
                      filteredEnrollments.map((enr) => (
                      <tr key={enr.id} className="hover:bg-[#16171D]/30">
                        <td className="px-6 py-3.5 font-semibold text-[#EDEFF5]">{enr.student?.full_name || "N/A"}</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1]">{enr.student?.email || "N/A"}</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1]">{enr.cohort?.name} ({enr.cohort?.code})</td>
                        <td className="px-6 py-3.5">
                          <select
                            value={enr.status_code}
                            onChange={(e) => handleEnrollStatusChange(enr.id, e.target.value)}
                            className="bg-[#131418] border border-[#23252C] rounded px-2 py-0.5 font-semibold text-[10px]"
                          >
                            {enrollmentStatuses.map(status => (
                              <option key={status.code} value={status.code}>{status.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-3.5 text-[#C2C6D1] font-mono">
                          {enr.enrolled_at ? enr.enrolled_at.substring(0, 10) : "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button onClick={() => handleRemoveEnrollment(enr.id)} className="text-[#F0555D] hover:text-[#F0555D]/80" title="Remove enrollment">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#C2C6D1] font-semibold bg-[#16171D]/10">
                        No student enrollments registered.
                      </td>
                    </tr>
                  );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* course assignments view */}
      {!loading && activeSubTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wider">Assigned Courses to Groups</h4>
            <button
              onClick={() => {
                setAssignForm({ cohort_id: cohorts[0]?.id || "", course_id: allCourses[0]?.id || "", start_date: "", due_date: "", is_required: true });
                setAssignModalOpen(true);
              }}
              className="bg-[#6E79F4] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all flex items-center gap-1"
            >
              <Plus size={13} /> Assign Course
            </button>
          </div>

          <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                    <th className="px-6 py-3">Course Name</th>
                    <th className="px-6 py-3">Group</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Required</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252C]">
                  {assignments.length > 0 ? (
                    assignments.map((ass) => (
                      <tr key={ass.id} className="hover:bg-[#16171D]/30">
                        <td className="px-6 py-3.5 font-semibold text-[#EDEFF5]">{ass.course?.title}</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1]">{ass.cohort?.name} ({ass.cohort?.code})</td>
                        <td className="px-6 py-3.5 text-[#C2C6D1] font-medium">Academic Assigned</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            ass.is_required ? "bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20" : "bg-[#1A1C22] text-[#C2C6D1] border-[#23252C]"
                          }`}>
                            {ass.is_required ? "Required" : "Optional"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button onClick={() => handleRemoveAssignment(ass.id)} className="text-[#F0555D] hover:text-[#F0555D]/80" title="Remove course assignment">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#C2C6D1] font-semibold bg-[#16171D]/10">
                        No course assignments defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {cohortModalOpen && !isTeacherMode && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setCohortModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <Users size={16} className="text-[#6E79F4]" /> {editingCohort ? "Edit Group" : "Create New Group"}
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Define student batch timelines and assign program pathways.</p>
              </div>
              <button
                onClick={() => setCohortModalOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#A3A9B6] hover:text-[#C2C6D1] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleCohortSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {!editingCohort && (
                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1]">Select Academic Program *</label>
                    <select
                      value={cohortForm.program_id}
                      onChange={(e) => setCohortForm({ ...cohortForm, program_id: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                      required
                    >
                      <option value="">-- Choose Program --</option>
                      {programs.map(prog => (
                        <option key={prog.id} value={prog.id}>{prog.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Group Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. FSD-2026-A"
                    required
                    value={cohortForm.name}
                    onChange={(e) => setCohortForm({ ...cohortForm, name: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Business Identifier Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. FSD-2026-A"
                    required
                    value={cohortForm.code}
                    onChange={(e) => setCohortForm({ ...cohortForm, code: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1]">Start Date</label>
                    <input
                      type="date"
                      value={cohortForm.start_date}
                      onChange={(e) => setCohortForm({ ...cohortForm, start_date: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#C2C6D1]">End Date</label>
                    <input
                      type="date"
                      value={cohortForm.end_date}
                      onChange={(e) => setCohortForm({ ...cohortForm, end_date: e.target.value })}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Group Status *</label>
                  <select
                    value={cohortForm.status_code || "active"}
                    onChange={(e) => setCohortForm({ ...cohortForm, status_code: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                    required
                  >
                    {cohortStatuses.length === 0 ? (
                      <option value="active">Active</option>
                    ) : (
                      cohortStatuses.map(status => (
                        <option key={status.code} value={status.code}>
                          {status.code.charAt(0).toUpperCase() + status.code.slice(1)} - {status.description}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setCohortModalOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                 <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50 transition-colors"
                >
                  {loading ? (editingCohort ? "Saving..." : "Creating...") : (editingCohort ? "Save Changes" : "Create Group")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Enroll Student Right Sidebar Panel */}
      {enrollModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setEnrollModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <Users size={16} className="text-[#6E79F4]" /> Enroll Students
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Select a group and enroll multiple students at once.</p>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#A3A9B6] hover:text-[#C2C6D1] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleEnrollSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
                {/* Cohort Select */}
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Select Group Batch *</label>
                  <select
                    value={enrollForm.cohort_id}
                    onChange={(e) => {
                      const newCohortId = e.target.value;
                      setEnrollForm({ ...enrollForm, cohort_id: newCohortId });
                      // Filter out students already enrolled in this new cohort
                      const eligible = students.filter(stu => 
                        !enrollments.some(enr => enr.cohort_id === newCohortId && enr.user_id === stu.id)
                      );
                      setSelectedStudentIds(eligible.map(s => s.id));
                    }}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  >
                    <option value="">-- Choose Group Batch --</option>
                    {cohorts.map(coh => (
                      <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
                    ))}
                  </select>
                </div>

                {/* Enrollment Status */}
                <div className="space-y-1">
                  <label className="block font-bold text-[#C2C6D1]">Enrollment Status *</label>
                  <select
                    value={enrollForm.status_code}
                    onChange={(e) => setEnrollForm({ ...enrollForm, status_code: e.target.value })}
                    className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                    required
                  >
                    {enrollmentStatuses.map(status => (
                      <option key={status.code} value={status.code}>{status.code} - {status.description}</option>
                    ))}
                  </select>
                </div>

                {/* Students check list */}
                <div className="space-y-2 flex flex-col flex-grow min-h-[350px]">
                  {(() => {
                    const filteredStudents = students.filter(stu => {
                      if (!studentSearchQuery.trim()) return true;
                      const q = studentSearchQuery.toLowerCase();
                      return (stu.full_name || "").toLowerCase().includes(q) || (stu.email || "").toLowerCase().includes(q);
                    });

                    const eligibleStudents = filteredStudents.filter(stu => 
                      !enrollments.some(e => e.cohort_id === enrollForm.cohort_id && e.user_id === stu.id)
                    );
                    const isAllSelected = eligibleStudents.length > 0 && eligibleStudents.every(s => selectedStudentIds.includes(s.id));
                    return (
                      <>
                        <div className="space-y-1.5 mb-1.5 shrink-0">
                          <label className="block font-bold text-[#C2C6D1]">Search Student</label>
                          <input
                            type="text"
                            placeholder="🔍 Search student name or email..."
                            value={studentSearchQuery}
                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-semibold text-[#EDEFF5]"
                          />
                        </div>

                        <div className="flex items-center justify-between border-b border-[#1F2128] pb-1.5 mb-1 shrink-0">
                          <label className="block font-bold text-[#C2C6D1]">Student Directory</label>
                          <label className="flex items-center gap-1.5 text-xs text-[#6E79F4] font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds(prev => {
                                    const set = new Set([...prev, ...eligibleStudents.map(s => s.id)]);
                                    return Array.from(set);
                                  });
                                } else {
                                  const eligibleIds = eligibleStudents.map(s => s.id);
                                  setSelectedStudentIds(prev => prev.filter(id => !eligibleIds.includes(id)));
                                }
                              }}
                              className="rounded text-[#6E79F4] focus:ring-[#6E79F4]"
                            />
                            <span>Select All ({eligibleStudents.length})</span>
                          </label>
                        </div>
                        
                        {/* Scrollable checklist container */}
                        <div className="border border-[#23252C] rounded-lg flex-1 overflow-y-auto p-2 bg-[#16171D]/30 divide-y divide-[#1F2128]">
                          {filteredStudents.length > 0 ? (
                            filteredStudents.map(stu => {
                              const isAlreadyEnrolled = enrollments.some(
                                e => e.cohort_id === enrollForm.cohort_id && e.user_id === stu.id
                              );
                              const isSelected = isAlreadyEnrolled || selectedStudentIds.includes(stu.id);
                              return (
                                <label
                                  key={stu.id}
                                  className="flex items-start gap-3 p-2 hover:bg-[#131418] transition-all text-xs cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isAlreadyEnrolled}
                                    onChange={() => {
                                      if (isAlreadyEnrolled) return;
                                      if (selectedStudentIds.includes(stu.id)) {
                                        setSelectedStudentIds(prev => prev.filter(id => id !== stu.id));
                                      } else {
                                        setSelectedStudentIds(prev => [...prev, stu.id]);
                                      }
                                    }}
                                    className={`mt-0.5 rounded text-[#6E79F4] focus:ring-[#6E79F4] ${
                                      isAlreadyEnrolled ? "opacity-50 cursor-not-allowed text-[#A3A9B6]" : ""
                                    }`}
                                  />
                                  <div className="min-w-0">
                                    <span className={`font-semibold block ${isAlreadyEnrolled ? "text-[#A3A9B6]" : "text-[#EDEFF5]"}`}>
                                      {stu.full_name} {isAlreadyEnrolled && <span className="text-[10px] text-[#C2C6D1] font-normal italic">(Already Enrolled)</span>}
                                    </span>
                                    <span className="text-[#C2C6D1] text-[10px] block truncate">{stu.email}</span>
                                  </div>
                                </label>
                              );
                            })
                          ) : (
                            <div className="text-center py-10 text-[#C2C6D1] italic">
                              No students found.
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Enrolling..." : `Enroll Selected (${selectedStudentIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Assign Course Right Sidebar Panel */}
      {assignModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setAssignModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-[#23252D]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-[#131418] border-l border-[#23252C] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#EDEFF5]">
            {/* Header */}
            <div className="bg-[#16171D] px-6 py-5 border-b border-[#23252C] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5] flex items-center gap-1.5">
                  <BookOpen size={16} className="text-[#6E79F4]" /> Assign Course to Group
                </h3>
                <p className="text-[10px] text-[#C2C6D1] mt-0.5">Publish syllabus courses and schedule group milestones.</p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 hover:bg-[#1A1C22] rounded-lg text-[#A3A9B6] hover:text-[#C2C6D1] transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleAssignSubmit} className="flex-1 flex flex-col min-h-0">
              {(() => {
                const selectedCohortForAssign = cohorts.find(c => c.id === assignForm.cohort_id);

                return (
                  <>
                    <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                      <div className="space-y-1">
                        <label className="block font-bold text-[#C2C6D1]">Select Group *</label>
                        <select
                          value={assignForm.cohort_id}
                          onChange={(e) => setAssignForm({ ...assignForm, cohort_id: e.target.value, start_date: "", due_date: "" })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                          required
                        >
                          <option value="">-- Choose Group Batch --</option>
                          {cohorts.map(coh => (
                            <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
                          ))}
                        </select>
                        {selectedCohortForAssign && (
                          <p className="text-[10px] text-[#C2C6D1] font-medium mt-1">
                            Group functioning dates:{" "}
                            <span className="text-[#6E79F4] font-semibold">
                              {selectedCohortForAssign.start_date ? selectedCohortForAssign.start_date.split("T")[0] : "No Start"}
                            </span>{" "}
                            to{" "}
                            <span className="text-[#6E79F4] font-semibold">
                              {selectedCohortForAssign.end_date ? selectedCohortForAssign.end_date.split("T")[0] : "No End"}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-[#C2C6D1]">Select Academic Course *</label>
                        <select
                          value={assignForm.course_id}
                          onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
                          required
                        >
                          <option value="">-- Choose Course --</option>
                          {allCourses.map(course => {
                            const isAlreadyAssigned = assignments.some(
                              ass => ass.cohort_id === assignForm.cohort_id && ass.course_id === course.id
                            );
                            return (
                              <option key={course.id} value={course.id} disabled={isAlreadyAssigned}>
                                {course.title} {isAlreadyAssigned ? "(Already Assigned)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>



                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="isRequired"
                          checked={assignForm.is_required}
                          onChange={(e) => setAssignForm({ ...assignForm, is_required: e.target.checked })}
                          className="rounded border-[#23252C] text-[#6E79F4] focus:ring-[#6E79F4]"
                        />
                        <label htmlFor="isRequired" className="font-semibold text-[#C2C6D1] select-none cursor-pointer">Mandatory / Required Course</label>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="bg-[#16171D] border-t border-[#23252C] p-5 flex flex-wrap justify-end gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAssignModalOpen(false)}
                        className="border border-[#23252C] hover:bg-[#1A1C22] px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                       <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#6E79F4] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50 transition-colors"
                      >
                        {loading ? "Assigning..." : "Assign Course"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </>
      )}

      {/* Roster detail drawer */}
      {(() => {
        if (!selectedStudent) return null;

        const progressPercentage = selectedStudent.progress_percentage || 0;
        const studentProjSubs = projectSubmissions.filter(sub => sub.student_id === selectedStudent.user_id);
        const studentChalSubs = challengeSubmissions.filter(sub => sub.student_id === selectedStudent.user_id);
        const studentQuizAttemptsList = quizAttempts.filter(att => att.student_id === selectedStudent.user_id);

        const quizzes = activities.filter(a => a.activity_type_code === "quiz");
        const projects = activities.filter(a => a.activity_type_code === "project");
        const challenges = activities.filter(a => a.activity_type_code === "programming");

        const studentQuizAttempts = quizzes.map(q => {
          const attempt = studentQuizAttemptsList.find(att => att.activity_id === q.id);
          return {
            id: q.id,
            title: q.title,
            attempted: !!attempt,
            passed: attempt ? (attempt.score >= (q.passing_score || 0)) : false,
            score: attempt ? attempt.score : 0,
            maxScore: q.max_score || 100,
            submittedAt: attempt ? new Date(attempt.created_at || attempt.updated_at).toLocaleDateString() : "",
            questions: (attempt as any)?.questions || []
          };
        });

        const studentSyllabus = allCourses.map((course) => {
          const courseLessons = drawerLessonsCache[course.id] || [];
          return {
            id: course.id,
            title: course.title,
            lessons: courseLessons.map(l => {
              const progressEntry = activeStudentLessonsProgress.find(p => p.lesson_id === l.id);
              return {
                id: l.id,
                title: l.title,
                status: progressEntry?.status_code || "not_started"
              };
            })
          };
        });

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] flex justify-end animate-fadeIn" onClick={() => setSelectedStudent(null)}>
            <div className="relative w-full max-w-3xl bg-[#131418] h-full shadow-2xl flex flex-col z-[9999] animate-slideOver overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 border-b border-[#23252C] flex justify-between items-start gap-3 bg-[#16171D] shrink-0">
                <div className="flex gap-3 items-center min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#6E79F4] text-white flex items-center justify-center font-bold text-base sm:text-lg uppercase shadow-md border border-[#6E79F4]/10 shrink-0">
                    {(selectedStudent.student?.full_name || selectedStudent.student?.email || "S").substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#EDEFF5] truncate">{selectedStudent.student?.full_name || "Enrolled Student"}</h3>
                    <p className="text-xs text-[#C2C6D1] truncate">{selectedStudent.student?.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20">
                        {selectedStudent.cohort?.name || "No group"}
                      </span>
                      <span className="text-[10px] text-[#C2C6D1]">• Enrolled on {new Date(selectedStudent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-1.5 hover:bg-[#23252C] rounded-xl transition-all border border-transparent hover:border-[#23252C] cursor-pointer shrink-0"
                >
                  <X size={18} className="text-[#C2C6D1]" />
                </button>
              </div>

              {/* Drawer Tab Navigation */}
              <div className="flex border-b border-[#23252C] px-4 sm:px-6 bg-[#131418] shrink-0 overflow-x-auto no-scrollbar">
                {(["overview", "syllabus", "quizzes", "projects", "challenges"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStudentDetailTab(tab)}
                    className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all capitalize cursor-pointer whitespace-nowrap shrink-0 ${
                      studentDetailTab === tab
                        ? "border-[#6E79F4] text-[#6E79F4] font-bold"
                        : "border-transparent text-[#C2C6D1] hover:text-[#EDEFF5]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer Body Scroll */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

                {/* 1. OVERVIEW TAB */}
                {studentDetailTab === "overview" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Course Progress</span>
                        <div className="text-xl font-black text-[#6E79F4] mt-1">{progressPercentage}%</div>
                        <div className="w-full bg-[#23252C] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-[#6E79F4] h-full" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-[#2FBF71]/5 border border-[#2FBF71]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Quizzes Completed</span>
                        <div className="text-xl font-black text-[#2FBF71] mt-1">
                          {studentQuizAttempts.filter(q => q.attempted).length} / {quizzes.length}
                        </div>
                        <span className="text-[8px] text-[#C2C6D1] block mt-2">Avg Score: {
                          studentQuizAttempts.filter(q => q.attempted).length > 0 
                            ? Math.round(studentQuizAttempts.reduce((acc, curr) => acc + curr.score, 0) / studentQuizAttempts.filter(q => q.attempted).length) 
                            : 0
                        }%</span>
                      </div>

                      <div className="bg-[#F5B04A]/5 border border-[#F5B04A]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Projects Validated</span>
                        <div className="text-xl font-black text-[#F5B04A] mt-1">
                          {studentProjSubs.filter(p => p.review?.review_status === "approved").length} / {projects.length}
                        </div>
                        <span className="text-[8px] text-[#C2C6D1] block mt-2">{studentProjSubs.length} total uploads</span>
                      </div>

                      <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Coding Runs</span>
                        <div className="text-xl font-black text-cyan-600 mt-1">
                          {studentChalSubs.filter(c => c.submission_status_code === "accepted").length} / {challenges.length}
                        </div>
                        <span className="text-[8px] text-[#C2C6D1] block mt-2">{studentChalSubs.length} total submits</span>
                      </div>
                    </div>

                    <div className="bg-[#131418] border border-[#23252C] rounded-2xl p-5 space-y-4 shadow-sm">
                      <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-1.5 pb-3 border-b border-[#23252C]">
                        <TrendingUp size={14} className="text-[#6E79F4]" /> Core Curricular Activity Overview
                      </h4>
                      <div className="divide-y divide-[#23252C] text-xs">
                        <div className="py-3 flex justify-between">
                          <span className="text-[#C2C6D1] font-medium">Platform Activity Status</span>
                          <span className="font-bold text-[#2FBF71] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#2FBF71] rounded-full animate-ping"></span> Active in Portal
                          </span>
                        </div>
                        <div className="py-3 flex justify-between">
                          <span className="text-[#C2C6D1] font-medium">Primary Program</span>
                          <span className="font-bold text-[#EDEFF5]">
                            {programs.find(p => p.id === selectedStudent.cohort?.program_id)?.title || "Standard Curriculum"}
                          </span>
                        </div>
                        <div className="py-3 flex justify-between">
                          <span className="text-[#C2C6D1] font-medium">Completed Syllabus Lessons</span>
                          <span className="font-bold text-[#EDEFF5]">
                            {activeStudentLessonsProgress.filter(p => p.status_code === "completed").length} Lessons Completed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SYLLABUS TAB */}
                {studentDetailTab === "syllabus" && (
                  <div className="space-y-6 animate-fadeIn">
                    {studentSyllabus.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                        No syllabus lessons found for this program.
                      </div>
                    ) : (
                      studentSyllabus.map(course => {
                        const isExpanded = expandedCourseId === course.id;
                        return (
                          <div key={course.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden">
                            <div 
                              onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <h4 className="text-xs font-extrabold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{course.title}</h4>
                              </div>
                              <span className="text-[10px] font-bold text-[#6E79F4] bg-[#6E79F4]/10 px-2 py-0.5 rounded-full border border-[#6E79F4]/20 shrink-0">Course</span>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#23252C] space-y-2.5 bg-[#16171D]/30">
                                {course.lessons.map(lesson => (
                                  <div key={lesson.id} className="flex justify-between items-center text-xs p-2.5 bg-[#131418] border border-[#23252C] rounded-xl hover:bg-[#16171D] transition-all shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                      {lesson.status === "completed" ? (
                                        <div className="w-5 h-5 rounded-full bg-[#2FBF71]/10 text-[#2FBF71] flex items-center justify-center font-bold text-[10px] border border-[#2FBF71]/20">✓</div>
                                      ) : lesson.status === "in_progress" ? (
                                        <div className="w-5 h-5 rounded-full bg-[#F5B04A]/10 text-[#F5B04A] flex items-center justify-center font-bold text-[10px] border border-[#F5B04A]/20">⏳</div>
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-[#1A1C22] text-[#A3A9B6] flex items-center justify-center font-bold text-[10px] border border-[#23252C]">•</div>
                                      )}
                                      <span className="font-semibold text-[#EDEFF5]">{lesson.title}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                      lesson.status === "completed" 
                                        ? "bg-[#2FBF71]/10 text-[#2FBF71]" 
                                        : lesson.status === "in_progress"
                                        ? "bg-[#F5B04A]/10 text-[#F5B04A]"
                                        : "bg-[#1A1C22] text-[#C2C6D1]"
                                    }`}>
                                      {lesson.status.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 3. QUIZZES TAB */}
                {studentDetailTab === "quizzes" && (
                  <div className="space-y-6 animate-fadeIn">
                    {studentQuizAttempts.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                        No quizzes assigned for this program.
                      </div>
                    ) : (
                      studentQuizAttempts.map(attempt => {
                        const isExpanded = expandedQuizId === attempt.id;
                        return (
                          <div key={attempt.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden">
                            <div 
                              onClick={() => setExpandedQuizId(isExpanded ? null : attempt.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{attempt.title}</h4>
                                  <p className="text-[9px] text-[#C2C6D1] mt-0.5">Attempted on {attempt.submittedAt}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                {attempt.attempted ? (
                                  <>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase ${
                                      attempt.passed 
                                        ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20" 
                                        : "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
                                    }`}>
                                      {attempt.passed ? "Passed" : "Failed"}
                                    </span>
                                    <div className="text-xs font-black text-[#EDEFF5]">{attempt.score} / {attempt.maxScore} pts</div>
                                  </>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#1A1C22] text-[#A3A9B6] border uppercase">
                                    Unattempted
                                  </span>
                                )}
                              </div>
                            </div>

                            {isExpanded && attempt.attempted && (
                              <div className="p-5 border-t border-[#23252C] space-y-4 bg-[#16171D]/30">
                                <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block">Auditing Answers:</span>
                                <div className="space-y-3">
                                  {attempt.questions.map((q: any, qIdx: number) => {
                                    const isCorrect = q.selectedIndex === q.correctIndex;
                                    return (
                                      <div key={qIdx} className="p-3.5 bg-[#131418] border border-[#23252C] rounded-xl text-xs space-y-2">
                                        <div className="font-semibold text-[#EDEFF5] flex justify-between gap-4">
                                          <span>Q{qIdx + 1}: {q.text}</span>
                                          <span className={`font-black shrink-0 ${isCorrect ? "text-[#2FBF71]" : "text-[#F0555D]"}`}>
                                            {isCorrect ? `+${q.points} pts` : "0 pts"}
                                          </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-1.5 pt-1.5">
                                          {q.options.map((opt: any, oIdx: number) => {
                                            const isSelected = q.selectedIndex === oIdx;
                                            const isAnsCorrect = q.correctIndex === oIdx;
                                            
                                            return (
                                              <div 
                                                key={oIdx} 
                                                className={`p-2 rounded-lg border flex items-center gap-2 text-[11px] ${
                                                  isAnsCorrect 
                                                    ? "bg-[#2FBF71]/10 border-[#2FBF71]/30 text-[#2FBF71] font-bold" 
                                                    : isSelected 
                                                    ? "bg-[#F0555D]/10 border-[#F0555D]/30 text-[#F0555D] font-semibold" 
                                                    : "bg-[#131418] border-[#23252C] text-[#C2C6D1]"
                                                }`}
                                              >
                                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black shrink-0 ${
                                                  isAnsCorrect 
                                                    ? "bg-[#2FBF71] border-transparent text-white" 
                                                    : isSelected 
                                                    ? "bg-[#F0555D] border-transparent text-white" 
                                                    : "border-[#2E313A]"
                                                }`}>
                                                  {oIdx === 0 ? "A" : oIdx === 1 ? "B" : oIdx === 2 ? "C" : "D"}
                                                </div>
                                                <span>{opt.option_text || opt}</span>
                                                {isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#2FBF71]/20 px-1.5 py-0.5 rounded text-[#2FBF71]">Correct Option</span>}
                                                {isSelected && !isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#F0555D]/20 px-1.5 py-0.5 rounded text-[#F0555D]">Submitted Answer</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 4. PROJECTS TAB */}
                {studentDetailTab === "projects" && (
                  <div className="space-y-6 animate-fadeIn">
                    {studentProjSubs.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                        No project repository uploads submitted yet.
                      </div>
                    ) : (
                      studentProjSubs.map(sub => {
                        const isExpanded = expandedProjectId === sub.id;
                        return (
                          <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                            <div 
                              onClick={() => setExpandedProjectId(isExpanded ? null : sub.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-[#16171D]/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#C2C6D1] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">{sub.project_title}</h4>
                                  <p className="text-[9px] text-[#C2C6D1] mt-0.5">Submitted on {new Date(sub.submitted_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase shrink-0 ${
                                sub.review?.review_status === "approved"
                                  ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
                                  : "bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20"
                              }`}>
                                {sub.review?.review_status || "Pending Review"}
                              </span>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#23252C] space-y-3 bg-[#16171D]/30">
                                <div>
                                  <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wide block mb-1">GitHub Submission Link</span>
                                  <a href={sub.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6E79F4] font-bold hover:underline flex items-center gap-1 w-fit">
                                    {sub.github_url} <ExternalLink size={12} />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 5. CHALLENGES TAB */}
                {studentDetailTab === "challenges" && (
                  <div className="space-y-6 animate-fadeIn">
                    {studentChalSubs.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-[#23252C] rounded-xl text-xs text-[#C2C6D1]">
                        No programming challenge submissions found.
                      </div>
                    ) : (
                      studentChalSubs.map(sub => (
                        <div key={sub.id} className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm flex flex-col gap-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-[#EDEFF5]">{sub.challenge_title}</h5>
                              <p className="text-[9px] text-[#C2C6D1] mt-0.5">Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sub.submission_status_code === "accepted" ? "bg-[#2FBF71]/10 text-[#2FBF71]" : "bg-red-50 text-red-600"
                            }`}>
                              {sub.submission_status_code}
                            </span>
                          </div>
                          {sub.result && (
                            <div className="bg-[#16171D] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] border border-[#23252C] mt-1">
                              <div>
                                <span className="text-[#C2C6D1] block">Score Awarded:</span>
                                <strong className="text-[#6E79F4] text-xs font-black">{sub.result.score} pts</strong>
                              </div>
                              <div>
                                <span className="text-[#C2C6D1] block">Passed Tests:</span>
                                <strong>{sub.result.passed_test_cases} / {sub.result.total_test_cases}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>

              <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer"
                >
                  Close Progress Drawer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
