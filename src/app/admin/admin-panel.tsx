"use client";

import React, { useState } from "react";
import { 
  createNewInstitutionAction, 
  assignAdminAction, 
  uploadCsvOnboardingAction,
  regenerateInvitationAction,
  listInstitutionUsersAction,
  onboardSingleUserAction,
  listInvitationsAction,
  listAllTeachersAction,
  mapTeacherToInstitutionAction,
  unmapTeacherFromInstitutionAction,
  getTeacherInstitutionDetailsAction,
  updateInstitutionStatusAction,
  onboardSuperAdminAction
} from "@/app/actions/institution-actions";
import { 
  createProgramAction,
  updateProgramAction,
  deleteProgramAction,
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
  assignCourseInstructorsAction,
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  createLessonResourceAction,
  deleteLessonResourceAction,
  listLessonsAction,
  listLessonResourcesAction,
  listProgramsAction,
  listCoursesAction,
  listModulesAction,
  getCourseInstructorsAction,
  listTenantInstructorsAction,
  getAcademicLookupsAction
} from "@/app/actions/academic-actions";
import { signOutAction } from "@/app/actions/auth-actions";
import * as XLSX from "xlsx";
import { 
  Building, 
  UserPlus, 
  FileSpreadsheet, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon, 
  Globe, 
  Code,
  Copy,
  Search,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  HelpCircle,
  Ban,
  Download,
  Upload,
  GraduationCap,
  Folder,
  ArrowRight,
  Edit,
  Trash2,
  ExternalLink,
  File,
  Link2,
  Video,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Save,
  Users,
  BookOpen,
  UserCheck,
  Award,
  Menu,
  X,
  Play
} from "lucide-react";
import LibraryBuilder from "./library-builder";
import ProgramManager from "./program-manager";
import DeliveryManager from "./delivery-manager";
import LearningManager from "./learning-manager";
import AdminStudentProgress from "./student-progress";

interface AdminPanelProps {
  adminEmail: string;
  initialInstitutions: any[];
  initialInvitations?: any[];
}

