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

interface AdminStudentProgressProps {
  institutions: any[];
}

export default function AdminStudentProgress({ institutions }: AdminStudentProgressProps) {
  const [selectedInstId, setSelectedInstId] = useState(institutions[0]?.id || "");
  
  // Selection cascades
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Roster detail drawer states
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [activeStudentProgress, setActiveStudentProgress] = useState<any[]>([]);
  const [activeStudentLessonsProgress, setActiveStudentLessonsProgress] = useState<any[]>([]);
  const [drawerLessonsCache, setDrawerLessonsCache] = useState<Record<string, any[]>>({});
  const [studentDetailTab, setStudentDetailTab] = useState<"overview" | "syllabus" | "quizzes" | "projects" | "challenges">("overview");

  // Accordion inside drawer
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Learning activities cached
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
  const [projectSubmissions, setProjectSubmissions] = useState<any[]>([]);
  const [challengeSubmissions, setChallengeSubmissions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Load programs & reset selection when campus changes
  useEffect(() => {
    if (!selectedInstId) {
      setPrograms([]);
      setSelectedProgramId("");
      return;
    }
    setSelectedProgramId("");
    setSelectedCohortId("");
    listProgramsAction(selectedInstId).then(res => {
      if (res.programs) setPrograms(res.programs);
    });
  }, [selectedInstId]);

  // Load cohorts when program changes
  useEffect(() => {
    if (!selectedProgramId) {
      setCohorts([]);
      setSelectedCohortId("");
      return;
    }
    setSelectedCohortId("");
    listCohortsAction(selectedInstId).then(res => {
      if (res.cohorts) {
        // Filter cohorts matching selected program
        const matched = res.cohorts.filter((c: any) => c.program_id === selectedProgramId);
        setCohorts(matched);
      }
    });

    // Also load courses for that program
    listCoursesAction(selectedProgramId).then(res => {
      if (res.courses) setAllCourses(res.courses);
    });
  }, [selectedProgramId]);

  // Load enrollments when cohort is selected
  useEffect(() => {
    if (!selectedCohortId) {
      setEnrollments([]);
      return;
    }
    setLoading(true);
    listEnrollmentsAction(selectedInstId).then(res => {
      if (res.enrollments) {
        const matched = res.enrollments.filter((e: any) => e.cohort_id === selectedCohortId);
        setEnrollments(matched);
      }
      setLoading(false);
    });
  }, [selectedCohortId]);

  // Load selection drawer details
  useEffect(() => {
    if (selectedStudent) {
      const studentId = selectedStudent.user_id;

      getStudentDeliveryDataAction(studentId).then(res => {
        if (res.success && res.programs) setActiveStudentProgress(res.programs);
      });

      listStudentLessonProgressAction(studentId).then(res => {
        if (res.success && res.progressList) setActiveStudentLessonsProgress(res.progressList);
      });
    } else {
      setActiveStudentProgress([]);
      setActiveStudentLessonsProgress([]);
    }
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

  // Load learning logs cache on load
  useEffect(() => {
    if (selectedInstId) {
      listAllActivitiesAction(selectedInstId).then(res => {
        if (res.activities) setActivities(res.activities);
      });
      listQuizAttemptsAction(selectedInstId).then(res => {
        if (res.attempts) setQuizAttempts(res.attempts);
      });
      listProjectSubmissionsAction(selectedInstId).then(res => {
        if (res.submissions) setProjectSubmissions(res.submissions);
      });
      listChallengeSubmissionsAction(selectedInstId).then(res => {
        if (res.submissions) setChallengeSubmissions(res.submissions);
      });
    }
  }, [selectedInstId]);

  const filteredEnrollments = enrollments.filter(enr => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = enr.student?.full_name?.toLowerCase() || "";
    const email = enr.student?.email?.toLowerCase() || "";
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-6 text-xs text-[#1d1d1f]">
      
      {/* 1. Selector Header Panels */}
      <div className="bg-white border border-[#d2d2d7] p-6 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-1.5 border-b border-[#d2d2d7]/50 pb-2">
          <TrendingUp size={15} className="text-[#0066cc]" /> Audit Student Progress
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-[#86868b] mb-1">1. Campus Institution</label>
            <select
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold text-[#1d1d1f]"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name} ({inst.institution_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#86868b] mb-1">2. Academic Program</label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold text-[#1d1d1f]"
            >
              <option value="">-- Choose Program --</option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>{prog.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#86868b] mb-1">3. Cohort Batch</label>
            <select
              value={selectedCohortId}
              disabled={!selectedProgramId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm font-semibold text-[#1d1d1f]"
            >
              <option value="">-- Choose Cohort --</option>
              {cohorts.map((coh) => (
                <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Roster and Registry List */}
      {selectedCohortId ? (
        <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#d2d2d7]/50 pb-4">
            <div>
              <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider">Candidate Progress registry</h4>
              <p className="text-[10px] text-[#86868b]">Select a row to open live detailed syllabus attempt worksheets.</p>
            </div>

            <div className="max-w-xs w-full relative">
              <Search className="absolute left-2.5 top-2 text-[#86868b]" size={14} />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#d2d2d7] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm font-medium"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 font-bold text-[#86868b] animate-pulse">Syncing student worksheets...</div>
          ) : filteredEnrollments.length > 0 ? (
            <div className="border border-[#d2d2d7] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Email Address</th>
                      <th className="px-6 py-3">Course Completion</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Enrolled At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d2d2d7]">
                    {filteredEnrollments.map((enr) => {
                      const progVal = enr.progress_percentage || 0;
                      return (
                        <tr 
                          key={enr.id} 
                          onClick={() => {
                            setSelectedStudent(enr);
                            setStudentDetailTab("overview");
                          }}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3.5 font-semibold text-[#1d1d1f] hover:text-[#0066cc] transition-colors">{enr.student?.full_name || "N/A"}</td>
                          <td className="px-6 py-3.5 text-[#86868b]">{enr.student?.email || "N/A"}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2 w-32">
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-[#0066cc] h-full" style={{ width: `${progVal}%` }}></div>
                              </div>
                              <span className="font-bold shrink-0">{progVal}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              enr.status_code === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-500"
                            }`}>
                              {enr.status_code}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-[#86868b] font-mono">{enr.enrolled_at ? enr.enrolled_at.substring(0, 10) : "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-[#d2d2d7] rounded-xl text-slate-400 font-semibold bg-slate-50/10">
              No students enrolled in this cohort batch.
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-[#d2d2d7] rounded-xl text-slate-400 font-semibold bg-white shadow-sm">
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
