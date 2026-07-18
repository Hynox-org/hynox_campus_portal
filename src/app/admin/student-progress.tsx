"use client";

import React, { useState, useEffect } from "react";
import { 
  listProgramsAction,
  listCoursesAction,
  listLessonsForCourseAction
} from "@/app/actions/academic-actions";
import { 
  listCohortsAction,
  listEnrollmentsAction,
  getStudentDeliveryDataAction,
  listStudentLessonProgressAction
} from "@/app/actions/delivery-actions";
import { 
  listAllActivitiesAction,
  listQuizAttemptsAction,
  listProjectSubmissionsAction,
  listChallengeSubmissionsAction
} from "@/app/actions/learning-actions";
import { useQueryClient } from "@tanstack/react-query";
import { useDeliveryData, useLearningData } from "@/hooks/use-delivery";
import { usePrograms, useCourses } from "@/hooks/use-academics";
import { 
  Building, 
  GraduationCap, 
  Users, 
  Search, 
  TrendingUp, 
  ChevronDown, 
  X, 
  ExternalLink 
} from "lucide-react";
import { SecondaryLoader } from "@/components/secondary-loader";
import { CustomSelect } from "@/components/custom-select";

interface AdminStudentProgressProps {
  institutions: any[];
}

export default function AdminStudentProgress({ institutions }: AdminStudentProgressProps) {
  const [selectedInstId, setSelectedInstId] = useState(institutions[0]?.id || "");
  
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const queryClient = useQueryClient();

  // React Query prefetching hooks
  const { data: deliveryData, isLoading: loadingDelivery } = useDeliveryData(selectedInstId);
  const { data: learningData, isLoading: loadingLearning } = useLearningData(selectedInstId);
  const { data: acadPrograms, isLoading: loadingPrograms } = usePrograms(selectedInstId);
  const { data: acadCourses, isLoading: loadingCourses } = useCourses(selectedProgramId);

  const isDataLoading = loadingDelivery || loadingLearning || loadingPrograms || loadingCourses;

  // Derive list views instantly from cache
  const allCohorts = deliveryData?.cohorts || [];
  const allEnrollments = deliveryData?.enrollments || [];
  
  const activities = learningData?.activities || [];
  const quizAttempts = learningData?.quizAttempts || [];
  const projectSubmissions = learningData?.projectSubmissions || [];
  const challengeSubmissions = learningData?.challengeSubmissions || [];

  const programs = acadPrograms || [];
  const allCoursesList = acadCourses || [];

  const cohorts = selectedProgramId 
    ? allCohorts.filter((c: any) => c.program_id === selectedProgramId)
    : [];
    
  const enrollments = selectedCohortId
    ? allEnrollments.filter((e: any) => e.cohort_id === selectedCohortId)
    : [];

  const loading = false;

  // Selected Student Drawer States
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [activeStudentProgress, setActiveStudentProgress] = useState<any[]>([]);
  const [activeStudentLessonsProgress, setActiveStudentLessonsProgress] = useState<any[]>([]);
  const [drawerLessonsCache, setDrawerLessonsCache] = useState<Record<string, any[]>>({});
  const [studentDetailTab, setStudentDetailTab] = useState<"overview" | "syllabus" | "quizzes" | "projects" | "challenges">("overview");

  // Accordion inside drawer
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Reset cohort when program changes
  useEffect(() => {
    setSelectedCohortId("");
  }, [selectedProgramId]);

  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);

  const handleStudentClick = async (enr: any) => {
    if (loadingStudentId) return;
    setLoadingStudentId(enr.id);
    try {
      const studentId = enr.user_id;
      const [delRes, progressRes, syllabusEntries] = await Promise.all([
        getStudentDeliveryDataAction(studentId),
        listStudentLessonProgressAction(studentId),
        // Prefetch every course's lesson list so the syllabus tab is instant
        Promise.all(
          allCoursesList.map(async (c: any) => {
            if (drawerLessonsCache[c.id]) return [c.id, drawerLessonsCache[c.id]] as const;
            const res = await listLessonsForCourseAction(c.id);
            return [c.id, res.success && res.lessons ? res.lessons : []] as const;
          })
        ),
      ]);
      if (delRes.success && delRes.programs) {
        setActiveStudentProgress(delRes.programs);
      } else {
        setActiveStudentProgress([]);
      }
      if (progressRes.success && progressRes.progressList) {
        setActiveStudentLessonsProgress(progressRes.progressList);
      } else {
        setActiveStudentLessonsProgress([]);
      }
      setDrawerLessonsCache(prev => ({ ...prev, ...Object.fromEntries(syllabusEntries) }));
      setSelectedStudent(enr);
      setStudentDetailTab("overview");
    } catch (err) {
      console.error("Error preloading student data:", err);
    } finally {
      setLoadingStudentId(null);
    }
  };

  // Scroll lock when any sidebar drawer is open to prevent background viewport scrolling
  useEffect(() => {
    const isOpen = !!selectedStudent;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedStudent]);

  // Lazy load lessons in drawer
  useEffect(() => {
    if (expandedCourseId && !drawerLessonsCache[expandedCourseId]) {
      listLessonsForCourseAction(expandedCourseId).then(res => {
        if (res.success && res.lessons) {
          setDrawerLessonsCache(prev => ({ ...prev, [expandedCourseId]: res.lessons }));
        }
      });
    }
  }, [expandedCourseId, drawerLessonsCache]);

  const filteredEnrollments = enrollments.filter(enr => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = enr.student?.full_name?.toLowerCase() || "";
    const email = enr.student?.email?.toLowerCase() || "";
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-6 text-xs text-[#EDEFF5]">
      
      {/* 1. Selector Header Panels */}
      <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5 border-b border-[#23252C]/50 pb-2">
          <TrendingUp size={15} className="text-[#6E79F4]" /> Audit Student Progress
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-[#C2C6D1] mb-1">1. Campus Institution</label>
            <CustomSelect
              options={institutions}
              value={selectedInstId}
              onChange={(val) => {
                setSelectedInstId(val);
                setSelectedProgramId("");
                setSelectedCohortId("");
              }}
              placeholder="-- Select Campus --"
              className="font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-[#C2C6D1] mb-1">2. Academic Program</label>
            <CustomSelect
              options={programs.map(p => ({ ...p, name: p.title }))}
              value={selectedProgramId}
              onChange={(val) => {
                setSelectedProgramId(val);
                setSelectedCohortId("");
              }}
              placeholder="-- Choose Program --"
              className="font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-[#C2C6D1] mb-1">3. Cohort Batch</label>
            <CustomSelect
              disabled={!selectedProgramId}
              options={cohorts.map(c => ({ ...c, name: c.name }))}
              value={selectedCohortId}
              onChange={(val) => setSelectedCohortId(val)}
              placeholder="-- Choose Cohort --"
              className="font-semibold"
            />
          </div>
        </div>
      </div>

      {/* 2. Roster and Registry List */}
      {selectedCohortId ? (
        <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#23252C]/50 pb-4">
            <div>
              <h4 className="font-bold text-xs text-[#EDEFF5] uppercase tracking-wider">Candidate Progress registry</h4>
              <p className="text-[10px] text-[#C2C6D1]">Select a row to open live detailed syllabus attempt worksheets.</p>
            </div>

            <div className="max-w-xs w-full relative">
              <Search className="absolute left-2.5 top-2 text-[#C2C6D1]" size={14} />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#131418] border border-[#23252C] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#EDEFF5] focus:outline-none focus:border-[#6E79F4] shadow-sm font-medium"
              />
            </div>
          </div>

          {isDataLoading ? (
            <SecondaryLoader variant="skeleton" message="Syncing student worksheets..." className="!border-0 !p-0 shadow-none bg-transparent" />
          ) : filteredEnrollments.length > 0 ? (
            <div className="border border-[#23252C] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Email Address</th>
                      <th className="px-6 py-3">Course Completion</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Enrolled At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23252C]">
                    {filteredEnrollments.map((enr) => {
                      const progVal = enr.progress_percentage || 0;
                      return (
                        <tr 
                          key={enr.id} 
                          onClick={() => handleStudentClick(enr)}
                          className={`hover:bg-[#16171D]/50 cursor-pointer transition-colors ${loadingStudentId === enr.id ? "bg-[#16171D]/70 opacity-80" : ""}`}
                        >
                          <td className="px-6 py-3.5 font-semibold text-[#EDEFF5] hover:text-[#6E79F4] transition-colors">
                            <div className="flex items-center gap-2">
                              {enr.student?.full_name || "N/A"}
                              {loadingStudentId === enr.id && (
                                <span className="inline-block w-2.5 h-2.5 border-2 border-[#6E79F4] border-t-transparent rounded-full animate-spin"></span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-[#C2C6D1]">{enr.student?.email || "N/A"}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2 w-32">
                              <div className="flex-1 bg-[#1A1C22] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-[#6E79F4] h-full" style={{ width: `${progVal}%` }}></div>
                              </div>
                              <span className="font-bold shrink-0">{progVal}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              enr.status_code === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-[#1A1C22] text-[#C2C6D1]"
                            }`}>
                              {enr.status_code}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-[#C2C6D1] font-mono">{enr.enrolled_at ? enr.enrolled_at.substring(0, 10) : "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-[#23252C] rounded-xl text-[#A3A9B6] font-semibold bg-[#16171D]/10">
              No students enrolled in this cohort batch.
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-[#23252C] rounded-xl text-[#A3A9B6] font-semibold bg-[#131418] shadow-sm">
          Please select program and cohort selections from the panels above to inspect progress logs.
        </div>
      )}

      {/* Roster detail drawer slide-over */}
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
            submittedAt: attempt ? new Date(attempt.created_at || attempt.updated_at).toLocaleDateString() : ""
          };
        });

        const studentSyllabus = allCoursesList.map((course) => {
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
                        {selectedStudent.cohort?.name || "No cohort"}
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

                      <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-bold text-[#C2C6D1] uppercase block tracking-wider">Coding Runs</span>
                        <div className="text-xl font-black text-[#22D3EE] mt-1">
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
                      studentQuizAttempts.map(attempt => (
                        <div key={attempt.id} className="bg-[#131418] border border-[#23252C] rounded-2xl shadow-sm overflow-hidden text-xs">
                          <div className="p-5 flex justify-between items-center gap-4 hover:bg-[#16171D]/80 transition-colors select-none">
                            <div className="flex items-center gap-2.5">
                              <div>
                                <h4 className="text-xs font-bold text-[#EDEFF5]">{attempt.title}</h4>
                                {attempt.attempted && (
                                  <p className="text-[9px] text-[#C2C6D1] mt-0.5">Attempted on {attempt.submittedAt}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 font-bold">
                              {attempt.attempted ? (
                                attempt.passed ? (
                                  <span className="px-2.5 py-1 rounded bg-[#2FBF71]/10 text-[#2FBF71] border border-[#2FBF71]/20 font-bold text-[10px]">
                                    Passed with {attempt.score} marks
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded bg-[#F0555D]/10 text-[#F0555D] border border-[#F0555D]/20 font-bold text-[10px]">
                                    Failed with {attempt.score} marks
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[8px] uppercase bg-[#1A1C22] text-[#A3A9B6]">Not Attempted</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
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