export default function AdminPanel({ adminEmail, initialInstitutions, initialInvitations = [] }: AdminPanelProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const [activeParentTab, setActiveParentTab] = useState<"institutions" | "onboarding" | "library" | "programs" | "learning_manager">("institutions");
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<"institutions" | "add_institution" | "explorer" | "csv" | "onboarding" | "academics" | "library" | "programs" | "examine_programs" | "cohorts" | "enrollments" | "course_assignments" | "learning_manager" | "create_activity" | "view_activities" | "teacher_mapping" | "program_student_progress" | "super_admin_invite">("institutions");
  const [institutions, setInstitutions] = useState<any[]>(initialInstitutions);
  const [invitations, setInvitations] = useState<any[]>(initialInvitations);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteFilter, setInviteFilter] = useState<"all" | "pending" | "accepted" | "expired" | "failed" | "revoked">("all");
  const [inviteInstitutionFilter, setInviteInstitutionFilter] = useState("all");
  const [inviteRoleFilter, setInviteRoleFilter] = useState("all");
  const [inviteDateFilter, setInviteDateFilter] = useState("all");
  const [progSelectedInstId, setProgSelectedInstId] = useState("");
  const [progSelectedProgram, setProgSelectedProgram] = useState<any | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [openProgDropdownId, setOpenProgDropdownId] = useState<string | null>(null);

  // Institution Explorer states
  const [explorerSelectedId, setExplorerSelectedId] = useState("");
  const [explorerUsers, setExplorerUsers] = useState<any[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerRoleFilter, setExplorerRoleFilter] = useState<"all" | "admin" | "teacher" | "student">("all");

  // Teacher mapping states
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [mappingInstId, setMappingInstId] = useState("");
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<any | null>(null);
  const [teacherDetailsLoading, setTeacherDetailsLoading] = useState(false);
  const [teacherInstDetails, setTeacherInstDetails] = useState<any[]>([]);

  const handleSelectInstitutionForExplorer = async (instId: string) => {
    setExplorerSelectedId(instId);
    if (!instId) {
      setExplorerUsers([]);
      return;
    }
    setExplorerLoading(true);
    setError("");
    const res = await listInstitutionUsersAction(instId);
    if (res.error) {
      setError(res.error);
      setExplorerUsers([]);
    } else if (res.users) {
      setExplorerUsers(res.users);
    }
    setExplorerLoading(false);
  };

  const handleRegenerateInvite = async (invitationId: string) => {
    setRegeneratingId(invitationId);
    setError("");
    setSuccess("");
    
    const res = await regenerateInvitationAction(invitationId);
    if (res.error) {
      setError(res.error);
    } else if (res.invitation) {
      setSuccess(`Successfully regenerated invitation token!`);
      // Update local state list
      setInvitations((prev) =>
        prev.map((inv) => {
          if (inv.id === invitationId) {
            return {
              ...inv,
              token: res.invitation.token,
              expires_at: res.invitation.expires_at,
              status: res.invitation.status,
              accepted_at: null,
              user: inv.user ? { ...inv.user, status: "invited" } : undefined
            };
          }
          return inv;
        })
      );
    }
    setRegeneratingId(null);
  };

  const computedStats = React.useMemo(() => {
    let total = invitations.length;
    let accepted = 0;
    let pending = 0;
    let expired = 0;
    let failed = 0;
    let revoked = 0;

    const now = new Date();

    invitations.forEach((inv) => {
      const isExpired = inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now);
      if (inv.status === "accepted") {
        accepted++;
      } else if (isExpired) {
        expired++;
      } else if (inv.status === "failed") {
        failed++;
      } else if (inv.status === "revoked") {
        revoked++;
      } else {
        pending++;
      }
    });

    return { total, accepted, pending, expired, failed, revoked };
  }, [invitations]);

  const filteredInvitations = React.useMemo(() => {
    return invitations.filter((inv) => {
      // 1. Search filter
      const searchLower = inviteSearch.toLowerCase();
      const nameMatch = inv.user?.full_name?.toLowerCase().includes(searchLower);
      const emailMatch = inv.user?.email?.toLowerCase().includes(searchLower);
      const searchMatch = !inviteSearch || nameMatch || emailMatch;

      if (!searchMatch) return false;

      // 2. Status filter
      const now = new Date();
      const isExpired = inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now);

      if (inviteFilter !== "all") {
        if (inviteFilter === "accepted" && inv.status !== "accepted") return false;
        if (inviteFilter === "expired" && !isExpired) return false;
        if (inviteFilter === "failed" && inv.status !== "failed") return false;
        if (inviteFilter === "revoked" && inv.status !== "revoked") return false;
        if (inviteFilter === "pending" && (!["pending", "created", "sent"].includes(inv.status) || isExpired)) return false;
      }

      // 3. Institution filter
      if (inviteInstitutionFilter !== "all" && inv.tenant_id !== inviteInstitutionFilter) {
        return false;
      }

      // 4. Role filter
      if (inviteRoleFilter !== "all" && inv.invitation_type !== inviteRoleFilter) {
        return false;
      }

      // 5. Date filter
      if (inviteDateFilter !== "all") {
        const createdDate = new Date(inv.created_at);
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (inviteDateFilter === "today") {
          const isToday = createdDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (inviteDateFilter === "7days" && diffDays > 7) {
          return false;
        } else if (inviteDateFilter === "30days" && diffDays > 30) {
          return false;
        }
      }

      return true;
    });
  }, [invitations, inviteSearch, inviteFilter, inviteInstitutionFilter, inviteRoleFilter, inviteDateFilter]);

  const superAdminInvitations = React.useMemo(() => {
    return invitations.filter((inv) => inv.invitation_type === "super_admin_invite");
  }, [invitations]);

  const computedExplorerStats = React.useMemo(() => {
    let admins = 0;
    let teachers = 0;
    let students = 0;

    explorerUsers.forEach((u) => {
      const isTeacher = u.roles.includes("teacher") || u.roles.includes("trainer");
      const isAdmin = u.roles.includes("institution_admin") || u.roles.includes("super_admin");
      const isStudent = u.roles.includes("student");

      if (isAdmin) admins++;
      if (isTeacher) teachers++;
      if (isStudent) students++;
    });

    return { total: explorerUsers.length, admins, teachers, students };
  }, [explorerUsers]);

  const filteredExplorerUsers = React.useMemo(() => {
    return explorerUsers.filter((u) => {
      const searchLower = explorerSearch.toLowerCase();
      const nameMatch = u.full_name?.toLowerCase().includes(searchLower);
      const emailMatch = u.email?.toLowerCase().includes(searchLower);
      const searchMatch = !explorerSearch || nameMatch || emailMatch;

      if (!searchMatch) return false;

      if (explorerRoleFilter === "all") return true;
      if (explorerRoleFilter === "admin") {
        return u.roles.includes("institution_admin") || u.roles.includes("super_admin");
      }
      if (explorerRoleFilter === "teacher") {
        return u.roles.includes("teacher") || u.roles.includes("trainer");
      }
      if (explorerRoleFilter === "student") {
        return u.roles.includes("student");
      }

      return true;
    });
  }, [explorerUsers, explorerSearch, explorerRoleFilter]);


  
  // Status states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [links, setLinks] = useState<any[]>([]);

  // Form states
  const [instName, setInstName] = useState("");
  const [instSlug, setInstSlug] = useState("");
  const [instCode, setInstCode] = useState("");
  const [instType, setInstType] = useState("college");
  const [instEmail, setInstEmail] = useState("");
  const [instPhone, setInstPhone] = useState("");
  const [instAddress, setInstAddress] = useState("");
  const [instWebsite, setInstWebsite] = useState("");

  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [selectedInstId, setSelectedInstId] = useState(institutions[0]?.id || "");

  const [csvContent, setCsvContent] = useState("");
  
  // Single-user onboarding form states
  const [onboardMode, setOnboardMode] = useState<"single" | "csv">("single");
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [singleRole, setSingleRole] = useState("student");
  const [uploadedFileName, setUploadedFileName] = useState("");
  
  // Super-admin onboarding form states
  const [superAdminName, setSuperAdminName] = useState("");
  const [superAdminEmail, setSuperAdminEmail] = useState("");

  // Academic Builder states
  const [acadSelectedInstId, setAcadSelectedInstId] = useState("");
  const [acadPrograms, setAcadPrograms] = useState<any[]>([]);
  const [acadSelectedProgram, setAcadSelectedProgram] = useState<any | null>(null);
  const [acadCourses, setAcadCourses] = useState<any[]>([]);
  const [acadSelectedCourse, setAcadSelectedCourse] = useState<any | null>(null);
  const [acadModules, setAcadModules] = useState<any[]>([]);
  const [acadInstructors, setAcadInstructors] = useState<any[]>([]);
  const [acadTenantTeachers, setAcadTenantTeachers] = useState<any[]>([]);
  
  // Lookup states
  const [acadLookups, setAcadLookups] = useState<any>({
    courseTypes: [],
    lessonTypes: [],
    statuses: [],
    visibilityTypes: []
  });

  // Modal / Form Open States
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any | null>(null);
  const [programForm, setProgramForm] = useState({ title: "", slug: "", description: "", status_id: "", visibility_type_id: "" });

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "",
    slug: "",
    description: "",
    course_type_id: "",
    status_id: "",
    visibility_type_id: "",
    enrollment_mode: "open" as any,
    duration_minutes: 0,
    thumbnail_path: ""
  });

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", position: 1, status_id: "" });

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [lessonSelectedModuleId, setLessonSelectedModuleId] = useState("");
  const [lessonForm, setLessonForm] = useState({
    title: "",
    lesson_type_id: "",
    content_text: "",
    video_url: "",
    duration: 0,
    position: 1,
    is_preview: false,
    status_id: ""
  });

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceSelectedLessonId, setResourceSelectedLessonId] = useState("");
  const [resourceForm, setResourceForm] = useState({
    title: "",
    resource_type: "link",
    file_url: "",
    external_url: "",
    position: 1
  });

  const loadAllTeachersData = async () => {
    setLoadingTeachers(true);
    const res = await listAllTeachersAction();
    if (res.teachers) {
      setTeachersList(res.teachers);
    } else if (res.error) {
      alert(res.error);
    }
    setLoadingTeachers(false);
  };

  const handleMapTeacher = async (userId: string, tenantId: string) => {
    if (!tenantId) {
      alert("Please select a target institution.");
      return;
    }
    setLoadingTeachers(true);
    const res = await mapTeacherToInstitutionAction(userId, tenantId);
    if (res.success) {
      alert("Teacher mapped successfully!");
      // Fetch fresh teachers list first, then update selected teacher and details
      const updatedTeacherRes = await listAllTeachersAction();
      if (updatedTeacherRes.teachers) {
        setTeachersList(updatedTeacherRes.teachers);
        const latestTeacher = updatedTeacherRes.teachers.find((t: any) => t.id === userId);
        if (latestTeacher) {
          setSelectedTeacherForDetail(latestTeacher);
          // Load detail rows
          setTeacherDetailsLoading(true);
          setTeacherInstDetails([]);
          const detailsRes = await getTeacherInstitutionDetailsAction(userId);
          if (detailsRes.details) {
            setTeacherInstDetails(detailsRes.details);
          }
          setTeacherDetailsLoading(false);
        }
      } else {
        loadAllTeachersData();
      }
    } else {
      alert(res.error || "Failed to map teacher.");
    }
    setLoadingTeachers(false);
  };

  const handleUnmapTeacher = async (userId: string, tenantId: string) => {
    if (!confirm("Are you sure you want to remove this institution mapping?")) {
      return;
    }
    setLoadingTeachers(true);
    const res = await unmapTeacherFromInstitutionAction(userId, tenantId);
    if (res.success) {
      alert("Teacher unmapped successfully!");
      // Fetch fresh teachers list first, then update selected teacher and details
      const updatedTeacherRes = await listAllTeachersAction();
      if (updatedTeacherRes.teachers) {
        setTeachersList(updatedTeacherRes.teachers);
        const latestTeacher = updatedTeacherRes.teachers.find((t: any) => t.id === userId);
        if (latestTeacher) {
          setSelectedTeacherForDetail(latestTeacher);
          setTeacherDetailsLoading(true);
          setTeacherInstDetails([]);
          const detailsRes = await getTeacherInstitutionDetailsAction(userId);
          if (detailsRes.details) {
            setTeacherInstDetails(detailsRes.details);
          }
          setTeacherDetailsLoading(false);
        } else {
          setSelectedTeacherForDetail(null);
        }
      } else {
        loadAllTeachersData();
      }
    } else {
      alert(res.error || "Failed to unmap teacher.");
    }
    setLoadingTeachers(false);
  };

  const loadTeacherDetailsData = async (teacher: any) => {
    setSelectedTeacherForDetail(teacher);
    setMappingInstId(""); // Reset mapping selection when loading a teacher
    setTeacherDetailsLoading(true);
    setTeacherInstDetails([]);
    const res = await getTeacherInstitutionDetailsAction(teacher.id);
    if (res.details) {
      setTeacherInstDetails(res.details);
    } else if (res.error) {
      alert(res.error);
    }
    setTeacherDetailsLoading(false);
  };

  React.useEffect(() => {
    if (activeTab === "teacher_mapping") {
      loadAllTeachersData();
    }
  }, [activeTab]);

  React.useEffect(() => {
    async function loadLookups() {
      const res = await getAcademicLookupsAction();
      if (res.success && res.lookups) {
        setAcadLookups(res.lookups);
        
        const activeStatus = res.lookups.statuses.find((s: any) => s.code === "active")?.id || "";
        const publicVisibility = res.lookups.visibilityTypes.find((v: any) => v.code === "public")?.id || "";
        
        setProgramForm(f => ({ ...f, status_id: activeStatus, visibility_type_id: publicVisibility }));
        setCourseForm(f => ({ ...f, status_id: activeStatus, visibility_type_id: publicVisibility }));
        setModuleForm(f => ({ ...f, status_id: activeStatus }));
        setLessonForm(f => ({ ...f, status_id: activeStatus }));
      }
    }
    loadLookups();
  }, []);

  React.useEffect(() => {
    if (!acadSelectedInstId) {
      setAcadPrograms([]);
      setAcadSelectedProgram(null);
      setAcadCourses([]);
      setAcadSelectedCourse(null);
      setAcadModules([]);
      setAcadTenantTeachers([]);
      return;
    }

    async function loadProgramsAndTeachers() {
      setLoading(true);
      setError("");
      
      const pRes = await listProgramsAction(acadSelectedInstId);
      if (pRes.error) {
        setError(pRes.error);
      } else if (pRes.programs) {
        setAcadPrograms(pRes.programs);
      }

      const tRes = await listTenantInstructorsAction(acadSelectedInstId);
      if (tRes.error) {
        setError(tRes.error);
      } else if (tRes.instructors) {
        setAcadTenantTeachers(tRes.instructors);
      }
      
      setLoading(false);
    }
    loadProgramsAndTeachers();
  }, [acadSelectedInstId]);

  React.useEffect(() => {
    if (!acadSelectedProgram) {
      setAcadCourses([]);
      setAcadSelectedCourse(null);
      setAcadModules([]);
      return;
    }

    async function loadCourses() {
      setLoading(true);
      setError("");
      const res = await listCoursesAction(acadSelectedProgram.id);
      if (res.error) {
        setError(res.error);
      } else if (res.courses) {
        setAcadCourses(res.courses);
      }
      setLoading(false);
    }
    loadCourses();
  }, [acadSelectedProgram]);

  React.useEffect(() => {
    if (!acadSelectedCourse) {
      setAcadModules([]);
      setAcadInstructors([]);
      return;
    }

    async function loadCourseDetails() {
      setLoading(true);
      setError("");
      
      const mRes = await listModulesAction(acadSelectedCourse.id);
      if (mRes.error) {
        setError(mRes.error);
      } else if (mRes.modules) {
        const modulesWithLessons = await Promise.all(
          mRes.modules.map(async (m: any) => {
            const lRes = await listLessonsAction(m.id);
            const lessons = lRes.lessons || [];
            const lessonsWithResources = await Promise.all(
              lessons.map(async (l: any) => {
                const rRes = await listLessonResourcesAction(l.id);
                return { ...l, resources: rRes.resources || [] };
              })
            );
            return { ...m, lessons: lessonsWithResources };
          })
        );
        setAcadModules(modulesWithLessons);
      }

      const iRes = await getCourseInstructorsAction(acadSelectedCourse.id);
      if (iRes.error) {
        setError(iRes.error);
      } else if (iRes.instructors) {
        setAcadInstructors(iRes.instructors);
      }

      setLoading(false);
    }
    loadCourseDetails();
  }, [acadSelectedCourse]);

  const refreshCourseDetails = async (courseId: string) => {
    const mRes = await listModulesAction(courseId);
    if (mRes.modules) {
      const modulesWithLessons = await Promise.all(
        mRes.modules.map(async (m: any) => {
          const lRes = await listLessonsAction(m.id);
          const lessons = lRes.lessons || [];
          const lessonsWithResources = await Promise.all(
            lessons.map(async (l: any) => {
              const rRes = await listLessonResourcesAction(l.id);
              return { ...l, resources: rRes.resources || [] };
            })
          );
          return { ...m, lessons: lessonsWithResources };
        })
      );
      setAcadModules(modulesWithLessons);
    }
  };

  const refreshPrograms = async () => {
    if (!acadSelectedInstId) return;
    const res = await listProgramsAction(acadSelectedInstId);
    if (res.programs) {
      setAcadPrograms(res.programs);
      if (acadSelectedProgram) {
        const updated = res.programs.find((p: any) => p.id === acadSelectedProgram.id);
        if (updated) setAcadSelectedProgram(updated);
      }
    }
  };

  const refreshCourses = async () => {
    if (!acadSelectedProgram) return;
    const res = await listCoursesAction(acadSelectedProgram.id);
    if (res.courses) {
      setAcadCourses(res.courses);
      if (acadSelectedCourse) {
        const updated = res.courses.find((c: any) => c.id === acadSelectedCourse.id);
        if (updated) setAcadSelectedCourse(updated);
      }
    }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    let res;
    if (editingProgram) {
      res = await updateProgramAction(editingProgram.id, programForm);
    } else {
      res = await createProgramAction({
        ...programForm,
        tenant_id: acadSelectedInstId,
        institution_id: acadSelectedInstId
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Program saved successfully!`);
      setProgramModalOpen(false);
      setEditingProgram(null);
      await refreshPrograms();
    }
    setLoading(false);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    let res;
    if (editingCourse) {
      res = await updateCourseAction(editingCourse.id, courseForm);
    } else {
      res = await createCourseAction({
        ...courseForm,
        program_id: acadSelectedProgram.id,
        tenant_id: acadSelectedInstId,
        institution_id: acadSelectedInstId
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Course saved successfully!`);
      setCourseModalOpen(false);
      setEditingCourse(null);
      await refreshCourses();
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
      res = await updateModuleAction(editingModule.id, moduleForm);
    } else {
      res = await createModuleAction({
        ...moduleForm,
        course_id: acadSelectedCourse.id,
        tenant_id: acadSelectedInstId,
        institution_id: acadSelectedInstId
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Module saved successfully!`);
      setModuleModalOpen(false);
      setEditingModule(null);
      await refreshCourseDetails(acadSelectedCourse.id);
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
      res = await updateLessonAction(editingLesson.id, {
        title: lessonForm.title,
        lesson_type_id: lessonForm.lesson_type_id,
        content_json,
        video_url: lessonForm.video_url || undefined,
        duration: lessonForm.duration,
        position: lessonForm.position,
        is_preview: lessonForm.is_preview,
        status_id: lessonForm.status_id
      });
    } else {
      res = await createLessonAction({
        module_id: lessonSelectedModuleId,
        title: lessonForm.title,
        lesson_type_id: lessonForm.lesson_type_id,
        content_json,
        video_url: lessonForm.video_url || undefined,
        duration: lessonForm.duration,
        position: lessonForm.position,
        is_preview: lessonForm.is_preview,
        status_id: lessonForm.status_id,
        tenant_id: acadSelectedInstId,
        institution_id: acadSelectedInstId
      });
    }

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Lesson saved successfully!`);
      setLessonModalOpen(false);
      setEditingLesson(null);
      await refreshCourseDetails(acadSelectedCourse.id);
    }
    setLoading(false);
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await createLessonResourceAction({
      lesson_id: resourceSelectedLessonId,
      title: resourceForm.title,
      resource_type: resourceForm.resource_type,
      file_url: resourceForm.file_url || undefined,
      external_url: resourceForm.external_url || undefined,
      position: resourceForm.position,
      tenant_id: acadSelectedInstId,
      institution_id: acadSelectedInstId
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Resource added successfully!`);
      setResourceModalOpen(false);
      await refreshCourseDetails(acadSelectedCourse.id);
    }
    setLoading(false);
  };

  const handleSaveInstructors = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const instructorIds = acadInstructors.map(i => i.user_id);
    const res = await assignCourseInstructorsAction(acadSelectedCourse.id, instructorIds);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Instructors assigned successfully!`);
    }
    setLoading(false);
  };

  const clearStatuses = () => {
    setError("");
    setSuccess("");
    setLinks([]);
    setUploadedFileName("");
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    const formData = new FormData();
    formData.append("name", instName);
    formData.append("slug", instSlug);
    formData.append("code", instCode);
    formData.append("type", instType);
    formData.append("email", instEmail);
    formData.append("phone", instPhone);
    formData.append("address", instAddress);
    formData.append("website", instWebsite);

    const res = await createNewInstitutionAction(formData);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Institution '${instName}' successfully registered!`);
      // Update local state list
      setInstitutions([res.institution, ...institutions]);
      if (!selectedInstId) {
        setSelectedInstId(res.institution.id);
      }
      // Reset form
      setInstName("");
      setInstSlug("");
      setInstCode("");
      setInstEmail("");
      setInstPhone("");
      setInstAddress("");
      setInstWebsite("");
    }
    setLoading(false);
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!selectedInstId) {
      setError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    const res = await assignAdminAction(selectedInstId, adminEmailInput);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`User '${adminEmailInput}' successfully assigned as administrator.`);
      setAdminEmailInput("");
    }
    setLoading(false);
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!selectedInstId) {
      setError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    if (!csvContent.trim()) {
      setError("Please paste CSV contents.");
      setLoading(false);
      return;
    }

    const res = await uploadCsvOnboardingAction(selectedInstId, csvContent);
    if (res.error) {
      setError(res.error);
    } else if (res.results) {
      setLinks(res.results);
      const errors = res.results.filter((r: any) => r.status === "error");
      const successes = res.results.filter((r: any) => r.status === "success");
      
      setSuccess(`Processed CSV: ${successes.length} provisioned successfully, ${errors.length} errors.`);
      
      const freshInvites = await listInvitationsAction();
      if (freshInvites.invitations) {
        setInvitations(freshInvites.invitations);
      }
    }
    setLoading(false);
  };

  const handleSingleUserOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!selectedInstId) {
      setError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    if (!singleName.trim() || !singleEmail.trim()) {
      setError("Full Name and Email are required.");
      setLoading(false);
      return;
    }

    const res = await onboardSingleUserAction({
      email: singleEmail,
      name: singleName,
      role: singleRole,
      institutionId: selectedInstId,
    });

    if (res.error) {
      setError(res.error);
    } else if (res.result) {
      setLinks([res.result]);
      if (res.result.status === "success") {
        setSuccess(`Successfully invited '${singleEmail}'!`);
        setSingleName("");
        setSingleEmail("");
        
        const freshInvites = await listInvitationsAction();
        if (freshInvites.invitations) {
          setInvitations(freshInvites.invitations);
        }
      } else {
        setError(res.result.error || "Failed to onboard user.");
      }
    }
    setLoading(false);
  };

  const handleSuperAdminOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!superAdminName.trim() || !superAdminEmail.trim()) {
      setError("Full Name and Email are required.");
      setLoading(false);
      return;
    }

    const res = await onboardSuperAdminAction({
      email: superAdminEmail,
      name: superAdminName,
    });

    if (res.error) {
      setError(res.error);
    } else if (res.result) {
      setLinks([res.result]);
      if (res.result.status === "success") {
        setSuccess(`Successfully invited Super Admin '${superAdminEmail}'!`);
        setSuperAdminName("");
        setSuperAdminEmail("");
        
        const freshInvites = await listInvitationsAction();
        if (freshInvites.invitations) {
          setInvitations(freshInvites.invitations);
        }
      } else {
        setError(res.result.error || "Failed to generate invitation.");
      }
    }
    setLoading(false);
  };

  const downloadTemplateExcel = () => {
    if (!selectedInstId) {
      setError("Please select a default institution first.");
      return;
    }
    const inst = institutions.find((i) => i.id === selectedInstId);
    const slug = inst ? inst.slug : "campus";

    // Build template data
    const templateData = [
      {
        "Full Name": "Jane Doe",
        "Email": "jane.doe@school.edu",
        "Institution ID (Do Not Modify)": selectedInstId
      },
      {
        "Full Name": "John Smith",
        "Email": "john.smith@school.edu",
        "Institution ID (Do Not Modify)": selectedInstId
      }
    ];

    try {
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      // Auto-fit column widths
      const colWidths = [
        { wch: 25 }, // Full Name
        { wch: 35 }, // Email
        { wch: 40 }  // Institution ID
      ];
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Onboarding Template");
      XLSX.writeFile(workbook, `hynox_student_onboarding_${slug}.xlsx`);
      setSuccess("Excel template generated successfully!");
    } catch (err: any) {
      setError(`Failed to generate Excel template: ${err.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setError("");
    setSuccess("");

    const reader = new FileReader();

    if (file.name.endsWith(".csv")) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
        setSuccess(`Loaded CSV file: ${file.name}`);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
          if (jsonData.length === 0) {
            throw new Error("The uploaded sheet has no rows.");
          }
          
          // Map headers: name, email, role, institution_id
          const rawHeaders = (jsonData[0] as any[]).map(h => String(h || "").trim());
          const headers = rawHeaders.map(h => {
            const lower = h.toLowerCase();
            if (lower.includes("name")) return "name";
            if (lower.includes("email")) return "email";
            if (lower.includes("role")) return "role";
            if (lower.includes("institution")) return "institution_id";
            return lower;
          });

          const csvRows = [headers.join(",")];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0 || row.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
            
            while (row.length < headers.length) {
              row.push("");
            }
            csvRows.push(row.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
          }
          
          setCsvContent(csvRows.join("\n"));
          setSuccess(`Successfully parsed and loaded Excel file: ${file.name}`);
        } catch (err: any) {
          setError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Onboarding link copied to clipboard!");
  };

  const renderUserDetailDrawer = () => {
    if (!selectedUserDetail) return null;

    return (
      <div className="fixed inset-0 bg-[#1d1d1f]/30 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedUserDetail(null)} />
        <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden border-l border-[#d2d2d7]">
          <div className="p-6 border-b border-[#d2d2d7] flex justify-between items-start gap-4 bg-slate-50">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc] text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-[#0066cc]/10">
                {(selectedUserDetail.full_name || selectedUserDetail.email || "U").substring(0, 2)}
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1d1d1f]">{selectedUserDetail.full_name || "User Details"}</h3>
                <p className="text-[10px] text-[#86868b] font-medium mt-0.5">{selectedUserDetail.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                    {selectedUserDetail.roles?.join(", ") || "No roles"}
                  </span>
                  <span className="text-[9px] text-[#86868b] font-medium">• Joined {new Date(selectedUserDetail.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedUserDetail(null)}
              className="p-1 hover:bg-slate-200 rounded-lg transition-all border border-transparent hover:border-[#d2d2d7] cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
            <div className="bg-white border border-[#d2d2d7] rounded-xl p-4 space-y-3 shadow-sm">
              <h4 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-[#d2d2d7]">
                Campus Profile Metadata
              </h4>
              <div className="divide-y divide-[#d2d2d7]/50 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#86868b] font-medium">Full Name</span>
                  <span className="font-semibold text-[#1d1d1f]">{selectedUserDetail.full_name || "N/A"}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#86868b] font-medium">Email Address</span>
                  <span className="font-semibold text-[#1d1d1f]">{selectedUserDetail.email}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#86868b] font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    selectedUserDetail.status === "active"
                      ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                      : selectedUserDetail.status === "invited" || selectedUserDetail.status === "pending_activation"
                      ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                      : "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                  }`}>
                    {selectedUserDetail.status}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#86868b] font-medium">Profile ID</span>
                  <span className="font-mono text-[10px] text-[#86868b] select-all">{selectedUserDetail.id}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#86868b] font-medium">Created On</span>
                  <span className="font-semibold text-[#1d1d1f]">{new Date(selectedUserDetail.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTeacherDetailDrawer = () => {
    if (!selectedTeacherForDetail) return null;

    return (
      <div className="fixed inset-0 bg-[#1d1d1f]/30 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedTeacherForDetail(null)} />
        <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden border-l border-[#d2d2d7]">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#d2d2d7] flex justify-between items-start gap-4 bg-slate-50 shrink-0">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc] text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-[#0066cc]/10">
                {(selectedTeacherForDetail.full_name || selectedTeacherForDetail.email || "T").substring(0, 2)}
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1d1d1f]">{selectedTeacherForDetail.full_name || "Teacher Profile"}</h3>
                <p className="text-[10px] text-[#86868b] font-medium mt-0.5">{selectedTeacherForDetail.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 uppercase">
                    Teacher / Trainer
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedTeacherForDetail(null)}
              className="p-1 hover:bg-slate-200 rounded-lg transition-all border border-transparent hover:border-[#d2d2d7] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-[#F5F5F7] border border-[#E8E8ED] p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#86868b] font-medium">Teacher ID:</span>
                <span className="font-mono text-[#1d1d1f] select-all">{selectedTeacherForDetail.id}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-[#d2d2d7]">
                Assigned Campuses & Handled Programs
              </h4>

              {teacherDetailsLoading ? (
                <div className="text-center py-12 text-xs text-[#86868b] font-medium flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-[#0066cc]" /> Loading campus program status...
                </div>
              ) : teacherInstDetails.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#86868b] border border-dashed border-[#d2d2d7] rounded-xl">
                  No active campus or program mappings found.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    teacherInstDetails.reduce((groups: any, item: any) => {
                      const key = item.institution_name;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(item);
                      return groups;
                    }, {})
                  ).map(([instName, items]: [string, any]) => {
                    const isPrimary = items[0]?.is_primary;
                    const instId = items[0]?.institution_id;

                    return (
                      <div key={instName} className="border border-[#E8E8ED] rounded-xl p-4 bg-white shadow-sm space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-dashed border-[#E8E8ED]">
                          <h5 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                            {instName}
                            {isPrimary && (
                              <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                PRIMARY
                              </span>
                            )}
                          </h5>
                          
                          {!isPrimary && (
                            <button
                              onClick={async () => {
                                await handleUnmapTeacher(selectedTeacherForDetail.id, instId);
                                loadTeacherDetailsData(selectedTeacherForDetail);
                              }}
                              className="text-[10px] text-red-500 font-bold hover:underline"
                            >
                              Remove Assignment
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wide block">Managed Educational Programs:</span>
                          
                          {items.some((i: any) => i.program_title) ? (
                            <div className="space-y-2">
                              {items.filter((i: any) => i.program_title).map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-slate-50/50 p-2.5 rounded-lg border border-[#E8E8ED]">
                                  <span className="font-semibold text-[#1d1d1f]">{item.program_title}</span>
                                  
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                    item.program_status === "active" || item.program_status === "public"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : item.program_status === "ended" || item.program_status === "archived"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {item.program_status || "Active"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#86868b] italic">No active courses or programs assigned under this campus yet.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assign Additional Campus */}
            <div className="bg-white border border-[#E8E8ED] rounded-xl p-4 shadow-sm space-y-3">
              <h5 className="text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wider">
                Assign Additional Campus / Institution
              </h5>
              <p className="text-[10px] text-[#86868b] font-medium leading-relaxed">
                Map this teacher/trainer to another educational institution. They will be able to manage programs and view academic courses under that institution.
              </p>
              <div className="flex flex-col gap-3 pt-1">
                <div className="relative">
                  <select
                    value={mappingInstId}
                    onChange={(e) => setMappingInstId(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-[#d2d2d7] hover:border-[#86868b] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all appearance-none cursor-pointer pr-10"
                  >
                    <option value="">Choose institution...</option>
                    {institutions.map(inst => {
                      const isAssigned = inst.id === selectedTeacherForDetail.tenant_id || (selectedTeacherForDetail.mapped_tenant_ids || []).includes(inst.id);
                      return (
                        <option key={inst.id} value={inst.id} disabled={isAssigned} className="text-[#1d1d1f]">
                          {inst.name} {isAssigned ? "(Already Assigned)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-[#86868b]">
                    <ChevronDown size={14} />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!mappingInstId) return;
                    await handleMapTeacher(selectedTeacherForDetail.id, mappingInstId);
                    setMappingInstId("");
                  }}
                  disabled={!mappingInstId || loadingTeachers}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mappingInstId && !loadingTeachers
                      ? "bg-[#0066cc] text-white hover:bg-[#0066cc]/95 shadow-sm active:scale-[0.98]"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                >
                  {loadingTeachers ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Assign Institution
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#d2d2d7] bg-slate-50 flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedTeacherForDetail(null)}
              className="bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-slate-100 font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Details
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col text-[#1d1d1f]">
      
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#d2d2d7]/50 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-black/5 rounded-md text-[#1d1d1f] border border-transparent hover:border-black/10 transition-all cursor-pointer mr-1"
              title="Toggle Sidebar"
            >
              <Menu size={14} />
            </button>
            <div className="bg-[#f5f5f7] p-1.5 rounded-md border border-[#d2d2d7]/30">
              <Building className="text-[#1d1d1f]" size={14} />
            </div>
            <div className="flex items-center">
              <span className="font-bold text-xs text-[#1d1d1f] tracking-tight title-font">Hynox Campus</span>
              <span className="bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7] px-2 py-0.5 rounded-full text-[8px] font-semibold tracking-wider uppercase ml-2 hidden sm:inline-block">
                Admin Console
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-5 text-[11px]">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse"></div>
              <span className="text-[#86868b] font-normal">
                Logged in as: <strong className="text-[#1d1d1f] font-semibold">{adminEmail}</strong>
              </span>
            </div>
            <button
              onClick={() => signOutAction()}
              className="flex items-center gap-1.5 bg-transparent hover:bg-black/5 text-[#1d1d1f] border border-black/15 hover:border-black/30 px-2 sm:px-3 py-1 rounded-md transition-all font-medium cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut size={11} className="text-[#86868b]" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>


      {/* Main Grid Workspace */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8 flex-1 w-full relative">
        
        {/* Mobile Sidebar Drawer Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebars container - Collapsible drawer on mobile, inline on desktop */}
        <div className={`
          fixed inset-y-0 left-0 z-50 bg-white lg:bg-transparent p-4 lg:p-0 border-r border-[#d2d2d7]/50 lg:border-none flex gap-4 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto lg:h-auto
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:flex lg:translate-x-0"}
        `}>
          {/* PRIMARY SIDEBAR (Icon-only, narrow, Supabase-style) */}
          <div className="w-14 shrink-0 flex flex-col items-center gap-4 py-2 border-r border-[#d2d2d7]/50 pr-4">
            <button
              onClick={() => {
                setActiveParentTab("institutions");
                setActiveTab("institutions");
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "institutions"
                  ? "bg-[#0066cc] text-white shadow-sm border-[#0066cc]"
                  : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              title="Institutions Space"
            >
              <Building size={18} />
            </button>
            
            <button
              onClick={() => {
                setActiveParentTab("onboarding");
                setActiveTab("onboarding");
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "onboarding"
                  ? "bg-[#0066cc] text-white shadow-sm border-[#0066cc]"
                  : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              title="Onboarding Modules"
            >
              <UserCheck size={18} />
            </button>
            
            <button
              onClick={() => {
                setActiveParentTab("library");
                setActiveTab("library");
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "library"
                  ? "bg-[#0066cc] text-white shadow-sm border-[#0066cc]"
                  : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              title="Library Blueprints"
            >
              <BookOpen size={18} />
            </button>
            
            <button
              onClick={() => {
                setActiveParentTab("programs");
                setActiveTab("programs");
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "programs"
                  ? "bg-[#0066cc] text-white shadow-sm border-[#0066cc]"
                  : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              title="Programs & Academics"
            >
              <GraduationCap size={18} />
            </button>
            <button
              onClick={() => {
                setActiveParentTab("learning_manager");
                setActiveTab("create_activity");
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeParentTab === "learning_manager"
                  ? "bg-[#0066cc] text-white shadow-sm border-[#0066cc]"
                  : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              title="Learning Activities"
            >
              <Award size={18} />
            </button>
          </div>

          {/* SECONDARY SIDEBAR (Sub-options list) */}
          <div className={`
            w-52 shrink-0 flex flex-col gap-2 border-r border-[#d2d2d7]/50 pr-4 lg:border-r
            ${isSidebarOpen ? "flex" : "hidden lg:flex"}
          `}>
            <h4 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-2 mb-2">
              {activeParentTab} Settings
            </h4>
            
            {activeParentTab === "institutions" && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("institutions");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "institutions"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  List Institutions
                </button>
                <button
                  onClick={() => {
                    setActiveTab("add_institution");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "add_institution"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Add Institution
                </button>
                <button
                  onClick={() => {
                    setActiveTab("explorer");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "explorer"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Institution Space
                </button>
              </>
            )}

            {activeParentTab === "onboarding" && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("onboarding");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "onboarding"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Onboarding Status
                </button>
                <button
                  onClick={() => {
                    setActiveTab("csv");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "csv"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  CSV Onboarding
                </button>
                <button
                  onClick={() => {
                    setActiveTab("teacher_mapping");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "teacher_mapping"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Teacher Mapping
                </button>
                <button
                  onClick={() => {
                    setActiveTab("super_admin_invite");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "super_admin_invite"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Super Admin Onboarding
                </button>
              </>
            )}

            {activeParentTab === "library" && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("library");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "library"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Course Blueprints
                </button>
              </>
            )}

            {activeParentTab === "programs" && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("programs");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "programs"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Programs Explorer
                </button>
                <button
                  onClick={() => {
                    setActiveTab("examine_programs");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "examine_programs"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Examine Programs
                </button>
                <button
                  onClick={() => {
                    setActiveTab("cohorts");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "cohorts" || activeTab === "enrollments" || activeTab === "course_assignments"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Cohorts & Delivery
                </button>
                <button
                  onClick={() => {
                    setActiveTab("program_student_progress");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "program_student_progress"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Student Progress
                </button>
              </>
            )}

            {activeParentTab === "learning_manager" && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("create_activity");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "create_activity"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Create Activity
                </button>
                <button
                  onClick={() => {
                    setActiveTab("view_activities");
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeTab === "view_activities"
                      ? "bg-[#0066cc]/10 text-[#0066cc]"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                  }`}
                >
                  Published Activities
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Wrapper Column to keep code clean */}
        <div style={{ display: 'none' }}>
          {/* Leftover Navigation Sidebar placeholder */}
          <button
            onClick={() => {
              setActiveTab("institutions");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "institutions"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Building size={16} />
            Institutions
          </button>


          <button
            onClick={() => {
              setActiveTab("csv");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "csv"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <FileSpreadsheet size={16} />
            CSV Onboarding
          </button>

          <button
            onClick={() => {
              setActiveTab("onboarding");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "onboarding"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <ShieldCheck size={16} />
            Onboarding Status
          </button>

          <button
            onClick={() => {
              setActiveTab("explorer");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "explorer"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Globe size={16} />
            Institution Space
          </button>

          <button
            onClick={() => {
              setActiveTab("library");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "library"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <BookOpen size={16} />
            Library (Blueprints)
          </button>

          <button
            onClick={() => {
              setActiveTab("programs");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "programs"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <GraduationCap size={16} />
            Programs (Live Content)
          </button>

          <div className="pt-4 pb-2 border-t border-[#d2d2d7] mt-2">
            <span className="px-4 text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-2">Delivery Module</span>
          </div>

          <button
            onClick={() => {
              setActiveTab("cohorts");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "cohorts"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Users size={16} />
            Cohorts
          </button>

          <button
            onClick={() => {
              setActiveTab("enrollments");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "enrollments"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <UserCheck size={16} />
            Enrollments
          </button>

          <button
            onClick={() => {
              setActiveTab("course_assignments");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "course_assignments"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <BookOpen size={16} />
            Course Assignments
          </button>

          <button
            onClick={() => {
              setActiveTab("create_activity");
              clearStatuses();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
              activeTab === "create_activity"
                ? "bg-[#0066cc]/10 border-[#0066cc]/20 text-[#0066cc] shadow-sm"
                : "bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Award size={16} />
            Learning Activities
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Global Alert Statuses */}
          {error && (
            <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: INSTITUTIONS */}
          {activeTab === "institutions" && (
            <div className="space-y-6">

              {/* Institutions Listing Table */}
              <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-3 border-b border-[#d2d2d7]">
                  <h4 className="text-xs font-bold text-[#1d1d1f]">REGISTERED INSTITUTIONS</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                        <th className="px-6 py-2.5">Name</th>
                        <th className="px-6 py-2.5">Code</th>
                        <th className="px-6 py-2.5">Type</th>
                        <th className="px-6 py-2.5">Slug</th>
                        <th className="px-6 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {institutions.length > 0 ? (
                        institutions.map((inst, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-3 font-semibold text-[#1d1d1f]">{inst.name}</td>
                            <td className="px-6 py-3 text-[#86868b] font-mono">{inst.institution_code}</td>
                            <td className="px-6 py-3 text-[#86868b] font-medium">{inst.institution_type}</td>
                            <td className="px-6 py-3 text-[#86868b]">{inst.slug}</td>
                             <td className="px-6 py-3 text-right">
                               <select
                                 value={inst.status}
                                 onChange={async (e) => {
                                   const newStatus = e.target.value;
                                   if (confirm(`Are you sure you want to change the status of ${inst.name} to ${newStatus}?`)) {
                                     const res = await updateInstitutionStatusAction(inst.id, newStatus);
                                     if (res.error) {
                                       alert(res.error);
                                     } else {
                                       setInstitutions(prev => prev.map(i => i.id === inst.id ? { ...i, status: newStatus } : i));
                                     }
                                   }
                                 }}
                                 className={`px-2 py-1 rounded-lg text-[10px] font-bold border focus:outline-none cursor-pointer ${
                                   inst.status === "active"
                                     ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                                     : inst.status === "onboarding"
                                     ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                                     : "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                                 }`}
                               >
                                 <option value="active">Active</option>
                                 <option value="onboarding">Onboarding</option>
                                 <option value="inactive">Inactive</option>
                                 <option value="suspended">Suspended</option>
                               </select>
                             </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-6 text-center text-[#86868b]">
                            No registered institutions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 1.5: REGISTER NEW INSTITUTION */}
          {activeTab === "add_institution" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-[#86868b] flex items-center gap-1.5">
                  <Plus size={14} /> Register New Campus Institution
                </h3>
                
                <form onSubmit={handleCreateInstitution} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Institution Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Stanford University"
                      required
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Subdomain Slug (Unique) *</label>
                    <input
                      type="text"
                      placeholder="e.g. stanford"
                      required
                      value={instSlug}
                      onChange={(e) => setInstSlug(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Institution Code (Unique) *</label>
                    <input
                      type="text"
                      placeholder="e.g. SU-CAMPUS"
                      required
                      value={instCode}
                      onChange={(e) => setInstCode(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Category Type *</label>
                    <select
                      value={instType}
                      onChange={(e) => setInstType(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    >
                      <option value="school">School</option>
                      <option value="college">College</option>
                      <option value="university">University</option>
                      <option value="training_center">Training Center</option>
                      <option value="corporate_partner">Corporate Partner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Contact Email</label>
                    <input
                      type="email"
                      placeholder="admin@college.edu"
                      value={instEmail}
                      onChange={(e) => setInstEmail(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#86868b]">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 019-2834"
                      value={instPhone}
                      onChange={(e) => setInstPhone(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-semibold mb-1 text-[#86868b]">Website Address</label>
                    <input
                      type="text"
                      placeholder="https://college.edu"
                      value={instWebsite}
                      onChange={(e) => setInstWebsite(e.target.value)}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-semibold mb-1 text-[#86868b]">Physical Address</label>
                    <textarea
                      placeholder="Street, City, State, ZIP"
                      value={instAddress}
                      onChange={(e) => setInstAddress(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm resize-none text-[#1d1d1f]"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#0066cc] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "Registering..." : "Create Institution"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}


          {/* TAB 3: CSV ONBOARDING / SINGLE ONBOARDING */}
          {activeTab === "csv" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm">
                
                {/* Onboarding Mode Selection Toggle */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#d2d2d7]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-1.5">
                    <UserPlus size={15} /> User Onboarding
                  </h3>
                  
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-[#d2d2d7]">
                    <button
                      type="button"
                      onClick={() => {
                        setOnboardMode("single");
                        clearStatuses();
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        onboardMode === "single"
                          ? "bg-white text-[#0066cc] shadow-sm border border-[#d2d2d7]/30"
                          : "text-[#86868b] hover:text-[#1d1d1f]"
                      }`}
                    >
                      Single User
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnboardMode("csv");
                        clearStatuses();
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        onboardMode === "csv"
                          ? "bg-white text-[#0066cc] shadow-sm border border-[#d2d2d7]/30"
                          : "text-[#86868b] hover:text-[#1d1d1f]"
                      }`}
                    >
                      Bulk CSV Upload
                    </button>
                  </div>
                </div>

                {onboardMode === "single" ? (
                  // Single User Onboarding Form
                  <form onSubmit={handleSingleUserOnboard} className="space-y-4 text-xs">
                    <p className="text-xs text-[#86868b] mb-2 leading-relaxed">
                      Onboard a single user instantly. Fill in their details below, select their role, and assign them to a school/college campus.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Campus / Institution *</label>
                        <select
                          value={selectedInstId}
                          onChange={(e) => setSelectedInstId(e.target.value)}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                          required
                        >
                          <option value="">-- Choose Institution or School --</option>
                          {institutions.map((inst) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.name} ({inst.institution_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Assigned Role *</label>
                        <select
                          value={singleRole}
                          onChange={(e) => setSingleRole(e.target.value)}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                          required
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher / Trainer</option>
                          <option value="institution_admin">Institution Administrator</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Full Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={singleName}
                          onChange={(e) => setSingleName(e.target.value)}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Email Address *</label>
                        <input
                          type="email"
                          placeholder="e.g. john.doe@school.edu"
                          value={singleEmail}
                          onChange={(e) => setSingleEmail(e.target.value)}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading || !selectedInstId || !singleName.trim() || !singleEmail.trim()}
                        className="bg-[#0066cc] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all disabled:opacity-50"
                      >
                        {loading ? "Sending Invitation..." : "Onboard Single User"}
                      </button>
                    </div>
                  </form>
                ) : (
                  // Bulk CSV Onboarding Form
                  <form onSubmit={handleCsvUpload} className="space-y-4 text-xs">
                    <p className="text-xs text-[#86868b] mb-2 leading-relaxed">
                      Download our pre-filled Excel template, populate your spreadsheet, and upload it directly. Or simply paste CSV data directly in the textbox below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Default Institution *</label>
                        <select
                          value={selectedInstId}
                          onChange={(e) => setSelectedInstId(e.target.value)}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                          required
                        >
                          <option value="">-- Choose Institution or School --</option>
                          {institutions.map((inst) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.name} ({inst.institution_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={!selectedInstId}
                          onClick={downloadTemplateExcel}
                          className="flex items-center gap-1.5 bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 px-3.5 py-2 rounded-lg hover:bg-[#0066cc] hover:text-white transition-all font-semibold disabled:opacity-50 text-[11px]"
                        >
                          <Download size={13} />
                          Download Excel Template
                        </button>
                      </div>
                    </div>

                    {/* File Upload Box */}
                    <div className="border border-dashed border-[#d2d2d7] bg-slate-50/50 hover:bg-slate-50 rounded-xl p-6 text-center transition-all relative">
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={!selectedInstId}
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="text-[#86868b]" size={20} />
                        <span className="font-semibold text-xs text-[#1d1d1f]">
                          {uploadedFileName ? `Selected: ${uploadedFileName}` : "Click or Drag & Drop Excel/CSV sheet here"}
                        </span>
                        <span className="text-[10px] text-[#86868b]">
                          Supports .xlsx, .xls, and .csv formats
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-[#86868b]">Spreadsheet Preview (Pasted or Loaded) *</label>
                        <button
                          type="button"
                          onClick={() => setCsvContent(`name,email\nJane Doe,jane@school.edu\nJohn Smith,john@school.edu`)}
                          className="text-[10px] text-[#0066cc] hover:underline font-bold"
                        >
                          (Insert Sample Template)
                        </button>
                      </div>
                      <textarea
                        placeholder="name,email,institution_id&#10;Jane Doe,jane.doe@college.edu&#10;John Smith,john.smith@college.edu"
                        required
                        value={csvContent}
                        onChange={(e) => setCsvContent(e.target.value)}
                        rows={8}
                        className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#0066cc] shadow-sm resize-y"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={loading || !selectedInstId || !csvContent.trim()}
                        className="bg-[#0066cc] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all disabled:opacity-50"
                      >
                        {loading ? "Processing Onboarding..." : "Process Bulk Onboarding Link"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Onboarding Links Generation Display */}
              {links.length > 0 && (
                <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-6 py-3 border-b border-[#d2d2d7]">
                    <h4 className="text-xs font-bold text-[#1d1d1f]">GENERATED ONBOARDING LINKS</h4>
                  </div>
                  
                  <div className="divide-y divide-[#d2d2d7]">
                    {links.map((link, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/20 text-xs">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1d1d1f] truncate">{link.email}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              link.status === "success" 
                                ? "bg-[#16A34A]/10 text-[#16A34A]" 
                                : "bg-[#DC2626]/10 text-[#DC2626]"
                            }`}>
                              {link.status === "success" ? "Success" : "Failed"}
                            </span>
                          </div>
                          {link.error && <p className="text-[#DC2626] text-[10px]">{link.error}</p>}
                          {link.link && (
                            <span className="text-[#86868b] font-mono text-[10px] select-all truncate block">
                              {link.link}
                            </span>
                          )}
                        </div>

                        {link.link && (
                          <button
                            onClick={() => copyToClipboard(link.link)}
                            className="flex items-center justify-center gap-1.5 border border-[#d2d2d7] bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all font-semibold shrink-0 text-[10px]"
                          >
                            <Copy size={12} />
                            Copy Link
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === "super_admin_invite" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#d2d2d7]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-1.5">
                    <ShieldCheck size={15} /> Super Admin Onboarding
                  </h3>
                </div>

                <form onSubmit={handleSuperAdminOnboard} className="space-y-4 text-xs">
                  <p className="text-xs text-[#86868b] mb-2 leading-relaxed">
                    Create a new Super Administrator account. Fill in their details below. We will generate an onboarding token and link so they can log in directly and gain full administrative privileges.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1 text-[#86868b]">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Administrator Name"
                        value={superAdminName}
                        onChange={(e) => setSuperAdminName(e.target.value)}
                        className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-[#86868b]">Email Address *</label>
                      <input
                        type="email"
                        placeholder="e.g. admin@hynox.co"
                        value={superAdminEmail}
                        onChange={(e) => setSuperAdminEmail(e.target.value)}
                        className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading || !superAdminName.trim() || !superAdminEmail.trim()}
                      className="bg-[#0066cc] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 transition-all disabled:opacity-50"
                    >
                      {loading ? "Generating Link..." : "Generate & Send Onboarding Link"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Onboarding Links Generation Display */}
              {links.length > 0 && (
                <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-6 py-3 border-b border-[#d2d2d7]">
                    <h4 className="text-xs font-bold text-[#1d1d1f]">GENERATED ONBOARDING LINKS</h4>
                  </div>
                  
                  <div className="divide-y divide-[#d2d2d7]">
                    {links.map((link, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/20 text-xs">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1d1d1f] truncate">{link.email}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              link.status === "success" 
                                ? "bg-[#16A34A]/10 text-[#16A34A]" 
                                : "bg-[#DC2626]/10 text-[#DC2626]"
                            }`}>
                              {link.status === "success" ? "Success" : "Failed"}
                            </span>
                          </div>
                          {link.error && <p className="text-[#DC2626] text-[10px]">{link.error}</p>}
                          {link.link && (
                            <span className="text-[#86868b] font-mono text-[10px] select-all truncate block">
                              {link.link}
                            </span>
                          )}
                        </div>

                        {link.link && (
                          <button
                            onClick={() => copyToClipboard(link.link)}
                            className="flex items-center justify-center gap-1.5 border border-[#d2d2d7] bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all font-semibold shrink-0 text-[10px]"
                          >
                            <Copy size={12} />
                            Copy Link
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Super Admin Invitations */}
              <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50/50 px-6 py-3.5 border-b border-[#d2d2d7]">
                  <h4 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider">Super Admin Invitations Status</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                        <th className="px-6 py-3">Administrator Name</th>
                        <th className="px-6 py-3">Email Address</th>
                        <th className="px-6 py-3">Created / Expires At</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {superAdminInvitations.length > 0 ? (
                        superAdminInvitations.map((inv) => {
                          const now = new Date();
                          const isExpired = inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now);
                          const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                          const fullInviteLink = `${appUrl}/onboarding/verify?token=${inv.token}&email=${encodeURIComponent(inv.user?.email || "")}`;

                          let statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20 flex items-center gap-1 w-fit">
                              <Clock size={10} /> Pending
                            </span>
                          );

                          if (inv.status === "accepted") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Accepted
                              </span>
                            );
                          } else if (isExpired) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Expired
                              </span>
                            );
                          } else if (inv.status === "failed") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Mail Failed
                              </span>
                            );
                          } else if (inv.status === "revoked") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-500/10 text-slate-500 border-slate-500/20 flex items-center gap-1 w-fit">
                                <Ban size={10} /> Revoked
                              </span>
                            );
                          } else if (inv.status === "created") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/20 flex items-center gap-1 w-fit">
                                <Clock size={10} /> Mail Pending
                              </span>
                            );
                          } else if (inv.status === "sent") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Mail Sent
                              </span>
                            );
                          }

                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-6 py-4 font-semibold text-[#1d1d1f]">
                                {inv.user?.full_name || "N/A"}
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-[#86868b]">
                                {inv.user?.email}
                              </td>
                              <td className="px-6 py-4 text-[#86868b] leading-normal">
                                <div className="font-medium text-[11px]">
                                  Sent: {new Date(inv.created_at).toLocaleDateString()}
                                </div>
                                <div className={`text-[10px] ${isExpired ? "text-[#DC2626]" : "text-[#86868b]"}`}>
                                  {isExpired ? "Expired" : `Expires: ${new Date(inv.expires_at).toLocaleDateString()}`}
                                </div>
                              </td>
                              <td className="px-6 py-4">{statusBadge}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!isExpired && inv.status !== "accepted" && inv.status !== "revoked" && (
                                    <button
                                      onClick={() => copyToClipboard(fullInviteLink)}
                                      className="flex items-center gap-1 border border-[#d2d2d7] bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all font-semibold text-[10px]"
                                    >
                                      <Copy size={11} /> Copy Link
                                    </button>
                                  )}
                                  
                                  {inv.status !== "accepted" && (
                                    <button
                                      disabled={regeneratingId === inv.id}
                                      onClick={() => handleRegenerateInvite(inv.id)}
                                      className="flex items-center gap-1.5 bg-[#0066cc] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#0066cc]/95 transition-all font-semibold text-[10px] disabled:opacity-50"
                                    >
                                      {regeneratingId === inv.id ? (
                                        <RefreshCw size={11} className="animate-spin" />
                                      ) : (
                                        <RefreshCw size={11} />
                                      )}
                                      Regenerate Token
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#86868b] font-medium">
                            No Super Admin invitations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ONBOARDING STATUS DASHBOARD */}
          {activeTab === "onboarding" && (
            <div className="space-y-6">
              
              {/* Statistics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Total Invited</div>
                  <div className="text-xl font-bold mt-1 text-[#1d1d1f]">{computedStats.total}</div>
                </div>
                <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wider">Accepted (Approved)</div>
                  <div className="text-xl font-bold mt-1 text-[#16A34A]">{computedStats.accepted}</div>
                </div>
                <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#0066cc] uppercase tracking-wider">Pending (Awaiting)</div>
                  <div className="text-xl font-bold mt-1 text-[#0066cc]">{computedStats.pending}</div>
                </div>
                <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-wider">Expired</div>
                  <div className="text-xl font-bold mt-1 text-[#F59E0B]">{computedStats.expired}</div>
                </div>
                <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider">Failed / Revoked</div>
                  <div className="text-xl font-bold mt-1 text-[#DC2626]">{computedStats.failed + computedStats.revoked}</div>
                </div>
              </div>

              {/* Main List and Filters Card */}
              <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#d2d2d7] space-y-4 bg-slate-50/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(["all", "pending", "accepted", "expired", "failed", "revoked"] as const).map((filter) => {
                        const labelMap = {
                          all: "All Statuses",
                          pending: "Pending / Sent",
                          accepted: "Accepted",
                          expired: "Expired",
                          failed: "Failed",
                          revoked: "Revoked",
                        };
                        const isActive = inviteFilter === filter;
                        return (
                          <button
                            key={filter}
                            onClick={() => setInviteFilter(filter)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                              isActive
                                ? "bg-[#0066cc] text-white border-[#0066cc] shadow-sm"
                                : "bg-white text-[#86868b] border-[#d2d2d7] hover:bg-slate-50 hover:text-[#1d1d1f]"
                            }`}
                          >
                            {labelMap[filter]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search input */}
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-2.5 text-[#86868b]" size={14} />
                      <input
                        type="text"
                        placeholder="Search invitees..."
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        className="w-full bg-white border border-[#d2d2d7] rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                      />
                    </div>
                  </div>

                  {/* Advanced Filters Row */}
                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#d2d2d7]/50 text-xs">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Institution Scope</span>
                      <select
                        value={inviteInstitutionFilter}
                        onChange={(e) => setInviteInstitutionFilter(e.target.value)}
                        className="bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
                      >
                        <option value="all">All Institutions</option>
                        {institutions.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Assigned Role</span>
                      <select
                        value={inviteRoleFilter}
                        onChange={(e) => setInviteRoleFilter(e.target.value)}
                        className="bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
                      >
                        <option value="all">All Roles</option>
                        <option value="student_onboarding">Student</option>
                        <option value="trainer_onboarding">Teacher / Trainer</option>
                        <option value="institution_admin_invite">Institution Admin</option>
                        <option value="super_admin_invite">Super Admin</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Creation Timeline</span>
                      <select
                        value={inviteDateFilter}
                        onChange={(e) => setInviteDateFilter(e.target.value)}
                        className="bg-white border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-sm"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                      </select>
                    </div>

                    {(inviteInstitutionFilter !== "all" || inviteRoleFilter !== "all" || inviteDateFilter !== "all" || inviteSearch || inviteFilter !== "all") && (
                      <div className="flex items-end self-end h-[38px] pb-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setInviteInstitutionFilter("all");
                            setInviteRoleFilter("all");
                            setInviteDateFilter("all");
                            setInviteSearch("");
                            setInviteFilter("all");
                          }}
                          className="text-[#0066cc] hover:text-[#0066cc]/80 font-semibold text-xs hover:underline cursor-pointer flex items-center gap-1"
                        >
                          Reset Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                        <th className="px-6 py-3">Invitee Details</th>
                        <th className="px-6 py-3">Target Campus / Role</th>
                        <th className="px-6 py-3">Created / Expires At</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {filteredInvitations.length > 0 ? (
                        filteredInvitations.map((inv) => {
                          const now = new Date();
                          const isExpired = inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now);
                          const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                          const fullInviteLink = `${appUrl}/onboarding/verify?token=${inv.token}&email=${encodeURIComponent(inv.user?.email || "")}`;

                          // Human readable role mapping
                          const roleNameMap: Record<string, string> = {
                            student_onboarding: "Student",
                            trainer_onboarding: "Teacher",
                            institution_admin_invite: "Institution Admin",
                            super_admin_invite: "Super Administrator",
                          };
                          const roleLabel = roleNameMap[inv.invitation_type] || "Member";

                          // Determine badge color
                          let statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20 flex items-center gap-1 w-fit">
                              <Clock size={10} /> Pending
                            </span>
                          );

                          if (inv.status === "accepted") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Accepted
                              </span>
                            );
                          } else if (isExpired) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Expired
                              </span>
                            );
                          } else if (inv.status === "failed") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Mail Failed
                              </span>
                            );
                          } else if (inv.status === "revoked") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-500/10 text-slate-500 border-slate-500/20 flex items-center gap-1 w-fit">
                                <Ban size={10} /> Revoked
                              </span>
                            );
                          } else if (inv.status === "created") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/20 flex items-center gap-1 w-fit">
                                <Clock size={10} /> Mail Pending
                              </span>
                            );
                          } else if (inv.status === "sent") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Mail Sent
                              </span>
                            );
                          }

                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-[#1d1d1f]">{inv.user?.full_name || "N/A"}</div>
                                <div className="text-[#86868b] text-[11px] font-medium">{inv.user?.email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-[#1d1d1f]">{inv.institution_name}</div>
                                <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-[#86868b] font-bold text-[9px] mt-0.5">
                                  {roleLabel}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[#86868b] leading-normal">
                                <div className="font-medium text-[11px]">
                                  Sent: {new Date(inv.created_at).toLocaleDateString()}
                                </div>
                                <div className={`text-[10px] ${isExpired ? "text-[#DC2626]" : "text-[#86868b]"}`}>
                                  {isExpired ? "Expired" : `Expires: ${new Date(inv.expires_at).toLocaleDateString()}`}
                                </div>
                              </td>
                              <td className="px-6 py-4">{statusBadge}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!isExpired && inv.status !== "accepted" && inv.status !== "revoked" && (
                                    <button
                                      onClick={() => copyToClipboard(fullInviteLink)}
                                      className="flex items-center gap-1 border border-[#d2d2d7] bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all font-semibold text-[10px]"
                                    >
                                      <Copy size={11} /> Copy Link
                                    </button>
                                  )}
                                  
                                  {inv.status !== "accepted" && (
                                    <button
                                      disabled={regeneratingId === inv.id}
                                      onClick={() => handleRegenerateInvite(inv.id)}
                                      className="flex items-center gap-1.5 bg-[#0066cc] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#0066cc]/95 transition-all font-semibold text-[10px] disabled:opacity-50"
                                    >
                                      {regeneratingId === inv.id ? (
                                        <RefreshCw size={11} className="animate-spin" />
                                      ) : (
                                        <RefreshCw size={11} />
                                      )}
                                      Regenerate Token
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#86868b] font-medium">
                            No matching invitations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: TEACHER MULTI-INSTITUTION MAPPING */}
          {activeTab === "teacher_mapping" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-sm p-6">
                <div>
                  <h3 className="text-sm font-bold text-[#1d1d1f]">Teacher Campus Assignments Mapping</h3>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Assign, manage, and map registered educators and teachers to various school or college campus institutions.</p>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E8E8ED]">
                  <div className="w-full sm:max-w-xs">
                    <input 
                      type="text"
                      placeholder="Search teachers by name or email..."
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      className="bg-white border border-[#d2d2d7] px-3.5 py-1.5 rounded-lg text-xs w-full focus:outline-none focus:border-[#0066cc]"
                    />
                  </div>
                  <button 
                    onClick={loadAllTeachersData}
                    disabled={loadingTeachers}
                    className="flex items-center gap-1.5 bg-[#0066cc] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#0066cc]/95 transition-all text-xs font-bold disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loadingTeachers ? "animate-spin" : ""} />
                    Refresh Teachers
                  </button>
                </div>

                {loadingTeachers && teachersList.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#86868b] font-medium flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-[#0066cc]" /> Retrieving registered teacher credentials...
                  </div>
                ) : teachersList.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#86868b] border border-dashed border-[#d2d2d7] rounded-xl mt-4">
                    No registered teachers/trainers found on the platform.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E8E8ED] mt-2">
                    {teachersList.filter(t => 
                      !teacherSearch || 
                      t.full_name?.toLowerCase().includes(teacherSearch.toLowerCase()) || 
                      t.email?.toLowerCase().includes(teacherSearch.toLowerCase())
                    ).map(teacher => {
                      const primaryInst = institutions.find(i => i.id === teacher.tenant_id);
                      
                      return (
                        <div 
                          key={teacher.id} 
                          onClick={() => loadTeacherDetailsData(teacher)}
                          className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:bg-slate-50/50 px-3 rounded-xl transition-all cursor-pointer select-none"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                              {teacher.full_name}
                              <span className="bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                                Teacher
                              </span>
                            </h4>
                            <p className="text-[10px] text-[#86868b]">{teacher.email}</p>
                            
                          </div>
                          <div className="text-xs text-[#0066cc] font-semibold flex items-center gap-1 hover:underline">
                            View details & assign
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: INSTITUTION SPACE EXPLORER */}
          {activeTab === "explorer" && (
            <div className="space-y-6">
              
              {/* Selector Card */}
              <div className="bg-white border border-[#d2d2d7] p-6 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#86868b] flex items-center gap-1.5">
                  <Globe size={14} /> Select Campus Space
                </h3>
                <p className="text-xs text-[#86868b] mb-4">
                  Select a campus institution tenant to explore its registered administrators, teachers, and students.
                </p>
                <select
                  value={explorerSelectedId}
                  onChange={(e) => handleSelectInstitutionForExplorer(e.target.value)}
                  className="w-full max-w-md bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                >
                  <option value="">-- Choose Institution --</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.institution_code})
                    </option>
                  ))}
                </select>
              </div>

              {explorerSelectedId && (
                <>
                  {explorerLoading ? (
                    <div className="bg-white border border-[#d2d2d7] rounded-xl p-12 text-center shadow-sm">
                      <RefreshCw size={24} className="animate-spin text-[#0066cc] mx-auto mb-2" />
                      <p className="text-xs text-[#86868b] font-medium">Loading campus directory...</p>
                    </div>
                  ) : (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Total Campus Users</div>
                          <div className="text-xl font-bold mt-1 text-[#1d1d1f]">{computedExplorerStats.total}</div>
                        </div>
                        <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wider">Administrators</div>
                          <div className="text-xl font-bold mt-1 text-[#16A34A]">{computedExplorerStats.admins}</div>
                        </div>
                        <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#0066cc] uppercase tracking-wider">Teachers / Trainers</div>
                          <div className="text-xl font-bold mt-1 text-[#0066cc]">{computedExplorerStats.teachers}</div>
                        </div>
                        <div className="bg-white border border-[#d2d2d7] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#06B6D4] uppercase tracking-wider">Students</div>
                          <div className="text-xl font-bold mt-1 text-[#06B6D4]">{computedExplorerStats.students}</div>
                        </div>
                      </div>

                      {/* User list and filtering */}
                      <div className="bg-white border border-[#d2d2d7] rounded-xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-[#d2d2d7] flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                          {/* Filter Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                            {(["all", "admin", "teacher", "student"] as const).map((filter) => {
                              const labelMap = {
                                all: "All Users",
                                admin: "Administrators",
                                teacher: "Teachers / Trainers",
                                student: "Students",
                              };
                              const isActive = explorerRoleFilter === filter;
                              return (
                                <button
                                  key={filter}
                                  onClick={() => setExplorerRoleFilter(filter)}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                    isActive
                                      ? "bg-[#0066cc] text-white border-[#0066cc] shadow-sm"
                                      : "bg-white text-[#86868b] border-[#d2d2d7] hover:bg-slate-50"
                                  }`}
                                >
                                  {labelMap[filter]}
                                </button>
                              );
                            })}
                          </div>

                          {/* Search Input */}
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 text-[#86868b]" size={14} />
                            <input
                              type="text"
                              placeholder="Search directory..."
                              value={explorerSearch}
                              onChange={(e) => setExplorerSearch(e.target.value)}
                              className="w-full bg-white border border-[#d2d2d7] rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-xs text-[#1d1d1f]"
                            />
                          </div>
                        </div>

                        {/* Directory Directory Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50/30 border-b border-[#d2d2d7] font-bold text-[#86868b]">
                                <th className="px-6 py-3">User Details</th>
                                <th className="px-6 py-3">Assigned Role</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Joined Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#d2d2d7]">
                              {filteredExplorerUsers.length > 0 ? (
                                filteredExplorerUsers.map((user) => {
                                  // Determine badge style for role
                                  let roleBadge = (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-100 text-[#86868b] border-slate-200">
                                      Member
                                    </span>
                                  );

                                  if (user.roles.includes("super_admin") || user.roles.includes("institution_admin")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20">
                                        Admin
                                      </span>
                                    );
                                  } else if (user.roles.includes("teacher") || user.roles.includes("trainer")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20">
                                        Teacher
                                      </span>
                                    );
                                  } else if (user.roles.includes("student")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/20">
                                        Student
                                      </span>
                                    );
                                  }

                                  // Determine badge for user status
                                  let statusBadge = (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20">
                                      {user.status}
                                    </span>
                                  );

                                  if (user.status === "invited" || user.status === "pending_activation") {
                                    statusBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20">
                                        {user.status}
                                      </span>
                                    );
                                  } else if (user.status === "suspended" || user.status === "inactive" || user.status === "blocked") {
                                    statusBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20">
                                        {user.status}
                                      </span>
                                    );
                                  }

                                  return (
                                    <tr key={user.id} onClick={() => setSelectedUserDetail(user)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                                      <td className="px-6 py-4">
                                        <div className="font-semibold text-[#1d1d1f]">{user.full_name || "N/A"}</div>
                                        <div className="text-[#86868b] text-[11px] font-medium">{user.email}</div>
                                      </td>
                                      <td className="px-6 py-4">{roleBadge}</td>
                                      <td className="px-6 py-4">{statusBadge}</td>
                                      <td className="px-6 py-4 text-[#86868b] font-medium">
                                        {new Date(user.created_at).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={4} className="px-6 py-8 text-center text-[#86868b] font-medium">
                                    No users found in this role group.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

            </div>
          )}

          {/* TAB 6: LIBRARY (BLUEPRINTS) */}
          {activeTab === "library" && (
            <div className="space-y-6 animate-fade-in">
              <LibraryBuilder />
            </div>
          )}

          {/* TAB 7: PROGRAMS EXPLORER */}
          {activeTab === "programs" && (
            <div className="space-y-6 animate-fade-in">
              <ProgramManager 
                institutions={institutions} 
                mode="explorer" 
                selectedInstId={progSelectedInstId}
                setSelectedInstId={setProgSelectedInstId}
                selectedProgram={progSelectedProgram}
                setSelectedProgram={setProgSelectedProgram}
              />
            </div>
          )}

          {/* TAB 7.5: EXAMINE PROGRAMS */}
          {activeTab === "examine_programs" && (
            <div className="space-y-6 animate-fade-in">
              <ProgramManager 
                institutions={institutions} 
                mode="examine" 
                selectedInstId={progSelectedInstId}
                setSelectedInstId={setProgSelectedInstId}
                selectedProgram={progSelectedProgram}
                setSelectedProgram={setProgSelectedProgram}
              />
            </div>
          )}

          {/* TAB 8: COHORTS */}
          {activeTab === "cohorts" && (
            <div className="space-y-6 animate-fade-in">
              <DeliveryManager institutions={institutions} initialTab="cohorts" />
            </div>
          )}

          {/* TAB 9: ENROLLMENTS */}
          {activeTab === "enrollments" && (
            <div className="space-y-6 animate-fade-in">
              <DeliveryManager institutions={institutions} initialTab="enrollments" />
            </div>
          )}

          {/* TAB 10: COURSE ASSIGNMENTS */}
          {activeTab === "course_assignments" && (
            <div className="space-y-6 animate-fade-in">
              <DeliveryManager institutions={institutions} initialTab="assignments" />
            </div>
          )}

          {activeTab === "program_student_progress" && (
            <div className="space-y-6 animate-fade-in">
              <AdminStudentProgress institutions={institutions} />
            </div>
          )}

          {/* TAB: LEARNING MANAGER */}
          {activeTab === "create_activity" && (
            <div className="space-y-6 animate-fade-in">
              <LearningManager institutions={institutions} mode="create" />
            </div>
          )}

          {activeTab === "view_activities" && (
            <div className="space-y-6 animate-fade-in">
              <LearningManager institutions={institutions} mode="view" />
            </div>
          )}

          {/* TAB 6: ACADEMIC BUILDER (DEPRECATED) */}
          {false && activeTab === "academics" && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Institution Selection */}
              <div className="bg-white border border-[#d2d2d7] p-6 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#86868b] flex items-center gap-1.5">
                  <GraduationCap size={15} /> Academic Institution Scope
                </h3>
                <p className="text-xs text-[#86868b] mb-4">
                  Select a campus institution to manage its academic catalog, course curriculum, and teacher mapping.
                </p>
                <select
                  value={acadSelectedInstId}
                  onChange={(e) => {
                    setAcadSelectedInstId(e.target.value);
                  }}
                  className="w-full max-w-md bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                >
                  <option value="">-- Select Institution Campus --</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.institution_code})
                    </option>
                  ))}
                </select>
              </div>

              {acadSelectedInstId && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Programs & Courses */}
                  <div className="lg:col-span-1 space-y-6">
                    
                    {/* Programs Section */}
                    <div className="bg-white border border-[#d2d2d7] rounded-xl p-4 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
                          <Folder size={14} className="text-[#0066cc]" /> Programs
                        </h4>
                        <button
                          onClick={() => {
                            setEditingProgram(null);
                            const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                            const publicVisibility = acadLookups.visibilityTypes.find((v: any) => v.code === "public")?.id || "";
                            setProgramForm({ title: "", slug: "", description: "", status_id: activeStatus, visibility_type_id: publicVisibility });
                            setProgramModalOpen(true);
                          }}
                          className="flex items-center gap-1 bg-[#0066cc] text-white px-2 py-1 rounded-lg hover:bg-[#0066cc]/95 transition-all text-[10px] font-bold shadow-sm"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {acadPrograms.length > 0 ? (
                          acadPrograms.map((prog) => (
                            <div
                              key={prog.id}
                              onClick={() => {
                                setAcadSelectedProgram(prog);
                                setAcadSelectedCourse(null);
                              }}
                              className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                acadSelectedProgram?.id === prog.id
                                  ? "bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]"
                                  : "bg-slate-50/50 hover:bg-slate-50 border-[#d2d2d7] text-[#1d1d1f]"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold truncate">{prog.title}</p>
                                <p className="text-[10px] text-[#86868b] font-mono truncate">/{prog.slug}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProgram(prog);
                                    setProgramForm({
                                      title: prog.title,
                                      slug: prog.slug,
                                      description: prog.description || "",
                                      status_id: prog.status_id,
                                      visibility_type_id: prog.visibility_type_id
                                    });
                                    setProgramModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-slate-200 rounded text-[#86868b] hover:text-[#1d1d1f]"
                                >
                                  <Edit size={12} />
                                </button>
                                <div className="relative inline-block text-left">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenProgDropdownId(openProgDropdownId === prog.id ? null : prog.id);
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                      acadLookups.statuses.find((s: any) => s.id === prog.status_id)?.code === "active"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80"
                                        : acadLookups.statuses.find((s: any) => s.id === prog.status_id)?.code === "draft"
                                        ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80"
                                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                                    }`}
                                  >
                                    {acadLookups.statuses.find((s: any) => s.id === prog.status_id)?.code.toUpperCase() || "DRAFT"}
                                    <ChevronDown size={10} className="opacity-70" />
                                  </button>

                                  {openProgDropdownId === prog.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenProgDropdownId(null); }}></div>
                                      <div className="absolute right-0 mt-1.5 w-28 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 font-semibold text-[9px] overflow-hidden text-slate-700">
                                        {acadLookups.statuses
                                          .filter((s: any) => ["active", "draft", "disabled"].includes(s.code))
                                          .map((s: any) => (
                                            <button
                                              key={s.id}
                                              type="button"
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                setOpenProgDropdownId(null);
                                                const res = await updateProgramAction(prog.id, {
                                                  title: prog.title,
                                                  slug: prog.slug,
                                                  description: prog.description || "",
                                                  status_id: s.id,
                                                  visibility_type_id: prog.visibility_type_id
                                                });
                                                if (res.error) {
                                                  setError(res.error);
                                                } else {
                                                  setSuccess("Program status updated successfully!");
                                                  await refreshPrograms();
                                                }
                                              }}
                                              className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 transition-all flex items-center gap-1.5"
                                            >
                                              <span className={`w-1 h-1 rounded-full ${
                                                s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-slate-400" : "bg-red-500"
                                              }`}></span>
                                              {s.code.toUpperCase()}
                                            </button>
                                          ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-[#86868b] text-center py-4 bg-slate-50/50 rounded-lg">No programs registered yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Courses Section */}
                    {acadSelectedProgram && (
                      <div className="bg-white border border-[#d2d2d7] rounded-xl p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
                              <GraduationCap size={14} className="text-[#0066cc]" /> Courses
                            </h4>
                            <p className="text-[10px] text-[#86868b] truncate font-medium">under: {acadSelectedProgram.title}</p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingCourse(null);
                              const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                              const publicVisibility = acadLookups.visibilityTypes.find((v: any) => v.code === "public")?.id || "";
                              const defaultType = acadLookups.courseTypes[0]?.id || "";
                              setCourseForm({
                                title: "",
                                slug: "",
                                description: "",
                                course_type_id: defaultType,
                                status_id: activeStatus,
                                visibility_type_id: publicVisibility,
                                enrollment_mode: "open",
                                duration_minutes: 60,
                                thumbnail_path: ""
                              });
                              setCourseModalOpen(true);
                            }}
                            className="flex items-center gap-1 bg-[#0066cc] text-white px-2 py-1 rounded-lg hover:bg-[#0066cc]/95 transition-all text-[10px] font-bold shadow-sm shrink-0"
                          >
                            <Plus size={12} /> Add
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                          {acadCourses.length > 0 ? (
                            acadCourses.map((crs) => (
                              <div
                                key={crs.id}
                                onClick={() => setAcadSelectedCourse(crs)}
                                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                  acadSelectedCourse?.id === crs.id
                                    ? "bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]"
                                    : "bg-slate-50/50 hover:bg-slate-50 border-[#d2d2d7] text-[#1d1d1f]"
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold truncate">{crs.title}</p>
                                  <p className="text-[10px] text-[#86868b] truncate font-mono">/{crs.slug}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCourse(crs);
                                      setCourseForm({
                                        title: crs.title,
                                        slug: crs.slug,
                                        description: crs.description || "",
                                        course_type_id: crs.course_type_id || "",
                                        status_id: crs.status_id || "",
                                        visibility_type_id: crs.visibility_type_id || "",
                                        enrollment_mode: crs.enrollment_mode || "open",
                                        duration_minutes: crs.duration_minutes || 0,
                                        thumbnail_path: crs.thumbnail_path || ""
                                      });
                                      setCourseModalOpen(true);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded text-[#86868b] hover:text-[#1d1d1f]"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm("Are you sure you want to delete this course?")) {
                                        const res = await deleteCourseAction(crs.id);
                                        if (res.error) setError(res.error);
                                        else {
                                          setSuccess("Course deleted successfully!");
                                          if (acadSelectedCourse?.id === crs.id) setAcadSelectedCourse(null);
                                          await refreshCourses();
                                        }
                                      }
                                    }}
                                    className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-[#86868b] text-center py-4 bg-slate-50/50 rounded-lg font-medium">No courses in this program.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right 2 Columns: Selected Course Curriculum & Instructors */}
                  <div className="lg:col-span-2 space-y-6">
                    {acadSelectedCourse ? (
                      <>
                        {/* Course Overview & Instructors Map */}
                        <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#d2d2d7] pb-4">
                            <div>
                              <h3 className="text-sm font-bold text-[#1d1d1f]">{acadSelectedCourse.title}</h3>
                              <p className="text-xs text-[#86868b] mt-0.5">{acadSelectedCourse.description || "No description set for this course."}</p>
                            </div>
                            <div className="mt-2 sm:mt-0 bg-slate-100 px-3 py-1.5 rounded-lg text-[11px] text-[#1d1d1f] border border-[#d2d2d7] font-mono shrink-0 font-semibold">
                              Duration: {acadSelectedCourse.duration_minutes || 0} mins
                            </div>
                          </div>

                          {/* Instructors Panel */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
                              <Users size={14} className="text-[#0066cc]" /> Course Instructors (Teachers/Trainers)
                            </h4>
                            
                            <form onSubmit={handleSaveInstructors} className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto p-1 border border-[#d2d2d7] rounded-lg">
                                {acadTenantTeachers.length > 0 ? (
                                  acadTenantTeachers.map((teach) => {
                                    const isAssigned = acadInstructors.some(i => i.user_id === teach.id);
                                    return (
                                      <label key={teach.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer text-xs transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={isAssigned}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setAcadInstructors([...acadInstructors, { user_id: teach.id, user: teach }]);
                                            } else {
                                              setAcadInstructors(acadInstructors.filter(i => i.user_id !== teach.id));
                                            }
                                          }}
                                          className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc] h-3.5 w-3.5"
                                        />
                                        <div className="min-w-0">
                                          <p className="font-semibold text-[#1d1d1f] truncate">{teach.full_name}</p>
                                          <p className="text-[10px] text-[#86868b] truncate font-medium">{teach.email}</p>
                                        </div>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <p className="col-span-2 text-[11px] text-[#86868b] text-center py-4 font-medium">No active teachers/trainers found in this tenant space.</p>
                                )}
                              </div>
                              {acadTenantTeachers.length > 0 && (
                                <button
                                  type="submit"
                                  disabled={loading}
                                  className="flex items-center gap-1.5 bg-[#0066cc] text-white px-3.5 py-2 rounded-lg hover:bg-[#0066cc]/95 transition-all text-xs font-semibold shadow-sm disabled:opacity-50"
                                >
                                  <Save size={13} />
                                  {loading ? "Saving Mapping..." : "Save Assigned Instructors"}
                                </button>
                              )}
                            </form>
                          </div>
                        </div>

                        {/* Curriculum Modules & Lessons Explorer */}
                        <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-[#d2d2d7] pb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
                              <FolderPlus size={15} className="text-[#0066cc]" /> Course Curriculum Modules
                            </h4>
                            <button
                              onClick={() => {
                                setEditingModule(null);
                                const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                                setModuleForm({ title: "", description: "", position: acadModules.length + 1, status_id: activeStatus });
                                setModuleModalOpen(true);
                              }}
                              className="flex items-center gap-1 bg-[#0066cc] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#0066cc]/95 transition-all text-[11px] font-bold shadow-sm"
                            >
                              <Plus size={13} /> Create Module
                            </button>
                          </div>

                          <div className="space-y-4">
                            {acadModules.length > 0 ? (
                              acadModules.map((mod) => (
                                <div key={mod.id} className="border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm bg-slate-50/20">
                                  {/* Module Header */}
                                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-[#d2d2d7]">
                                    <div className="min-w-0 pr-2">
                                      <p className="font-semibold text-xs text-[#1d1d1f] truncate">
                                        Module {mod.position}: {mod.title}
                                      </p>
                                      {mod.description && <p className="text-[10px] text-[#86868b] truncate mt-0.5">{mod.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => {
                                          setLessonSelectedModuleId(mod.id);
                                          setEditingLesson(null);
                                          const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                                          const defaultType = acadLookups.lessonTypes[0]?.id || "";
                                          setLessonForm({
                                            title: "",
                                            lesson_type_id: defaultType,
                                            content_text: "",
                                            video_url: "",
                                            duration: 15,
                                            position: (mod.lessons?.length || 0) + 1,
                                            is_preview: false,
                                            status_id: activeStatus
                                          });
                                          setLessonModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 bg-white border border-[#d2d2d7] hover:bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-[#1d1d1f] shadow-xs"
                                      >
                                        <Plus size={11} /> Add Lesson
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingModule(mod);
                                          setModuleForm({
                                            title: mod.title,
                                            description: mod.description || "",
                                            position: mod.position,
                                            status_id: mod.status_id
                                          });
                                          setModuleModalOpen(true);
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded text-[#86868b] hover:text-[#1d1d1f]"
                                      >
                                        <Edit size={12} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (confirm("Are you sure you want to delete this module?")) {
                                            const res = await deleteModuleAction(mod.id);
                                            if (res.error) setError(res.error);
                                            else {
                                              setSuccess("Module deleted successfully!");
                                              await refreshCourseDetails(acadSelectedCourse.id);
                                            }
                                          }
                                        }}
                                        className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Lessons under this module */}
                                  <div className="p-4 space-y-3">
                                    {mod.lessons && mod.lessons.length > 0 ? (
                                      mod.lessons.map((les: any) => (
                                        <div key={les.id} className="bg-white border border-[#d2d2d7] rounded-xl p-3.5 space-y-3 shadow-xs">
                                          <div className="flex items-start justify-between">
                                            <div className="min-w-0 pr-2">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-xs text-[#1d1d1f]">{les.title}</span>
                                                <span className="text-[9px] bg-slate-100 text-[#86868b] px-1.5 py-0.5 rounded font-bold font-mono">
                                                  {les.lesson_type?.code || "lesson"}
                                                </span>
                                                {les.is_preview && (
                                                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                                                    Preview
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[10px] text-[#86868b] mt-0.5 font-mono font-medium">
                                                Position: {les.position} • {les.duration || 0} mins
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                onClick={() => {
                                                  setResourceSelectedLessonId(les.id);
                                                  setResourceForm({
                                                    title: "",
                                                    resource_type: "link",
                                                    file_url: "",
                                                    external_url: "",
                                                    position: (les.resources?.length || 0) + 1
                                                  });
                                                  setResourceModalOpen(true);
                                                }}
                                                className="flex items-center gap-1 hover:bg-slate-100 text-[10px] text-[#0066cc] font-bold px-2 py-1 rounded"
                                              >
                                                <Link2 size={12} /> Resource
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingLesson(les);
                                                  setLessonSelectedModuleId(mod.id);
                                                  setLessonForm({
                                                    title: les.title,
                                                    lesson_type_id: les.lesson_type_id,
                                                    content_text: les.content_json?.body || les.content_json?.text || "",
                                                    video_url: les.video_url || "",
                                                    duration: les.duration || 0,
                                                    position: les.position || 1,
                                                    is_preview: les.is_preview || false,
                                                    status_id: les.status_id
                                                  });
                                                  setLessonModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-slate-200 rounded text-[#86868b] hover:text-[#1d1d1f]"
                                              >
                                                <Edit size={12} />
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (confirm("Are you sure you want to delete this lesson?")) {
                                                    const res = await deleteLessonAction(les.id);
                                                    if (res.error) setError(res.error);
                                                    else {
                                                      setSuccess("Lesson deleted successfully!");
                                                      await refreshCourseDetails(acadSelectedCourse.id);
                                                    }
                                                  }
                                                }}
                                                className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>

                                          {les.video_url && (
                                            <div className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#d2d2d7] mb-2">
                                              <Play size={10} className="fill-[#0066cc] text-[#0066cc] shrink-0" />
                                              <span className="font-semibold text-[#86868b]">Video Link:</span>
                                              <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-[#0066cc] font-bold flex-1">
                                                {les.video_url}
                                              </a>
                                            </div>
                                          )}

                                          {/* Lesson Resource list */}
                                          {les.resources && les.resources.length > 0 && (
                                            <div className="bg-slate-50/50 border border-[#d2d2d7] rounded-lg p-2 space-y-1.5">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] px-1">Attachments & External Resources</p>
                                              <div className="divide-y divide-[#d2d2d7] bg-white rounded-md border border-[#d2d2d7]">
                                                {les.resources.map((res: any) => (
                                                  <div key={res.id} className="px-2 py-1.5 flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <File size={12} className="text-[#86868b] shrink-0" />
                                                      <span className="font-semibold text-[#1d1d1f] truncate">{res.title}</span>
                                                      <span className="text-[9px] bg-slate-100 text-[#86868b] px-1 rounded-sm">{res.resource_type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                      {res.external_url && (
                                                        <a href={res.external_url} target="_blank" rel="noopener noreferrer" className="p-0.5 text-[#0066cc] hover:text-[#0066cc]/80">
                                                          <ExternalLink size={12} />
                                                        </a>
                                                      )}
                                                      <button
                                                        onClick={async () => {
                                                          if (confirm("Remove this resource attachment?")) {
                                                            const delRes = await deleteLessonResourceAction(res.id);
                                                            if (delRes.error) setError(delRes.error);
                                                            else {
                                                              setSuccess("Resource removed successfully!");
                                                              await refreshCourseDetails(acadSelectedCourse.id);
                                                            }
                                                          }
                                                        }}
                                                        className="p-0.5 text-red-500 hover:text-red-700"
                                                      >
                                                        <Trash2 size={12} />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[11px] text-[#86868b] text-center py-2 font-medium">No lessons created in this module.</p>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-[#86868b] text-center py-6 bg-slate-50/50 rounded-xl font-medium">No curriculum modules defined. Add a module to begin.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white border border-[#d2d2d7] rounded-xl p-12 text-center shadow-sm">
                        <Folder className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-xs text-[#86868b] font-medium">Select a Course on the left to start configuring its syllabus curriculum.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* MODALS */}
              
              {/* Program Modal */}
              {programModalOpen && (
                <div className="fixed inset-0 bg-[#1d1d1f]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white border border-[#d2d2d7] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm text-[#1d1d1f]">{editingProgram ? "Edit Academic Program" : "Create New Program"}</h3>
                    <form onSubmit={handleProgramSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Program Title *</label>
                        <input
                          type="text"
                          required
                          value={programForm.title}
                          onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                          placeholder="e.g. Full Stack Web Development"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">URL Slug (Unique per Tenant) *</label>
                        <input
                          type="text"
                          required
                          value={programForm.slug}
                          onChange={(e) => setProgramForm({ ...programForm, slug: e.target.value })}
                          placeholder="e.g. full-stack-dev"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Description</label>
                        <textarea
                          value={programForm.description}
                          onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                          placeholder="Provide a brief curriculum program overview..."
                          rows={3}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Status *</label>
                          <select
                            value={programForm.status_id}
                            onChange={(e) => setProgramForm({ ...programForm, status_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Visibility *</label>
                          <select
                            value={programForm.visibility_type_id}
                            onChange={(e) => setProgramForm({ ...programForm, visibility_type_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.visibilityTypes.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d2d2d7]">
                        <button
                          type="button"
                          onClick={() => setProgramModalOpen(false)}
                          className="bg-white border border-[#d2d2d7] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#0066cc] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save Program"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Course Modal */}
              {courseModalOpen && (
                <div className="fixed inset-0 bg-[#1d1d1f]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white border border-[#d2d2d7] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm text-[#1d1d1f]">{editingCourse ? "Edit Course" : "Create New Course"}</h3>
                    <form onSubmit={handleCourseSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Course Title *</label>
                        <input
                          type="text"
                          required
                          value={courseForm.title}
                          onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                          placeholder="e.g. Intro to React & Next.js"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">URL Slug (Unique per Tenant) *</label>
                        <input
                          type="text"
                          required
                          value={courseForm.slug}
                          onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                          placeholder="e.g. react-nextjs-intro"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Description</label>
                        <textarea
                          value={courseForm.description}
                          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                          placeholder="Provide a syllabus course description..."
                          rows={2}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Course Type *</label>
                          <select
                            value={courseForm.course_type_id}
                            onChange={(e) => setCourseForm({ ...courseForm, course_type_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.courseTypes.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Enrollment Mode *</label>
                          <select
                            value={courseForm.enrollment_mode}
                            onChange={(e) => setCourseForm({ ...courseForm, enrollment_mode: e.target.value as any })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            <option value="open">Open Access</option>
                            <option value="approval">Approval Required</option>
                            <option value="private">Private Access</option>
                            <option value="institution_only">Institution Members Only</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#86868b]">Duration (Mins)</label>
                          <input
                            type="number"
                            value={courseForm.duration_minutes}
                            onChange={(e) => setCourseForm({ ...courseForm, duration_minutes: Number(e.target.value) })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#86868b]">Status *</label>
                          <select
                            value={courseForm.status_id}
                            onChange={(e) => setCourseForm({ ...courseForm, status_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#86868b]">Visibility *</label>
                          <select
                            value={courseForm.visibility_type_id}
                            onChange={(e) => setCourseForm({ ...courseForm, visibility_type_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.visibilityTypes.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d2d2d7]">
                        <button
                          type="button"
                          onClick={() => setCourseModalOpen(false)}
                          className="bg-white border border-[#d2d2d7] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#0066cc] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save Course"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Module Modal */}
              {moduleModalOpen && (
                <div className="fixed inset-0 bg-[#1d1d1f]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white border border-[#d2d2d7] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm text-[#1d1d1f]">{editingModule ? "Edit Module" : "Create New Module"}</h3>
                    <form onSubmit={handleModuleSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Module Title *</label>
                        <input
                          type="text"
                          required
                          value={moduleForm.title}
                          onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                          placeholder="e.g. Getting Started with React"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Description</label>
                        <textarea
                          value={moduleForm.description}
                          onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                          placeholder="Module syllabus description..."
                          rows={2}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={moduleForm.position}
                            onChange={(e) => setModuleForm({ ...moduleForm, position: Number(e.target.value) })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Status *</label>
                          <select
                            value={moduleForm.status_id}
                            onChange={(e) => setModuleForm({ ...moduleForm, status_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d2d2d7]">
                        <button
                          type="button"
                          onClick={() => setModuleModalOpen(false)}
                          className="bg-white border border-[#d2d2d7] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#0066cc] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save Module"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Lesson Modal */}
              {lessonModalOpen && (
                <div className="fixed inset-0 bg-[#1d1d1f]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white border border-[#d2d2d7] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm text-[#1d1d1f]">{editingLesson ? "Edit Lesson" : "Create New Lesson"}</h3>
                    <form onSubmit={handleLessonSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Lesson Title *</label>
                        <input
                          type="text"
                          required
                          value={lessonForm.title}
                          onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                          placeholder="e.g. 1.1 Intro to Components"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Lesson Type *</label>
                          <select
                            value={lessonForm.lesson_type_id}
                            onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.lessonTypes.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Status *</label>
                          <select
                            value={lessonForm.status_id}
                            onChange={(e) => setLessonForm({ ...lessonForm, status_id: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#86868b]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={lessonForm.position}
                            onChange={(e) => setLessonForm({ ...lessonForm, position: Number(e.target.value) })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#86868b]">Duration (Mins) *</label>
                          <input
                            type="number"
                            required
                            value={lessonForm.duration}
                            onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                        <div className="col-span-1 flex items-center pt-5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lessonForm.is_preview}
                              onChange={(e) => setLessonForm({ ...lessonForm, is_preview: e.target.checked })}
                              className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]"
                            />
                            <span className="font-semibold text-[#86868b]">Is Preview?</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Video Lecture URL</label>
                        <input
                          type="text"
                          value={lessonForm.video_url}
                          onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                          placeholder="e.g. https://youtube.com/... or Vimeo"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Learning Content (Markdown / Text) *</label>
                        <textarea
                          placeholder="Enter lesson markdown or text content here..."
                          value={lessonForm.content_text}
                          onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                          rows={6}
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f] resize-y"
                          required
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d2d2d7]">
                        <button
                          type="button"
                          onClick={() => setLessonModalOpen(false)}
                          className="bg-white border border-[#d2d2d7] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#0066cc] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save Lesson"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Resource Attachment Modal */}
              {resourceModalOpen && (
                <div className="fixed inset-0 bg-[#1d1d1f]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white border border-[#d2d2d7] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm text-[#1d1d1f]">Attach Lesson Resource</h3>
                    <form onSubmit={handleResourceSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#86868b]">Resource Title *</label>
                        <input
                          type="text"
                          required
                          value={resourceForm.title}
                          onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                          placeholder="e.g. Component Cheatsheet PDF"
                          className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Resource Type *</label>
                          <select
                            value={resourceForm.resource_type}
                            onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          >
                            <option value="link">External URL Link</option>
                            <option value="file">File Attachment</option>
                            <option value="pdf">PDF Document</option>
                            <option value="video">Reference Video</option>
                            <option value="code">Source Code Repository</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={resourceForm.position}
                            onChange={(e) => setResourceForm({ ...resourceForm, position: Number(e.target.value) })}
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                      </div>
                      {resourceForm.resource_type === "file" || resourceForm.resource_type === "pdf" ? (
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">File URL *</label>
                          <input
                            type="text"
                            required
                            value={resourceForm.file_url}
                            onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                            placeholder="e.g. https://storage.hynox.com/file.pdf"
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block font-semibold mb-1 text-[#86868b]">External URL *</label>
                          <input
                            type="text"
                            required
                            value={resourceForm.external_url}
                            onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                            placeholder="e.g. https://github.com/... or external link"
                            className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0066cc] shadow-sm text-[#1d1d1f]"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d2d2d7]">
                        <button
                          type="button"
                          onClick={() => setResourceModalOpen(false)}
                          className="bg-white border border-[#d2d2d7] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#0066cc] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#0066cc]/95 disabled:opacity-50"
                        >
                          {loading ? "Adding..." : "Add Resource"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Looped Animated Brand Footer */}
      <div className="border-t border-[#d2d2d7]/30 bg-white py-8 text-center select-none shadow-sm flex-shrink-0 mt-auto w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .apple-shimmer-text {
            background: linear-gradient(90deg, #1d1d1f 20%, #0066cc 50%, #1d1d1f 80%);
            background-size: 200% auto;
            color: transparent;
            -webkit-background-clip: text;
            background-clip: text;
            animation: shimmer 4s linear infinite;
          }
        `}} />
        <h1 className="apple-shimmer-text text-xl md:text-2xl font-extrabold tracking-tight font-sans title-font">
          Hynox Campus
        </h1>
        <p className="text-[8px] text-[#86868b] mt-1 font-semibold tracking-wider uppercase">
          Administrative Command Center
        </p>
      </div>

      {renderUserDetailDrawer()}
      {renderTeacherDetailDrawer()}

    </div>
  );
}
