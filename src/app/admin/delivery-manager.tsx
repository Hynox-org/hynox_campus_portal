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
import { listAllActivitiesAction, listQuizAttemptsAction, listProjectSubmissionsAction, listChallengeSubmissionsAction } from "@/app/actions/learning-actions";
import AttendancePanel from "@/components/attendance-panel";
import { 
  Building, 
  Users, 
  UserCheck, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  Check, 
  AlertCircle,
  FileText,
  TrendingUp,
  Award,
  Clock,
  ExternalLink,
  ChevronDown,
  X
} from "lucide-react";

interface DeliveryManagerProps {
  institutions: any[];
  initialTab: "cohorts" | "enrollments" | "assignments";
}

export default function DeliveryManager({ institutions, initialTab }: DeliveryManagerProps) {
  const [selectedInstId, setSelectedInstId] = useState(institutions[0]?.id || "");
  const [activeSubTab, setActiveSubTab] = useState<"cohorts" | "enrollments" | "assignments" | "attendance">(initialTab as any);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  // Lookup structures
  const [cohortStatuses, setCohortStatuses] = useState<any[]>([]);
  const [enrollmentStatuses, setEnrollmentStatuses] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // List views
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  // Loaded activity datasets
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
  const [projectSubmissions, setProjectSubmissions] = useState<any[]>([]);
  const [challengeSubmissions, setChallengeSubmissions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Fetch drawer details on student click
  useEffect(() => {
    if (selectedStudent) {
      const studentId = selectedStudent.user_id;

      getStudentDeliveryDataAction(studentId).then(res => {
        if (res.success && res.programs) {
          setActiveStudentProgress(res.programs);
        } else {
          setActiveStudentProgress([]);
        }
      });

      listStudentLessonProgressAction(studentId).then(res => {
        if (res.success && res.progressList) {
          setActiveStudentLessonsProgress(res.progressList);
        } else {
          setActiveStudentLessonsProgress([]);
        }
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

  // Fetch lookups and learning data on load
  useEffect(() => {
    async function loadLearningData() {
      const actRes = await listAllActivitiesAction(selectedInstId);
      if (actRes.activities) setActivities(actRes.activities);

      const qaRes = await listQuizAttemptsAction(selectedInstId);
      if (qaRes.attempts) setQuizAttempts(qaRes.attempts);

      const psRes = await listProjectSubmissionsAction(selectedInstId);
      if (psRes.submissions) setProjectSubmissions(psRes.submissions);

      const csRes = await listChallengeSubmissionsAction(selectedInstId);
      if (csRes.submissions) setChallengeSubmissions(csRes.submissions);
    }
    loadLearningData();
  }, [selectedInstId]);

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

  // Reload lists when selected institution changes
  useEffect(() => {
    if (selectedInstId) {
      loadInstitutionData();
    }
  }, [selectedInstId]);

  const loadInstitutionData = async () => {
    setLoading(true);
    setError("");
    setSelectedCohortFilter("");
    
    // Load programs for academic dropdowns
    const progRes = await listProgramsAction(selectedInstId);
    if (progRes.programs) {
      setPrograms(progRes.programs);
      
      // Load all courses for assignments
      const coursesPromises = progRes.programs.map((p: any) => listCoursesAction(p.id));
      const coursesResults = await Promise.all(coursesPromises);
      const combinedCourses = coursesResults.flatMap((r: any) => r.courses || []);
      setAllCourses(combinedCourses);
    }

    // Load students for enrollments
    const stuRes = await listInstitutionStudentsAction(selectedInstId);
    if (stuRes.students) {
      setStudents(stuRes.students);
    }

    // Load delivery records
    await refreshLists();
    
    setLoading(false);
  };

  const refreshLists = async () => {
    const cRes = await listCohortsAction(selectedInstId);
    if (cRes.cohorts) setCohorts(cRes.cohorts);

    const eRes = await listEnrollmentsAction(selectedInstId);
    if (eRes.enrollments) setEnrollments(eRes.enrollments);

    const aRes = await listCourseAssignmentsAction(selectedInstId);
    if (aRes.assignments) setAssignments(aRes.assignments);
  };

  const handleCohortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
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
          setError(res.error);
        } else {
          setSuccess("Cohort updated successfully!");
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
          setError(res.error);
        } else {
          setSuccess("Cohort created successfully!");
          setCohortModalOpen(false);
          await refreshLists();
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
    if (!confirm("Are you sure you want to soft delete this cohort?")) return;
    const res = await deleteCohortAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Cohort deleted successfully!");
      await refreshLists();
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (selectedStudentIds.length === 0) {
      setError("Please select at least one student to enroll.");
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
        setError(`Enrolled some students, but encountered errors: ${errors.map(e => e.error).join(", ")}`);
      } else {
        setSuccess(`Successfully enrolled ${selectedStudentIds.length} student(s) into the cohort!`);
        setEnrollModalOpen(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to enroll students.");
    } finally {
      setLoading(false);
      await refreshLists();
    }
  };

  const handleEnrollStatusChange = async (id: string, newStatus: string) => {
    const res = await updateEnrollmentStatusAction(id, newStatus);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Enrollment status updated!");
      await refreshLists();
    }
  };

  const handleRemoveEnrollment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this enrollment?")) return;
    const res = await removeEnrollmentAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Enrollment removed successfully!");
      await refreshLists();
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const isAlreadyAssigned = assignments.some(
        ass => ass.cohort_id === assignForm.cohort_id && ass.course_id === assignForm.course_id
      );
      if (isAlreadyAssigned) {
        setError("This course is already assigned to the selected cohort.");
        return;
      }

      const selectedCohort = cohorts.find(c => c.id === assignForm.cohort_id);
      if (selectedCohort) {
        const cohortStart = selectedCohort.start_date ? new Date(selectedCohort.start_date) : null;
        const cohortEnd = selectedCohort.end_date ? new Date(selectedCohort.end_date) : null;

        if (assignForm.start_date) {
          const assignStart = new Date(assignForm.start_date);
          if (cohortStart && assignStart < cohortStart) {
            setError(`Course assignment start date cannot be before cohort start date (${selectedCohort.start_date.split('T')[0]}).`);
            return;
          }
          if (cohortEnd && assignStart > cohortEnd) {
            setError(`Course assignment start date cannot be after cohort end date (${selectedCohort.end_date.split('T')[0]}).`);
            return;
          }
        }

        if (assignForm.due_date) {
          const assignDue = new Date(assignForm.due_date);
          if (cohortStart && assignDue < cohortStart) {
            setError(`Course assignment due/end date cannot be before cohort start date (${selectedCohort.start_date.split('T')[0]}).`);
            return;
          }
          if (cohortEnd && assignDue > cohortEnd) {
            setError(`Course assignment due/end date cannot be after cohort end date (${selectedCohort.end_date.split('T')[0]}).`);
            return;
          }
        }

        if (assignForm.start_date && assignForm.due_date) {
          const assignStart = new Date(assignForm.start_date);
          const assignDue = new Date(assignForm.due_date);
          if (assignStart > assignDue) {
            setError("Course assignment start date cannot be after due date.");
            return;
          }
        }
      }

      const res = await assignCourseAction({
        cohort_id: assignForm.cohort_id,
        course_id: assignForm.course_id,
        start_date: assignForm.start_date || undefined,
        due_date: assignForm.due_date || undefined,
        is_required: assignForm.is_required
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Course successfully assigned to cohort!");
        setAssignModalOpen(false);
        await refreshLists();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this course assignment?")) return;
    const res = await removeCourseAssignmentAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Course assignment removed!");
      await refreshLists();
    }
  };

  return (
    <div className="space-y-6 text-xs text-[#1d1d1f]">
      
      {/* Institution Scope selector */}
      <div className="bg-white border border-[#d2d2d7] p-6 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-[#86868b] flex items-center gap-1.5">
            <Building size={15} /> Delivery Scope Management
          </h3>
          <p className="text-[10px] text-[#86868b] leading-relaxed">
            Manage student batches, enroll students, and assign courses to cohorts.
          </p>
        </div>
        <select
          value={selectedInstId}
          onChange={(e) => setSelectedInstId(e.target.value)}
          className="bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold max-w-xs"
        >
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.institution_code})
            </option>
          ))}
        </select>
      </div>

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

      {/* Sub Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-[#d2d2d7] scrollbar-none">
        <button
          onClick={() => setActiveSubTab("cohorts")}
          className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "cohorts"
              ? "border-[#0066cc] text-[#0066cc]"
              : "border-transparent text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <Users size={14} />
          Cohorts ({cohorts.length})
        </button>
        <button
          onClick={() => setActiveSubTab("enrollments")}
          className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "enrollments"
              ? "border-[#0066cc] text-[#0066cc]"
              : "border-transparent text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <UserCheck size={14} />
          Enrollments ({enrollments.length})
        </button>
        <button
          onClick={() => setActiveSubTab("assignments")}
          className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "assignments"
              ? "border-[#0066cc] text-[#0066cc]"
              : "border-transparent text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <BookOpen size={14} />
          Course Assignments ({assignments.length})
        </button>
        <button
          onClick={() => setActiveSubTab("attendance")}
          className={`px-3 sm:px-5 py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "attendance"
              ? "border-[#0066cc] text-[#0066cc]"
              : "border-transparent text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <Calendar size={14} />
          Attendance Tracker
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-10 font-bold text-[#86868b] animate-pulse">
          Syncing delivery records...
        </div>
      )}

      {/* cohorts view */}
      {!loading && activeSubTab === "cohorts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider">Active Cohorts</h4>
            <button
              onClick={() => {
                setEditingCohort(null);
                setCohortForm({ name: "", code: "", start_date: "", end_date: "", status_code: "active", program_id: programs[0]?.id || "" });
                setCohortModalOpen(true);
              }}
              className="bg-[#0066cc] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all flex items-center gap-1"
            >
              <Plus size={13} /> Create Cohort
            </button>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                    <th className="px-6 py-3">Cohort Name</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Program</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Timeline</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d2d2d7]">
                  {cohorts.length > 0 ? (
                    cohorts.map((cohort) => (
                      <tr key={cohort.id} className="hover:bg-slate-50/30">
                        <td className="px-6 py-3.5 font-semibold text-[#1d1d1f]">{cohort.name}</td>
                        <td className="px-6 py-3.5 text-[#86868b] font-mono">{cohort.code}</td>
                        <td className="px-6 py-3.5 text-[#86868b]">{cohort.program?.title}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            cohort.status_code === "active" ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20" : "bg-slate-100 text-[#86868b] border-[#d2d2d7]"
                          }`}>
                            {cohort.status_code}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#86868b] font-mono">
                          {cohort.start_date ? cohort.start_date.substring(0, 10) : "N/A"} to {cohort.end_date ? cohort.end_date.substring(0, 10) : "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-right flex items-center justify-end gap-2.5">
                          <button onClick={() => handleEditCohortClick(cohort)} className="text-[#0066cc] hover:text-[#0066cc]/80" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteCohort(cohort.id)} className="text-[#DC2626] hover:text-[#DC2626]/80" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#86868b] font-semibold bg-slate-50/10">
                        No cohorts defined under this campus yet.
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
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50 p-4 border border-[#d2d2d7] rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <label className="font-bold text-xs text-[#86868b] uppercase tracking-wider whitespace-nowrap">Filter Cohort Batch:</label>
              <select
                value={selectedCohortFilter}
                onChange={(e) => setSelectedCohortFilter(e.target.value)}
                className="bg-white border border-[#d2d2d7] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold w-full sm:min-w-[200px] sm:w-auto"
              >
                <option value="">-- All Cohorts --</option>
                {cohorts.map(coh => (
                  <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
                ))}
              </select>
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
              className="bg-[#0066cc] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all flex items-center justify-center gap-1 shrink-0 w-full sm:w-auto text-xs"
            >
              <Plus size={13} /> Enroll Students
            </button>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Cohort</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Enrolled At</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d2d2d7]">
                  {(() => {
                    const filteredEnrollments = selectedCohortFilter
                      ? enrollments.filter(e => e.cohort_id === selectedCohortFilter)
                      : enrollments;
                    return filteredEnrollments.length > 0 ? (
                      filteredEnrollments.map((enr) => (
                      <tr key={enr.id} className="hover:bg-slate-50/30">
                        <td className="px-6 py-3.5 font-semibold text-[#1d1d1f]">{enr.student?.full_name || "N/A"}</td>
                        <td className="px-6 py-3.5 text-[#86868b]">{enr.student?.email || "N/A"}</td>
                        <td className="px-6 py-3.5 text-[#86868b]">{enr.cohort?.name} ({enr.cohort?.code})</td>
                        <td className="px-6 py-3.5">
                          <select
                            value={enr.status_code}
                            onChange={(e) => handleEnrollStatusChange(enr.id, e.target.value)}
                            className="bg-white border border-[#d2d2d7] rounded px-2 py-0.5 font-semibold text-[10px]"
                          >
                            {enrollmentStatuses.map(status => (
                              <option key={status.code} value={status.code}>{status.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-3.5 text-[#86868b] font-mono">
                          {enr.enrolled_at ? enr.enrolled_at.substring(0, 10) : "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button onClick={() => handleRemoveEnrollment(enr.id)} className="text-[#DC2626] hover:text-[#DC2626]/80" title="Remove enrollment">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#86868b] font-semibold bg-slate-50/10">
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
            <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider">Assigned Courses to Cohorts</h4>
            <button
              onClick={() => {
                setAssignForm({ cohort_id: cohorts[0]?.id || "", course_id: allCourses[0]?.id || "", start_date: "", due_date: "", is_required: true });
                setAssignModalOpen(true);
              }}
              className="bg-[#0066cc] text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all flex items-center gap-1"
            >
              <Plus size={13} /> Assign Course
            </button>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                    <th className="px-6 py-3">Course Name</th>
                    <th className="px-6 py-3">Cohort</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Required</th>
                    <th className="px-6 py-3">Timelines</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d2d2d7]">
                  {assignments.length > 0 ? (
                    assignments.map((ass) => (
                      <tr key={ass.id} className="hover:bg-slate-50/30">
                        <td className="px-6 py-3.5 font-semibold text-[#1d1d1f]">{ass.course?.title}</td>
                        <td className="px-6 py-3.5 text-[#86868b]">{ass.cohort?.name} ({ass.cohort?.code})</td>
                        <td className="px-6 py-3.5 text-[#86868b] font-medium">Academic Assigned</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            ass.is_required ? "bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20" : "bg-slate-100 text-[#86868b] border-[#d2d2d7]"
                          }`}>
                            {ass.is_required ? "Required" : "Optional"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#86868b] font-mono">
                          {ass.start_date ? ass.start_date.substring(0, 10) : "Immediate"} to {ass.due_date ? ass.due_date.substring(0, 10) : "Open"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button onClick={() => handleRemoveAssignment(ass.id)} className="text-[#DC2626] hover:text-[#DC2626]/80" title="Remove course assignment">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#86868b] font-semibold bg-slate-50/10">
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

      {/* attendance tracker view */}
      {!loading && activeSubTab === "attendance" && (
        <AttendancePanel
          cohorts={cohorts}
          students={students}
          enrollments={enrollments}
          userRole="super_admin"
        />
      )}
      {cohortModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setCohortModalOpen(false)}
            className="fixed inset-0 z-40 bg-[#1d1d1f]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#d2d2d7] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#1d1d1f]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#d2d2d7] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#1d1d1f] flex items-center gap-1.5">
                  <Users size={16} className="text-[#0066cc]" /> {editingCohort ? "Edit Cohort" : "Create New Cohort"}
                </h3>
                <p className="text-[10px] text-[#86868b] mt-0.5">Define student batch timelines and assign program pathways.</p>
              </div>
              <button
                onClick={() => setCohortModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleCohortSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {!editingCohort && (
                  <div className="space-y-1">
                    <label className="block font-bold text-[#86868b]">Select Academic Program *</label>
                    <select
                      value={cohortForm.program_id}
                      onChange={(e) => setCohortForm({ ...cohortForm, program_id: e.target.value })}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
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
                  <label className="block font-bold text-[#86868b]">Cohort Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. FSD-2026-A"
                    required
                    value={cohortForm.name}
                    onChange={(e) => setCohortForm({ ...cohortForm, name: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#86868b]">Business Identifier Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. FSD-2026-A"
                    required
                    value={cohortForm.code}
                    onChange={(e) => setCohortForm({ ...cohortForm, code: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#86868b]">Start Date</label>
                    <input
                      type="date"
                      value={cohortForm.start_date}
                      onChange={(e) => setCohortForm({ ...cohortForm, start_date: e.target.value })}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#86868b]">End Date</label>
                    <input
                      type="date"
                      value={cohortForm.end_date}
                      onChange={(e) => setCohortForm({ ...cohortForm, end_date: e.target.value })}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#86868b]">Cohort Status *</label>
                  <select
                    value={cohortForm.status_code || "active"}
                    onChange={(e) => setCohortForm({ ...cohortForm, status_code: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
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
              <div className="bg-slate-50 border-t border-[#d2d2d7] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setCohortModalOpen(false)}
                  className="border border-[#d2d2d7] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                 <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#0066cc] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50 transition-colors"
                >
                  {loading ? (editingCohort ? "Saving..." : "Creating...") : (editingCohort ? "Save Changes" : "Create Cohort")}
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
            className="fixed inset-0 z-40 bg-[#1d1d1f]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#d2d2d7] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#1d1d1f]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#d2d2d7] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#1d1d1f] flex items-center gap-1.5">
                  <Users size={16} className="text-[#0066cc]" /> Enroll Students
                </h3>
                <p className="text-[10px] text-[#86868b] mt-0.5">Select a cohort and enroll multiple students at once.</p>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleEnrollSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
                {/* Cohort Select */}
                <div className="space-y-1">
                  <label className="block font-bold text-[#86868b]">Select Cohort Batch *</label>
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
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                    required
                  >
                    <option value="">-- Choose Cohort Batch --</option>
                    {cohorts.map(coh => (
                      <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
                    ))}
                  </select>
                </div>

                {/* Enrollment Status */}
                <div className="space-y-1">
                  <label className="block font-bold text-[#86868b]">Enrollment Status *</label>
                  <select
                    value={enrollForm.status_code}
                    onChange={(e) => setEnrollForm({ ...enrollForm, status_code: e.target.value })}
                    className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
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
                          <label className="block font-bold text-[#86868b]">Search Student</label>
                          <input
                            type="text"
                            placeholder="🔍 Search student name or email..."
                            value={studentSearchQuery}
                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold text-[#1d1d1f]"
                          />
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1 shrink-0">
                          <label className="block font-bold text-[#86868b]">Student Directory</label>
                          <label className="flex items-center gap-1.5 text-xs text-[#0066cc] font-bold cursor-pointer select-none">
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
                              className="rounded text-[#0066cc] focus:ring-[#0066cc]"
                            />
                            <span>Select All ({eligibleStudents.length})</span>
                          </label>
                        </div>
                        
                        {/* Scrollable checklist container */}
                        <div className="border border-[#d2d2d7] rounded-lg flex-1 overflow-y-auto p-2 bg-slate-50/30 divide-y divide-slate-100">
                          {filteredStudents.length > 0 ? (
                            filteredStudents.map(stu => {
                              const isAlreadyEnrolled = enrollments.some(
                                e => e.cohort_id === enrollForm.cohort_id && e.user_id === stu.id
                              );
                              const isSelected = isAlreadyEnrolled || selectedStudentIds.includes(stu.id);
                              return (
                                <label
                                  key={stu.id}
                                  className="flex items-start gap-3 p-2 hover:bg-white transition-all text-xs cursor-pointer select-none"
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
                                    className={`mt-0.5 rounded text-[#0066cc] focus:ring-[#0066cc] ${
                                      isAlreadyEnrolled ? "opacity-50 cursor-not-allowed text-slate-400" : ""
                                    }`}
                                  />
                                  <div className="min-w-0">
                                    <span className={`font-semibold block ${isAlreadyEnrolled ? "text-slate-400" : "text-[#1d1d1f]"}`}>
                                      {stu.full_name} {isAlreadyEnrolled && <span className="text-[10px] text-[#86868b] font-normal italic">(Already Enrolled)</span>}
                                    </span>
                                    <span className="text-[#86868b] text-[10px] block truncate">{stu.email}</span>
                                  </div>
                                </label>
                              );
                            })
                          ) : (
                            <div className="text-center py-10 text-[#86868b] italic">
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
              <div className="bg-slate-50 border-t border-[#d2d2d7] p-5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="border border-[#d2d2d7] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#0066cc] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50 transition-colors"
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
            className="fixed inset-0 z-40 bg-[#1d1d1f]/30 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#d2d2d7] shadow-2xl flex flex-col animate-slideInRight text-xs text-[#1d1d1f]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-[#d2d2d7] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-[#1d1d1f] flex items-center gap-1.5">
                  <BookOpen size={16} className="text-[#0066cc]" /> Assign Course to Cohort
                </h3>
                <p className="text-[10px] text-[#86868b] mt-0.5">Publish syllabus courses and schedule cohort milestones.</p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form & Content */}
            <form onSubmit={handleAssignSubmit} className="flex-1 flex flex-col min-h-0">
              {(() => {
                const selectedCohortForAssign = cohorts.find(c => c.id === assignForm.cohort_id);
                const cohortLimits = (() => {
                  if (!selectedCohortForAssign) return { min: "", max: "" };
                  
                  const formatDate = (dStr: string) => {
                    if (!dStr) return "";
                    return dStr.split("T")[0];
                  };

                  const cohortStart = formatDate(selectedCohortForAssign.start_date);
                  const cohortEnd = formatDate(selectedCohortForAssign.end_date);
                  const todayStr = new Date().toISOString().split("T")[0];

                  let min = cohortStart;
                  // If cohort starts in the past (or is running now), set min to today
                  if (cohortStart && cohortStart < todayStr) {
                    min = todayStr;
                  } else if (!cohortStart) {
                    min = todayStr;
                  }

                  let max = cohortEnd;
                  return { min, max };
                })();

                return (
                  <>
                    <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                      <div className="space-y-1">
                        <label className="block font-bold text-[#86868b]">Select Cohort *</label>
                        <select
                          value={assignForm.cohort_id}
                          onChange={(e) => setAssignForm({ ...assignForm, cohort_id: e.target.value, start_date: "", due_date: "" })}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
                          required
                        >
                          <option value="">-- Choose Cohort Batch --</option>
                          {cohorts.map(coh => (
                            <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
                          ))}
                        </select>
                        {selectedCohortForAssign && (
                          <p className="text-[10px] text-[#86868b] font-medium mt-1">
                            Cohort functioning dates:{" "}
                            <span className="text-[#0066cc] font-semibold">
                              {selectedCohortForAssign.start_date ? selectedCohortForAssign.start_date.split("T")[0] : "No Start"}
                            </span>{" "}
                            to{" "}
                            <span className="text-[#0066cc] font-semibold">
                              {selectedCohortForAssign.end_date ? selectedCohortForAssign.end_date.split("T")[0] : "No End"}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-[#86868b]">Select Academic Course *</label>
                        <select
                          value={assignForm.course_id}
                          onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block font-bold text-[#86868b]">Start Date</label>
                          <input
                            type="date"
                            value={assignForm.start_date}
                            min={cohortLimits.min}
                            max={cohortLimits.max || undefined}
                            onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm animate-fadeIn"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#86868b]">Due Date</label>
                          <input
                            type="date"
                            value={assignForm.due_date}
                            min={assignForm.start_date || cohortLimits.min}
                            max={cohortLimits.max || undefined}
                            onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm animate-fadeIn"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="isRequired"
                          checked={assignForm.is_required}
                          onChange={(e) => setAssignForm({ ...assignForm, is_required: e.target.checked })}
                          className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]"
                        />
                        <label htmlFor="isRequired" className="font-semibold text-[#86868b] select-none cursor-pointer">Mandatory / Required Course</label>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="bg-slate-50 border-t border-[#d2d2d7] p-5 flex justify-end gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAssignModalOpen(false)}
                        className="border border-[#d2d2d7] hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                       <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#0066cc] text-white px-5 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50 transition-colors"
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
          <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex justify-end animate-fadeIn" onClick={() => setSelectedStudent(null)}>
            <div className="relative w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-start gap-4 bg-slate-50 shrink-0">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#0066cc] text-white flex items-center justify-center font-bold text-lg uppercase shadow-md border border-[#0066cc]/10">
                    {(selectedStudent.student?.full_name || selectedStudent.student?.email || "S").substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A]">{selectedStudent.student?.full_name || "Enrolled Student"}</h3>
                    <p className="text-xs text-[#475569]">{selectedStudent.student?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                        {selectedStudent.cohort?.name || "No cohort"}
                      </span>
                      <span className="text-[10px] text-[#475569]">• Enrolled on {new Date(selectedStudent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl transition-all border border-transparent hover:border-[#E2E8F0] cursor-pointer"
                >
                  <X size={18} className="text-[#475569]" />
                </button>
              </div>

              {/* Drawer Tab Navigation */}
              <div className="flex border-b border-[#E2E8F0] px-6 bg-white shrink-0">
                {(["overview", "syllabus", "quizzes", "projects", "challenges"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStudentDetailTab(tab)}
                    className={`py-3 px-4 text-xs font-bold border-b-2 transition-all capitalize cursor-pointer ${
                      studentDetailTab === tab 
                        ? "border-[#0066cc] text-[#0066cc] font-bold" 
                        : "border-transparent text-[#475569] hover:text-[#0F172A]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer Body Scroll */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. OVERVIEW TAB */}
                {studentDetailTab === "overview" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[#0066cc]/5 border border-[#0066cc]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#475569] uppercase block tracking-wider">Course Progress</span>
                        <div className="text-xl font-black text-[#0066cc] mt-1">{progressPercentage}%</div>
                        <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-[#0066cc] h-full" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-[#16A34A]/5 border border-[#16A34A]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#475569] uppercase block tracking-wider">Quizzes Completed</span>
                        <div className="text-xl font-black text-[#16A34A] mt-1">
                          {studentQuizAttempts.filter(q => q.attempted).length} / {quizzes.length}
                        </div>
                        <span className="text-[8px] text-[#475569] block mt-2">Avg Score: {
                          studentQuizAttempts.filter(q => q.attempted).length > 0 
                            ? Math.round(studentQuizAttempts.reduce((acc, curr) => acc + curr.score, 0) / studentQuizAttempts.filter(q => q.attempted).length) 
                            : 0
                        }%</span>
                      </div>

                      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#475569] uppercase block tracking-wider">Projects Validated</span>
                        <div className="text-xl font-black text-[#F59E0B] mt-1">
                          {studentProjSubs.filter(p => p.review?.review_status === "approved").length} / {projects.length}
                        </div>
                        <span className="text-[8px] text-[#475569] block mt-2">{studentProjSubs.length} total uploads</span>
                      </div>

                      <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#475569] uppercase block tracking-wider">Coding Runs</span>
                        <div className="text-xl font-black text-cyan-600 mt-1">
                          {studentChalSubs.filter(c => c.submission_status_code === "accepted").length} / {challenges.length}
                        </div>
                        <span className="text-[8px] text-[#475569] block mt-2">{studentChalSubs.length} total submits</span>
                      </div>
                    </div>

                    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 pb-3 border-b border-[#E2E8F0]">
                        <TrendingUp size={14} className="text-[#0066cc]" /> Core Curricular Activity Overview
                      </h4>
                      <div className="divide-y divide-[#E2E8F0] text-xs">
                        <div className="py-3 flex justify-between">
                          <span className="text-[#475569] font-medium">Platform Activity Status</span>
                          <span className="font-bold text-[#16A34A] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#16A34A] rounded-full animate-ping"></span> Active in Portal
                          </span>
                        </div>
                        <div className="py-3 flex justify-between">
                          <span className="text-[#475569] font-medium">Primary Program</span>
                          <span className="font-bold text-[#0F172A]">
                            {programs.find(p => p.id === selectedStudent.cohort?.program_id)?.title || "Standard Curriculum"}
                          </span>
                        </div>
                        <div className="py-3 flex justify-between">
                          <span className="text-[#475569] font-medium">Completed Syllabus Lessons</span>
                          <span className="font-bold text-[#0F172A]">
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
                      <div className="text-center py-10 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
                        No syllabus lessons found for this program.
                      </div>
                    ) : (
                      studentSyllabus.map(course => {
                        const isExpanded = expandedCourseId === course.id;
                        return (
                          <div key={course.id} className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
                            <div 
                              onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <h4 className="text-xs font-extrabold text-[#0F172A] hover:text-[#0066cc] transition-colors">{course.title}</h4>
                              </div>
                              <span className="text-[10px] font-bold text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded-full border border-[#0066cc]/20 shrink-0">Course</span>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#E2E8F0] space-y-2.5 bg-slate-50/30">
                                {course.lessons.map(lesson => (
                                  <div key={lesson.id} className="flex justify-between items-center text-xs p-2.5 bg-white border border-[#E2E8F0] rounded-xl hover:bg-slate-50 transition-all shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                      {lesson.status === "completed" ? (
                                        <div className="w-5 h-5 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center font-bold text-[10px] border border-[#16A34A]/20">✓</div>
                                      ) : lesson.status === "in_progress" ? (
                                        <div className="w-5 h-5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center font-bold text-[10px] border border-[#F59E0B]/20">⏳</div>
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px] border border-slate-200">•</div>
                                      )}
                                      <span className="font-semibold text-[#0F172A]">{lesson.title}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                      lesson.status === "completed" 
                                        ? "bg-[#16A34A]/10 text-[#16A34A]" 
                                        : lesson.status === "in_progress"
                                        ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                                        : "bg-slate-100 text-slate-500"
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
                      <div className="text-center py-10 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
                        No quizzes assigned for this program.
                      </div>
                    ) : (
                      studentQuizAttempts.map(attempt => {
                        const isExpanded = expandedQuizId === attempt.id;
                        return (
                          <div key={attempt.id} className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
                            <div 
                              onClick={() => setExpandedQuizId(isExpanded ? null : attempt.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-[#0F172A] hover:text-[#0066cc] transition-colors">{attempt.title}</h4>
                                  <p className="text-[9px] text-[#475569] mt-0.5">Attempted on {attempt.submittedAt}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                {attempt.attempted ? (
                                  <>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase ${
                                      attempt.passed 
                                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20" 
                                        : "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                                    }`}>
                                      {attempt.passed ? "Passed" : "Failed"}
                                    </span>
                                    <div className="text-xs font-black text-[#0F172A]">{attempt.score} / {attempt.maxScore} pts</div>
                                  </>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-400 border uppercase">
                                    Unattempted
                                  </span>
                                )}
                              </div>
                            </div>

                            {isExpanded && attempt.attempted && (
                              <div className="p-5 border-t border-[#E2E8F0] space-y-4 bg-slate-50/30">
                                <span className="text-[9px] font-bold text-[#475569] uppercase tracking-wide block">Auditing Answers:</span>
                                <div className="space-y-3">
                                  {attempt.questions.map((q: any, qIdx: number) => {
                                    const isCorrect = q.selectedIndex === q.correctIndex;
                                    return (
                                      <div key={qIdx} className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl text-xs space-y-2">
                                        <div className="font-semibold text-[#0F172A] flex justify-between gap-4">
                                          <span>Q{qIdx + 1}: {q.text}</span>
                                          <span className={`font-black shrink-0 ${isCorrect ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
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
                                                    ? "bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A] font-bold" 
                                                    : isSelected 
                                                    ? "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] font-semibold" 
                                                    : "bg-white border-[#E2E8F0] text-[#475569]"
                                                }`}
                                              >
                                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black shrink-0 ${
                                                  isAnsCorrect 
                                                    ? "bg-[#16A34A] border-transparent text-white" 
                                                    : isSelected 
                                                    ? "bg-[#DC2626] border-transparent text-white" 
                                                    : "border-slate-300"
                                                }`}>
                                                  {oIdx === 0 ? "A" : oIdx === 1 ? "B" : oIdx === 2 ? "C" : "D"}
                                                </div>
                                                <span>{opt.option_text || opt}</span>
                                                {isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#16A34A]/20 px-1.5 py-0.5 rounded text-[#16A34A]">Correct Option</span>}
                                                {isSelected && !isAnsCorrect && <span className="ml-auto text-[9px] font-bold uppercase bg-[#DC2626]/20 px-1.5 py-0.5 rounded text-[#DC2626]">Submitted Answer</span>}
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
                      <div className="text-center py-10 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
                        No project repository uploads submitted yet.
                      </div>
                    ) : (
                      studentProjSubs.map(sub => {
                        const isExpanded = expandedProjectId === sub.id;
                        return (
                          <div key={sub.id} className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden text-xs">
                            <div 
                              onClick={() => setExpandedProjectId(isExpanded ? null : sub.id)}
                              className="p-5 flex justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-[#0F172A] hover:text-[#0066cc] transition-colors">{sub.project_title}</h4>
                                  <p className="text-[9px] text-[#475569] mt-0.5">Submitted on {new Date(sub.submitted_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase shrink-0 ${
                                sub.review?.review_status === "approved"
                                  ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                                  : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                              }`}>
                                {sub.review?.review_status || "Pending Review"}
                              </span>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#E2E8F0] space-y-3 bg-slate-50/30">
                                <div>
                                  <span className="text-[9px] font-bold text-[#475569] uppercase tracking-wide block mb-1">GitHub Submission Link</span>
                                  <a href={sub.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0066cc] font-bold hover:underline flex items-center gap-1 w-fit">
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
                      <div className="text-center py-10 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#475569]">
                        No programming challenge submissions found.
                      </div>
                    ) : (
                      studentChalSubs.map(sub => (
                        <div key={sub.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col gap-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-[#0F172A]">{sub.challenge_title}</h5>
                              <p className="text-[9px] text-[#475569] mt-0.5">Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sub.submission_status_code === "accepted" ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-red-50 text-red-600"
                            }`}>
                              {sub.submission_status_code}
                            </span>
                          </div>
                          {sub.result && (
                            <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] border border-[#E2E8F0] mt-1">
                              <div>
                                <span className="text-[#475569] block">Score Awarded:</span>
                                <strong className="text-[#0066cc] text-xs font-black">{sub.result.score} pts</strong>
                              </div>
                              <div>
                                <span className="text-[#475569] block">Passed Tests:</span>
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

              <div className="p-4 border-t border-[#E2E8F0] bg-slate-50 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100 font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer"
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
