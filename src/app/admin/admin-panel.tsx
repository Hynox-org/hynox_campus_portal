"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrograms, useTenantInstructors, useCourses, useCourseModules, useCourseInstructors, useAcademicLookups } from "@/hooks/use-academics";
import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useAcademicPrefetchData } from "@/hooks/use-academics";
import { seedAcademicListCaches } from "@/lib/dashboard-query";
import { useToast } from "@/components/toast";
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
  onboardSuperAdminAction,
  updateInstitutionAction,
  getInstitutionRelationsCountAction,
  deleteInstitutionAction,
  deleteUserAction
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
import {
  listTeacherCohortsAction,
  assignTeacherToCohortAction,
  removeTeacherFromCohortAction,
  listCohortsAction,
  listAllCohortsAction
} from "@/app/actions/delivery-actions";
import * as XLSX from "xlsx";
import { 
  Building, 
  UserPlus, 
  FileSpreadsheet, 
  LogOut, 
  Plus,
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
  Play,
  Layers
} from "lucide-react";
import LibraryBuilder from "./library-builder";
import ProgramManager from "./program-manager";
import DeliveryManager from "./delivery-manager";
import LearningManager from "./learning-manager";
import AdminStudentProgress from "./student-progress";
import AttendanceModule from "@/components/attendance-register/attendance-module";

import { useAdminData } from "@/hooks/use-admin";
import { DashboardLoader } from "@/components/dashboard-loader";
import { SecondaryLoader } from "@/components/secondary-loader";
import { CustomSelect } from "@/components/custom-select";
import AppShell, { ShellNavItem } from "@/components/app-shell";

const ADMIN_NAV_ITEMS: ShellNavItem[] = [
  {
    id: "institutions",
    label: "Institutions",
    icon: Building,
    children: [
      { id: "institutions", label: "List Institutions" },
      { id: "add_institution", label: "Add Institution" },
      { id: "explorer", label: "Institution Space" },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: UserCheck,
    children: [
      { id: "onboarding", label: "Onboarding Status" },
      { id: "csv", label: "CSV Onboarding" },
      { id: "teacher_mapping", label: "Teacher Onboarding" },
      { id: "teacher_assignments", label: "Teacher Assignments" },
      { id: "super_admin_invite", label: "Super Admin Onboarding" },
    ],
  },
  {
    id: "library",
    label: "Library",
    icon: BookOpen,
    children: [{ id: "library", label: "Course Blueprints" }],
  },
  {
    id: "programs",
    label: "Batches & Academics",
    icon: GraduationCap,
    children: [
      { id: "examine_programs", label: "Batches Explorer" },
      { id: "cohorts", label: "Groups & Delivery" },
      { id: "program_student_progress", label: "Student Progress" },
    ],
  },
  {
    id: "learning_manager",
    label: "Learning Activities",
    icon: Award,
    children: [
      { id: "create_activity", label: "Create Activity" },
      { id: "view_activities", label: "Published Activities" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: UserCheck,
    children: [{ id: "attendance", label: "Attendance Register" }],
  },
];

const ADMIN_PAGE_TITLES: Record<string, string> = {
  institutions: "Registered Institutions",
  add_institution: "Add Institution",
  explorer: "Institution Space",
  onboarding: "Onboarding Status",
  csv: "CSV Onboarding",
  teacher_mapping: "Teacher Onboarding",
  teacher_assignments: "Teacher Assignments",
  super_admin_invite: "Super Admin Onboarding",
  library: "Course Blueprints",
  examine_programs: "Batches Explorer",
  cohorts: "Groups & Delivery",
  enrollments: "Groups & Delivery",
  course_assignments: "Groups & Delivery",
  program_student_progress: "Student Progress",
  create_activity: "Create Activity",
  view_activities: "Published Activities",
  attendance: "Attendance Register",
};

interface AdminPanelProps {
  adminEmail: string;
}

export default function AdminPanel({ adminEmail }: AdminPanelProps) {
  const queryClient = useQueryClient();
  
  const { data: adminData, isLoading: loadingAdmin, error: adminError } = useAdminData();
  
  const [showPreviewLoader, setShowPreviewLoader] = useState(false);
  const [showSecondaryPreview, setShowSecondaryPreview] = useState(false);

  const [activeParentTab, setActiveParentTab] = useState<"institutions" | "onboarding" | "library" | "programs" | "learning_manager" | "attendance">("institutions");
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<"institutions" | "add_institution" | "explorer" | "csv" | "onboarding" | "academics" | "library" | "programs" | "examine_programs" | "cohorts" | "enrollments" | "course_assignments" | "learning_manager" | "create_activity" | "view_activities" | "teacher_mapping" | "teacher_assignments" | "program_student_progress" | "super_admin_invite" | "attendance">("institutions");

  // Sync state with URL params after hydration on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const parent = params.get("parentTab");
      if (parent && ["institutions", "onboarding", "library", "programs", "learning_manager", "attendance"].includes(parent)) {
        setActiveParentTab(parent as any);
      }
      const tab = params.get("tab");
      const validTabs = ["institutions", "add_institution", "explorer", "csv", "onboarding", "academics", "library", "programs", "examine_programs", "cohorts", "enrollments", "course_assignments", "learning_manager", "create_activity", "view_activities", "teacher_mapping", "teacher_assignments", "program_student_progress", "super_admin_invite", "attendance"];
      if (tab && validTabs.includes(tab)) {
        setActiveTab(tab as any);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("parentTab") !== activeParentTab || params.get("tab") !== activeTab) {
        params.set("parentTab", activeParentTab);
        params.set("tab", activeTab);
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? "?" + newSearch : ""}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [activeParentTab, activeTab]);
  
  // Use data from hook as initial state or direct derivation
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    if (adminData) {
      setInstitutions(adminData.institutions || []);
      setInvitations(adminData.invitations || []);
    }
  }, [adminData]);

  // Sidebar for Institution Details
  const [selectedInstForSidebar, setSelectedInstForSidebar] = useState<any | null>(null);
  const [isInstSidebarOpen, setIsInstSidebarOpen] = useState(false);
  const [isEditingInst, setIsEditingInst] = useState(false);
  
  // Editing Form State (for sidebar)
  const [editInstForm, setEditInstForm] = useState({
    name: "",
    institution_code: "",
    institution_type: "college",
    email: "",
    phone: "",
    address: "",
    website: "",
    status: "onboarding"
  });

  // Deletion warnings and confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [instToDelete, setInstToDelete] = useState<any | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [relationCounts, setRelationCounts] = useState<{ cohorts: number; programs: number; users: number } | null>(null);
  const [checkingRelations, setCheckingRelations] = useState(false);

  // User deletion states
  const [isUserDeleteModalOpen, setIsUserDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string; callback: () => void } | null>(null);
  const [userDeleteConfirmEmail, setUserDeleteConfirmEmail] = useState("");
  const [userDeleteLoading, setUserDeleteLoading] = useState(false);

  const handleOpenSidebar = (inst: any) => {
    setSelectedInstForSidebar(inst);
    setEditInstForm({
      name: inst.name || "",
      institution_code: inst.institution_code || "",
      institution_type: inst.institution_type || "college",
      email: inst.email || "",
      phone: inst.phone || "",
      address: inst.address || "",
      website: inst.website || "",
      status: inst.status || "onboarding"
    });
    setIsEditingInst(false);
    setIsInstSidebarOpen(true);
  };

  const handleSaveEditInst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForSidebar) return;
    setLoading(true);

    const res = await updateInstitutionAction(selectedInstForSidebar.id, editInstForm);
    if (res.error) {
      showError(res.error);
    } else if (res.institution) {
      showSuccess(`Institution updated successfully!`);
      setInstitutions(prev => prev.map(i => i.id === selectedInstForSidebar.id ? res.institution : i));
      setSelectedInstForSidebar(res.institution);
      setIsEditingInst(false);
    }
    setLoading(false);
  };

  const handleOpenDeleteModal = async (inst: any) => {
    setInstToDelete(inst);
    setDeleteConfirmName("");
    setCheckingRelations(true);
    setIsDeleteModalOpen(true);
    try {
      const res = await getInstitutionRelationsCountAction(inst.id);
      if (res.success && res.counts) {
        setRelationCounts(res.counts);
      } else {
        setRelationCounts({ cohorts: 0, programs: 0, users: 0 });
      }
    } catch (err) {
      setRelationCounts({ cohorts: 0, programs: 0, users: 0 });
    }
    setCheckingRelations(false);
  };

  const handleConfirmDelete = async () => {
    if (!instToDelete) return;
    if (deleteConfirmName !== instToDelete.name) {
      showError("Name does not match.");
      return;
    }
    setLoading(true);
    const res = await deleteInstitutionAction(instToDelete.id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`Institution '${instToDelete.name}' successfully deleted.`);
      setInstitutions(prev => prev.filter(i => i.id !== instToDelete.id));
      setIsDeleteModalOpen(false);
      setInstToDelete(null);
      setIsInstSidebarOpen(false);
    }
    setLoading(false);
  };

  const handleConfirmUserDelete = async () => {
    if (!userToDelete) return;
    if (userDeleteConfirmEmail.trim() !== userToDelete.email) {
      showError("Email does not match.");
      return;
    }
    setUserDeleteLoading(true);
    const res = await deleteUserAction(userToDelete.id);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`User successfully deleted.`);
      userToDelete.callback();
      setIsUserDeleteModalOpen(false);
      setUserToDelete(null);
      setUserDeleteConfirmEmail("");
    }
    setUserDeleteLoading(false);
  };

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
  const [systemCohorts, setSystemCohorts] = useState<any[]>([]);
  
  // Teacher Onboarding Form States
  const [teacherOnboardName, setTeacherOnboardName] = useState("");
  const [teacherOnboardEmail, setTeacherOnboardEmail] = useState("");
  const [teacherOnboardLoading, setTeacherOnboardLoading] = useState(false);

  const handleSelectInstitutionForExplorer = async (instId: string) => {
    setExplorerSelectedId(instId);
    if (!instId) {
      setExplorerUsers([]);
      return;
    }
    setExplorerLoading(true);
    const res = await listInstitutionUsersAction(instId);
    if (res.error) {
      showError(res.error);
      setExplorerUsers([]);
    } else if (res.users) {
      setExplorerUsers(res.users);
    }
    setExplorerLoading(false);
  };

  const handleRegenerateInvite = async (invitationId: string) => {
    setRegeneratingId(invitationId);
    
    const res = await regenerateInvitationAction(invitationId);
    if (res.error) {
      showError(res.error);
    } else if (res.invitation) {
      showSuccess(`Successfully regenerated invitation token!`);
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
    const filteredInvs = invitations.filter((inv) =>
      ["student_onboarding", "institution_admin_invite"].includes(inv.invitation_type)
    );
    let total = filteredInvs.length;
    let accepted = 0;
    let pending = 0;
    let expired = 0;
    let failed = 0;
    let revoked = 0;

    const now = new Date();

    filteredInvs.forEach((inv) => {
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
      // 0. Only Student Onboarding and Institution Admin Onboarding
      if (!["student_onboarding", "institution_admin_invite"].includes(inv.invitation_type)) {
        return false;
      }

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
  const { showSuccess, showError } = useToast();
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
  const [instFormErrors, setInstFormErrors] = useState<Record<string, string>>({});

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
  const { data: academicPrefetch } = useAcademicPrefetchData(acadSelectedInstId);
  const { data: acadPrograms = [] } = usePrograms(acadSelectedInstId);
  const [acadSelectedProgram, setAcadSelectedProgram] = useState<any | null>(null);
  const { data: acadCourses = [] } = useCourses(acadSelectedProgram?.id);
  const [acadSelectedCourse, setAcadSelectedCourse] = useState<any | null>(null);
  const { data: acadModules = [] } = useCourseModules(acadSelectedCourse?.id);
  const { data: acadInstructors = [] } = useCourseInstructors(acadSelectedCourse?.id);
  
  const setAcadInstructors = (newInstructors: any[]) => {
    if (acadSelectedCourse?.id) {
      queryClient.setQueryData(["course-instructors", acadSelectedCourse.id], newInstructors);
    }
  };

  const { data: acadTenantTeachers = [] } = useTenantInstructors(acadSelectedInstId);
  
  // Lookup states
  const { data: acadLookups = { courseTypes: [], lessonTypes: [], statuses: [], visibilityTypes: [] } } = useAcademicLookups();

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
    const [tRes, cRes] = await Promise.all([
      listAllTeachersAction(),
      listAllCohortsAction()
    ]);
    if (tRes.teachers) {
      setTeachersList(tRes.teachers);
    } else if (tRes.error) {
      showError(tRes.error);
    }
    if (cRes.cohorts) {
      setSystemCohorts(cRes.cohorts);
    }
    setLoadingTeachers(false);
  };

  const handleMapTeacher = async (userId: string, cohortId: string) => {
    if (!cohortId) {
      showError("Please select a target group.");
      return;
    }
    setLoadingTeachers(true);
    const res = await assignTeacherToCohortAction(cohortId, userId);
    if (res.success) {
      showSuccess("Teacher assigned to group successfully!");
      const freshCohorts = await listTeacherCohortsAction(userId, false);
      if (freshCohorts.cohorts) {
        setTeacherInstDetails(freshCohorts.cohorts);
      }
    } else {
      showError(res.error || "Failed to assign teacher to group.");
    }
    setLoadingTeachers(false);
  };

  const handleUnmapTeacher = async (userId: string, cohortId: string) => {
    if (!confirm("Are you sure you want to remove this group mapping?")) {
      return;
    }
    setLoadingTeachers(true);
    const res = await removeTeacherFromCohortAction(cohortId, userId);
    if (res.success) {
      showSuccess("Teacher removed from group successfully!");
      const freshCohorts = await listTeacherCohortsAction(userId, false);
      if (freshCohorts.cohorts) {
        setTeacherInstDetails(freshCohorts.cohorts);
      }
    } else {
      showError(res.error || "Failed to remove teacher from group.");
    }
    setLoadingTeachers(false);
  };

  const loadTeacherDetailsData = async (teacher: any) => {
    setSelectedTeacherForDetail(teacher);
    setMappingInstId(""); // Reset mapping selection when loading a teacher
    setTeacherDetailsLoading(true);
    setTeacherInstDetails([]);
    const res = await listTeacherCohortsAction(teacher.id, false);
    if (res.cohorts) {
      setTeacherInstDetails(res.cohorts);
    } else if (res.error) {
      showError(res.error);
    }
    setTeacherDetailsLoading(false);
  };

  React.useEffect(() => {
    if (activeTab === "teacher_mapping" || activeTab === "teacher_assignments") {
      loadAllTeachersData();
    }
  }, [activeTab]);

  // Data fetching is now handled by React Query hooks (usePrograms, useCourses, etc.)

  useEffect(() => {
    if (!acadSelectedInstId) return;
    
    if (academicPrefetch?.success) {
      seedAcademicListCaches(queryClient, acadSelectedInstId, academicPrefetch);
    }
  }, [acadSelectedInstId, academicPrefetch, queryClient]);
  const refreshCourseDetails = async (courseId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["academic-prefetch", acadSelectedInstId] }),
    ]);
  };

  const refreshPrograms = async () => {
    if (!acadSelectedInstId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["programs", acadSelectedInstId] }),
      queryClient.invalidateQueries({ queryKey: ["academic-prefetch", acadSelectedInstId] }),
    ]);
  };

  const refreshCourses = async () => {
    if (!acadSelectedProgram) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["courses", acadSelectedProgram.id] }),
      queryClient.invalidateQueries({ queryKey: ["academic-prefetch", acadSelectedInstId] }),
    ]);
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
      showError(res.error);
    } else {
      showSuccess(`Program saved successfully!`);
      setProgramModalOpen(false);
      setEditingProgram(null);
      await refreshPrograms();
    }
    setLoading(false);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
      showError(res.error);
    } else {
      showSuccess(`Course saved successfully!`);
      setCourseModalOpen(false);
      setEditingCourse(null);
      await refreshCourses();
    }
    setLoading(false);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
      showError(res.error);
    } else {
      showSuccess(`Module saved successfully!`);
      setModuleModalOpen(false);
      setEditingModule(null);
      await refreshCourseDetails(acadSelectedCourse.id);
    }
    setLoading(false);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        status_id: lessonForm.status_id,
        tenant_id: acadSelectedInstId,
        institution_id: acadSelectedInstId
      });
    }

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`Lesson saved successfully!`);
      setLessonModalOpen(false);
      setEditingLesson(null);
      await refreshCourseDetails(acadSelectedCourse.id);
    }
    setLoading(false);
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
      showError(res.error);
    } else {
      showSuccess(`Resource added successfully!`);
      setResourceModalOpen(false);
      await refreshCourseDetails(acadSelectedCourse.id);
    }
    setLoading(false);
  };

  const handleSaveInstructors = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const instructorIds = acadInstructors.map(i => i.user_id);
    const res = await assignCourseInstructorsAction(acadSelectedCourse.id, instructorIds);

    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`Instructors assigned successfully!`);
    }
    setLoading(false);
  };

  const clearStatuses = () => {
    setLinks([]);
    setUploadedFileName("");
  };

  const validateInstForm = () => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9+()\-\s]{7,20}$/;

    if (!instName.trim() || instName.trim().length < 2) {
      errors.name = "Institution name is required (min 2 characters).";
    }
    if (!instCode.trim()) {
      errors.code = "Institution code is required.";
    }
    if (!instEmail.trim()) {
      errors.email = "Contact email is required.";
    } else if (!emailRegex.test(instEmail.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (instPhone.trim() && !phoneRegex.test(instPhone.trim())) {
      errors.phone = "Enter a valid phone number.";
    }

    setInstFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInstForm()) {
      return;
    }
    setLoading(true);
    clearStatuses();

    const formData = new FormData();
    formData.append("name", instName);
    formData.append("code", instCode);
    formData.append("type", instType);
    formData.append("email", instEmail);
    formData.append("phone", instPhone);
    formData.append("address", instAddress);
    formData.append("website", instWebsite);

    const res = await createNewInstitutionAction(formData);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`Institution '${instName}' successfully registered!`);
      // Update local state list
      setInstitutions([res.institution, ...institutions]);
      if (!selectedInstId) {
        setSelectedInstId(res.institution.id);
      }
      // Reset form
      setInstName("");
      setInstCode("");
      setInstEmail("");
      setInstPhone("");
      setInstAddress("");
      setInstWebsite("");
      setInstFormErrors({});
    }
    setLoading(false);
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!selectedInstId) {
      showError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    const res = await assignAdminAction(selectedInstId, adminEmailInput);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`User '${adminEmailInput}' successfully assigned as administrator.`);
      setAdminEmailInput("");
    }
    setLoading(false);
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!selectedInstId) {
      showError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    if (!csvContent.trim()) {
      showError("Please paste CSV contents.");
      setLoading(false);
      return;
    }

    const res = await uploadCsvOnboardingAction(selectedInstId, csvContent);
    if (res.error) {
      showError(res.error);
    } else if (res.results) {
      setLinks(res.results);
      const errors = res.results.filter((r: any) => r.status === "error");
      const successes = res.results.filter((r: any) => r.status === "success");
      
      showSuccess(`Processed CSV: ${successes.length} provisioned successfully, ${errors.length} errors.`);
      
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

    const isTeacher = singleRole === "teacher";
    if (!isTeacher && !selectedInstId) {
      showError("Please select or create an institution first.");
      setLoading(false);
      return;
    }

    if (!singleName.trim() || !singleEmail.trim()) {
      showError("Full Name and Email are required.");
      setLoading(false);
      return;
    }

    const res = await onboardSingleUserAction({
      email: singleEmail,
      name: singleName,
      role: singleRole,
      institutionId: isTeacher ? undefined : selectedInstId,
    });

    if (res.error) {
      showError(res.error);
    } else if (res.result) {
      setLinks([res.result]);
      if (res.result.status === "success") {
        showSuccess(`Successfully invited '${singleEmail}'!`);
        setSingleName("");
        setSingleEmail("");
        
        const freshInvites = await listInvitationsAction();
        if (freshInvites.invitations) {
          setInvitations(freshInvites.invitations);
        }
      } else {
        showError(res.result.error || "Failed to onboard user.");
      }
    }
    setLoading(false);
  };

  const handleTeacherOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherOnboardName.trim() || !teacherOnboardEmail.trim()) {
      showError("Name and Email are required.");
      return;
    }
    setTeacherOnboardLoading(true);
    const res = await onboardSingleUserAction({
      email: teacherOnboardEmail,
      name: teacherOnboardName,
      role: "teacher",
      institutionId: undefined
    });
    setTeacherOnboardLoading(false);
    if (res.error) {
      showError(res.error);
    } else if (res.result) {
      if (res.result.status === "success") {
        showSuccess(`Successfully onboarded and invited teacher '${teacherOnboardEmail}'!`);
        setTeacherOnboardName("");
        setTeacherOnboardEmail("");
        loadAllTeachersData();
        const freshInvites = await listInvitationsAction();
        if (freshInvites.invitations) {
          setInvitations(freshInvites.invitations);
        }
      } else {
        showError(res.result.error || "Failed to onboard teacher.");
      }
    }
  };

  const handleSuperAdminOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearStatuses();

    if (!superAdminName.trim() || !superAdminEmail.trim()) {
      showError("Full Name and Email are required.");
      setLoading(false);
      return;
    }

    const res = await onboardSuperAdminAction({
      email: superAdminEmail,
      name: superAdminName,
    });

    if (res.error) {
      showError(res.error);
    } else if (res.result) {
      setLinks([res.result]);
      if (res.result.status === "success") {
        showSuccess(`Successfully invited Super Admin '${superAdminEmail}'!`);
        setSuperAdminName("");
        setSuperAdminEmail("");
        
        const freshInvites = await listInvitationsAction();
        if (freshInvites.invitations) {
          setInvitations(freshInvites.invitations);
        }
      } else {
        showError(res.result.error || "Failed to generate invitation.");
      }
    }
    setLoading(false);
  };

  const downloadTemplateExcel = () => {
    if (!selectedInstId) {
      showError("Please select a default institution first.");
      return;
    }
    const inst = institutions.find((i) => i.id === selectedInstId);
    const code = inst ? inst.institution_code : "campus";

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
      XLSX.writeFile(workbook, `hynox_student_onboarding_${code}.xlsx`);
      showSuccess("Excel template generated successfully!");
    } catch (err: any) {
      showError(`Failed to generate Excel template: ${err.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);

    const reader = new FileReader();

    if (file.name.endsWith(".csv")) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
        showSuccess(`Loaded CSV file: ${file.name}`);
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
          showSuccess(`Successfully parsed and loaded Excel file: ${file.name}`);
        } catch (err: any) {
          showError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Onboarding link copied to clipboard!");
  };

  const renderUserDetailDrawer = () => {
    if (!selectedUserDetail) return null;

    return (
      <div className="fixed inset-0 bg-[#23252D]/30 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedUserDetail(null)} />
        <div className="relative w-full max-w-md bg-[#131418] h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden border-l border-[#23252C]">
          <div className="p-6 border-b border-[#23252C] flex justify-between items-start gap-4 bg-[#16171D]">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-[#6E79F4] text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-[#6E79F4]/10">
                {(selectedUserDetail.full_name || selectedUserDetail.email || "U").substring(0, 2)}
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#EDEFF5]">{selectedUserDetail.full_name || "User Details"}</h3>
                <p className="text-[10px] text-[#C2C6D1] font-medium mt-0.5">{selectedUserDetail.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20">
                    {selectedUserDetail.roles?.join(", ") || "No roles"}
                  </span>
                  <span className="text-[9px] text-[#C2C6D1] font-medium">• Joined {new Date(selectedUserDetail.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedUserDetail(null)}
              className="p-1 hover:bg-[#23252C] rounded-lg transition-all border border-transparent hover:border-[#23252C] cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#C2C6D1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 space-y-3 shadow-sm">
              <h4 className="text-[10px] font-bold text-[#EDEFF5] uppercase tracking-wider pb-2 border-b border-[#23252C]">
                Campus Profile Metadata
              </h4>
              <div className="divide-y divide-[#23252C]/50 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#C2C6D1] font-medium">Full Name</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedUserDetail.full_name || "N/A"}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#C2C6D1] font-medium">Email Address</span>
                  <span className="font-semibold text-[#EDEFF5]">{selectedUserDetail.email}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#C2C6D1] font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    selectedUserDetail.status === "active"
                      ? "bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20"
                      : selectedUserDetail.status === "invited" || selectedUserDetail.status === "pending_activation"
                      ? "bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20"
                      : "bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20"
                  }`}>
                    {selectedUserDetail.status}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#C2C6D1] font-medium">Profile ID</span>
                  <span className="font-mono text-[10px] text-[#C2C6D1] select-all">{selectedUserDetail.id}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#C2C6D1] font-medium">Created On</span>
                  <span className="font-semibold text-[#EDEFF5]">{new Date(selectedUserDetail.created_at).toLocaleString()}</span>
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
      <div className="fixed inset-0 bg-[#23252D]/30 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedTeacherForDetail(null)} />
        <div className="relative w-full max-w-lg bg-[#131418] h-full shadow-2xl flex flex-col z-50 animate-slideOver overflow-hidden border-l border-[#23252C]">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#23252C] flex justify-between items-start gap-4 bg-[#16171D] shrink-0">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-[#6E79F4] text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-[#6E79F4]/10">
                {(selectedTeacherForDetail.full_name || selectedTeacherForDetail.email || "T").substring(0, 2)}
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#EDEFF5]">{selectedTeacherForDetail.full_name || "Teacher Profile"}</h3>
                <p className="text-[10px] text-[#C2C6D1] font-medium mt-0.5">{selectedTeacherForDetail.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20 uppercase">
                    Teacher / Trainer
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedTeacherForDetail(null)}
              className="p-1 hover:bg-[#23252C] rounded-lg transition-all border border-transparent hover:border-[#23252C] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-[#1A1C22] border border-[#23252C] p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#C2C6D1] font-medium">Teacher ID:</span>
                <span className="font-mono text-[#EDEFF5] select-all">{selectedTeacherForDetail.id}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-[#EDEFF5] uppercase tracking-wider pb-2 border-b border-[#23252C]">
                Assigned Groups
              </h4>

              {teacherDetailsLoading ? (
                <SecondaryLoader variant="skeleton" message="Loading group assignments..." className="!border-0 !p-0 shadow-none" />
              ) : teacherInstDetails.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#C2C6D1] border border-dashed border-[#23252C] rounded-xl">
                  No group assignments found.
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherInstDetails.map((cohort: any) => (
                    <div key={cohort.id} className="border border-[#23252C] rounded-xl p-4 bg-[#131418] shadow-sm flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-bold text-[#EDEFF5]">
                          {cohort.name} ({cohort.code})
                        </h5>
                        <p className="text-[10px] text-[#C2C6D1] mt-0.5">
                          Institution: {cohort.institution?.name || "Global / Internal"}
                        </p>
                      </div>
                      
                      <button
                        onClick={async () => {
                          await handleUnmapTeacher(selectedTeacherForDetail.id, cohort.id);
                          loadTeacherDetailsData(selectedTeacherForDetail);
                        }}
                        className="text-[10px] text-red-500 font-bold hover:underline"
                      >
                        Remove Group
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign Additional Group */}
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm space-y-3">
              <h5 className="text-[11px] font-bold text-[#EDEFF5] uppercase tracking-wider">
                Assign Additional Group
              </h5>
              <p className="text-[10px] text-[#C2C6D1] font-medium leading-relaxed">
                Map this teacher/trainer to an active group. They will be able to mark student attendance and access assigned courses under that group.
              </p>
              <div className="flex flex-col gap-3 pt-1">
                <div className="relative">
                  <select
                    value={mappingInstId}
                    onChange={(e) => setMappingInstId(e.target.value)}
                    className="w-full bg-[#1A1C22] border border-[#23252C] hover:border-[#9BA1AE] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#EDEFF5] focus:outline-none focus:ring-2 focus:ring-[#6E79F4]/10 focus:border-[#6E79F4] transition-all appearance-none cursor-pointer pr-10"
                  >
                    <option value="">Choose group...</option>
                    {systemCohorts.map(cohort => {
                      const isAssigned = teacherInstDetails.some(c => c.id === cohort.id);
                      return (
                        <option key={cohort.id} value={cohort.id} disabled={isAssigned} className="text-[#EDEFF5]">
                          {cohort.name} ({cohort.code}) - {cohort.institution?.name || "Global"} {isAssigned ? "(Already Assigned)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-[#C2C6D1]">
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
                      ? "bg-[#6E79F4] text-white hover:bg-[#6E79F4]/95 shadow-sm active:scale-[0.98]"
                      : "bg-[#1A1C22] text-[#A3A9B6] border border-[#23252C] cursor-not-allowed"
                  }`}
                >
                  {loadingTeachers ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Assign Group
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedTeacherForDetail(null)}
              className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold text-xs py-2 px-5 rounded-xl transition-all"
            >
              Close Details
            </button>
          </div>

        </div>
      </div>
    );
  };

  const institutionColumns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          onClick={() => handleOpenSidebar(row.original)}
          className="font-semibold text-[#6E79F4] hover:underline text-left cursor-pointer transition-all"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "institution_code",
      header: "Code",
      cell: ({ row }) => <span className="text-[#C2C6D1] font-mono">{row.original.institution_code}</span>,
    },
    {
      accessorKey: "institution_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.institution_type;
        return (
          <span className="text-[#C2C6D1] font-medium capitalize">
            {type === "college" ? "College" : type === "school" ? "School" : "Others"}
          </span>
        );
      },
    },
  ], []);

  if (adminError) {
    return <div role="alert" className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load the admin dashboard. {adminError.message}</div>;
  }

  return (
    <>
      <DashboardLoader loading={loadingAdmin} message="Setting up your Super Admin environment..." />
      <AppShell
        portalLabel="Admin Console"
        pageTitle={ADMIN_PAGE_TITLES[activeTab] ?? "Super Admin"}
        items={ADMIN_NAV_ITEMS}
        activeId={activeParentTab}
        activeChildId={activeTab}
        onSelect={(id, childId) => {
          setActiveParentTab(id as typeof activeParentTab);
          const parentItem = ADMIN_NAV_ITEMS.find((item) => item.id === id);
          const defaultChildId = parentItem?.children?.[0]?.id;
          setActiveTab((childId ?? defaultChildId ?? id) as typeof activeTab);
        }}
        userName={adminEmail}
        userMeta="Super Admin"
      >

      {/* Conditionally render the Dashboard Loader for verification in Admin Panel */}
      {showPreviewLoader && (
        <DashboardLoader loading={showPreviewLoader} message="Testing initial loader cache sequence..." />
      )}

      {showSecondaryPreview && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 w-full animate-fadeIn">
          <div className="bg-[#131418] border border-[#23252C] p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#EDEFF5]">Secondary Loader Preview</h3>
                <p className="text-xs text-[#C2C6D1]">Verify the card, skeleton list, and grid loader variants used for data fetching inside panels.</p>
              </div>
              <button 
                onClick={() => setShowSecondaryPreview(false)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Dismiss Preview
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Spinner variant */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">1. Card Spinner</span>
                <SecondaryLoader variant="spinner" message="Syncing data blocks..." />
              </div>
              
              {/* Skeleton List Variant */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">2. Row List Skeleton</span>
                <SecondaryLoader variant="skeleton" />
              </div>
              
              {/* Skeleton Grid Variant */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">3. Grid Card Skeleton</span>
                <SecondaryLoader variant="skeleton-grid" className="!grid-cols-1 md:!grid-cols-1" />
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="flex flex-col gap-6">

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* TAB 1: INSTITUTIONS */}
          {activeTab === "institutions" && (
            <div className="space-y-6">

              {/* Institutions Listing Table */}
              <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm p-4">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-[#EDEFF5]">REGISTERED INSTITUTIONS</h4>
                </div>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <DataTable
                    columns={institutionColumns}
                    data={institutions}
                    searchKey="institutions"
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 1.5: REGISTER NEW INSTITUTION */}
          {activeTab === "add_institution" && (
            <div className="space-y-6">
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-[#C2C6D1] flex items-center gap-1.5">
                  <Plus size={14} /> Register New Campus Institution
                </h3>
                
                <form onSubmit={handleCreateInstitution} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Institution Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Stanford University"
                      value={instName}
                      onChange={(e) => {
                        setInstName(e.target.value);
                        if (instFormErrors.name) setInstFormErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      className={`w-full bg-[#131418] border rounded-lg px-3 py-2 text-xs focus:outline-none shadow-sm text-[#EDEFF5] ${instFormErrors.name ? "border-red-400 focus:border-red-500" : "border-[#23252C] focus:border-[#6E79F4]"}`}
                    />
                    {instFormErrors.name && <p className="mt-1 text-[10px] font-semibold text-red-600">{instFormErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Institution Code (Unique) *</label>
                    <input
                      type="text"
                      placeholder="e.g. SU-CAMPUS"
                      value={instCode}
                      onChange={(e) => {
                        setInstCode(e.target.value);
                        if (instFormErrors.code) setInstFormErrors((prev) => ({ ...prev, code: "" }));
                      }}
                      className={`w-full bg-[#131418] border rounded-lg px-3 py-2 text-xs focus:outline-none shadow-sm text-[#EDEFF5] ${instFormErrors.code ? "border-red-400 focus:border-red-500" : "border-[#23252C] focus:border-[#6E79F4]"}`}
                    />
                    {instFormErrors.code && <p className="mt-1 text-[10px] font-semibold text-red-600">{instFormErrors.code}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Category Type *</label>
                    <CustomSelect
                      options={[
                        { id: "college", name: "College" },
                        { id: "school", name: "School" },
                        { id: "others", name: "Others" },
                      ]}
                      value={instType}
                      onChange={setInstType}
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Contact Email *</label>
                    <input
                      type="email"
                      placeholder="admin@college.edu"
                      value={instEmail}
                      onChange={(e) => {
                        setInstEmail(e.target.value);
                        if (instFormErrors.email) setInstFormErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      className={`w-full bg-[#131418] border rounded-lg px-3 py-2 text-xs focus:outline-none shadow-sm text-[#EDEFF5] ${instFormErrors.email ? "border-red-400 focus:border-red-500" : "border-[#23252C] focus:border-[#6E79F4]"}`}
                    />
                    {instFormErrors.email && <p className="mt-1 text-[10px] font-semibold text-red-600">{instFormErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 019-2834"
                      value={instPhone}
                      onChange={(e) => {
                        setInstPhone(e.target.value);
                        if (instFormErrors.phone) setInstFormErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      className={`w-full bg-[#131418] border rounded-lg px-3 py-2 text-xs focus:outline-none shadow-sm text-[#EDEFF5] ${instFormErrors.phone ? "border-red-400 focus:border-red-500" : "border-[#23252C] focus:border-[#6E79F4]"}`}
                    />
                    {instFormErrors.phone && <p className="mt-1 text-[10px] font-semibold text-red-600">{instFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Website Address</label>
                    <input
                      type="text"
                      placeholder="https://college.edu"
                      value={instWebsite}
                      onChange={(e) => setInstWebsite(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Physical Address</label>
                    <textarea
                      placeholder="Street, City, State, ZIP"
                      value={instAddress}
                      onChange={(e) => setInstAddress(e.target.value)}
                      rows={2}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none text-[#EDEFF5]"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50 cursor-pointer"
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
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm">
                
                {/* Onboarding Mode Selection Toggle */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#23252C]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                    <UserPlus size={15} /> User Onboarding
                  </h3>
                  
                  <div className="flex bg-[#1A1C22] p-0.5 rounded-lg border border-[#23252C]">
                    <button
                      type="button"
                      onClick={() => {
                        setOnboardMode("single");
                        clearStatuses();
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        onboardMode === "single"
                          ? "bg-[#131418] text-[#6E79F4] shadow-sm border border-[#23252C]/30"
                          : "text-[#C2C6D1] hover:text-[#EDEFF5]"
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
                          ? "bg-[#131418] text-[#6E79F4] shadow-sm border border-[#23252C]/30"
                          : "text-[#C2C6D1] hover:text-[#EDEFF5]"
                      }`}
                    >
                      Bulk CSV Upload
                    </button>
                  </div>
                </div>

                {onboardMode === "single" ? (
                  // Single User Onboarding Form
                  <form onSubmit={handleSingleUserOnboard} className="space-y-4 text-xs">
                    <p className="text-xs text-[#C2C6D1] mb-2 leading-relaxed">
                      Onboard a single user instantly. Fill in their details below, select their role, and assign them to a school/college campus.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Campus / Institution *</label>
                        <CustomSelect
                          options={institutions}
                          value={selectedInstId}
                          onChange={(val) => setSelectedInstId(val)}
                          placeholder="-- Choose Institution or School --"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Assigned Role *</label>
                        <CustomSelect
                          options={[
                            { id: "student", name: "Student" },
                            { id: "institution_admin", name: "Institution Administrator" },
                          ]}
                          value={singleRole}
                          onChange={setSingleRole}
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Full Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={singleName}
                          onChange={(e) => setSingleName(e.target.value)}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Email Address *</label>
                        <input
                          type="email"
                          placeholder="e.g. john.doe@school.edu"
                          value={singleEmail}
                          onChange={(e) => setSingleEmail(e.target.value)}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading || !selectedInstId || !singleName.trim() || !singleEmail.trim()}
                        className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50"
                      >
                        {loading ? "Sending Invitation..." : "Onboard Single User"}
                      </button>
                    </div>
                  </form>
                ) : (
                  // Bulk CSV Onboarding Form
                  <form onSubmit={handleCsvUpload} className="space-y-4 text-xs">
                    <p className="text-xs text-[#C2C6D1] mb-2 leading-relaxed">
                      Download our pre-filled Excel template, populate your spreadsheet, and upload it directly. Or simply paste CSV data directly in the textbox below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Default Institution *</label>
                        <CustomSelect
                          options={institutions}
                          value={selectedInstId}
                          onChange={(val) => setSelectedInstId(val)}
                          placeholder="-- Choose Institution or School --"
                          required
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={!selectedInstId}
                          onClick={downloadTemplateExcel}
                          className="flex items-center gap-1.5 bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20 px-3.5 py-2 rounded-lg hover:bg-[#6E79F4] hover:text-white transition-all font-semibold disabled:opacity-50 text-[11px]"
                        >
                          <Download size={13} />
                          Download Excel Template
                        </button>
                      </div>
                    </div>

                    {/* File Upload Box */}
                    <div className="border border-dashed border-[#23252C] bg-[#16171D]/50 hover:bg-[#16171D] rounded-xl p-6 text-center transition-all relative">
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={!selectedInstId}
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="text-[#C2C6D1]" size={20} />
                        <span className="font-semibold text-xs text-[#EDEFF5]">
                          {uploadedFileName ? `Selected: ${uploadedFileName}` : "Click or Drag & Drop Excel/CSV sheet here"}
                        </span>
                        <span className="text-[10px] text-[#C2C6D1]">
                          Supports .xlsx, .xls, and .csv formats
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-[#C2C6D1]">Spreadsheet Preview (Pasted or Loaded) *</label>
                        <button
                          type="button"
                          onClick={() => setCsvContent(`name,email\nJane Doe,jane@school.edu\nJohn Smith,john@school.edu`)}
                          className="text-[10px] text-[#6E79F4] hover:underline font-bold"
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
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-y"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={loading || !selectedInstId || !csvContent.trim()}
                        className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50"
                      >
                        {loading ? "Processing Onboarding..." : "Process Bulk Onboarding Link"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Onboarding Links Generation Display */}
              {links.length > 0 && (
                <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#16171D] px-6 py-3 border-b border-[#23252C]">
                    <h4 className="text-xs font-bold text-[#EDEFF5]">GENERATED ONBOARDING LINKS</h4>
                  </div>
                  
                  <div className="divide-y divide-[#23252C]">
                    {links.map((link, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#16171D]/20 text-xs">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#EDEFF5] truncate">{link.email}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              link.status === "success" 
                                ? "bg-[#2FBF71]/10 text-[#2FBF71]" 
                                : "bg-[#F0555D]/10 text-[#F0555D]"
                            }`}>
                              {link.status === "success" ? "Success" : "Failed"}
                            </span>
                          </div>
                          {link.error && <p className="text-[#F0555D] text-[10px]">{link.error}</p>}
                          {link.link && (
                            <span className="text-[#C2C6D1] font-mono text-[10px] select-all truncate block">
                              {link.link}
                            </span>
                          )}
                        </div>

                        {link.link && (
                          <button
                            onClick={() => copyToClipboard(link.link)}
                            className="flex items-center justify-center gap-1.5 border border-[#23252C] bg-[#131418] px-2.5 py-1.5 rounded-lg hover:bg-[#16171D] transition-all font-semibold shrink-0 text-[10px]"
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
              <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#23252C]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
                    <ShieldCheck size={15} /> Super Admin Onboarding
                  </h3>
                </div>

                <form onSubmit={handleSuperAdminOnboard} className="space-y-4 text-xs">
                  <p className="text-xs text-[#C2C6D1] mb-2 leading-relaxed">
                    Create a new Super Administrator account. Fill in their details below. We will generate an onboarding token and link so they can log in directly and gain full administrative privileges.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1 text-[#C2C6D1]">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Administrator Name"
                        value={superAdminName}
                        onChange={(e) => setSuperAdminName(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-[#C2C6D1]">Email Address *</label>
                      <input
                        type="email"
                        placeholder="e.g. admin@hynox.co"
                        value={superAdminEmail}
                        onChange={(e) => setSuperAdminEmail(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading || !superAdminName.trim() || !superAdminEmail.trim()}
                      className="bg-[#6E79F4] text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50"
                    >
                      {loading ? "Generating Link..." : "Generate & Send Onboarding Link"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Onboarding Links Generation Display */}
              {links.length > 0 && (
                <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#16171D] px-6 py-3 border-b border-[#23252C]">
                    <h4 className="text-xs font-bold text-[#EDEFF5]">GENERATED ONBOARDING LINKS</h4>
                  </div>
                  
                  <div className="divide-y divide-[#23252C]">
                    {links.map((link, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#16171D]/20 text-xs">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#EDEFF5] truncate">{link.email}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              link.status === "success" 
                                ? "bg-[#2FBF71]/10 text-[#2FBF71]" 
                                : "bg-[#F0555D]/10 text-[#F0555D]"
                            }`}>
                              {link.status === "success" ? "Success" : "Failed"}
                            </span>
                          </div>
                          {link.error && <p className="text-[#F0555D] text-[10px]">{link.error}</p>}
                          {link.link && (
                            <span className="text-[#C2C6D1] font-mono text-[10px] select-all truncate block">
                              {link.link}
                            </span>
                          )}
                        </div>

                        {link.link && (
                          <button
                            onClick={() => copyToClipboard(link.link)}
                            className="flex items-center justify-center gap-1.5 border border-[#23252C] bg-[#131418] px-2.5 py-1.5 rounded-lg hover:bg-[#16171D] transition-all font-semibold shrink-0 text-[10px]"
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
              <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-[#16171D]/50 px-6 py-3.5 border-b border-[#23252C]">
                  <h4 className="text-xs font-bold text-[#EDEFF5] uppercase tracking-wider">Super Admin Invitations Status</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#16171D]/30 border-b border-[#23252C] font-bold text-[#C2C6D1]">
                        <th className="px-6 py-3">Administrator Name</th>
                        <th className="px-6 py-3">Email Address</th>
                        <th className="px-6 py-3">Created / Expires At</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23252C]">
                      {superAdminInvitations.length > 0 ? (
                        superAdminInvitations.map((inv) => {
                          const now = new Date();
                          const isAccepted = inv.status === "accepted" || inv.user?.status === "active";
                          const isExpired = !isAccepted && (inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now));
                          const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                          const fullInviteLink = `${appUrl}/onboarding/verify?token=${inv.token}&email=${encodeURIComponent(inv.user?.email || "")}`;

                          let statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20 flex items-center gap-1 w-fit">
                              <Clock size={10} /> Pending
                            </span>
                          );

                          if (isAccepted) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Accepted
                              </span>
                            );
                          } else if (isExpired) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Expired
                              </span>
                            );
                          } else if (inv.status === "failed") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Mail Failed
                              </span>
                            );
                          } else if (inv.status === "revoked") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#4A5060]/10 text-[#C2C6D1] border-[#3A3F4B]/20 flex items-center gap-1 w-fit">
                                <Ban size={10} /> Revoked
                              </span>
                            );
                          } else if (inv.status === "created") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/20 flex items-center gap-1 w-fit">
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
                            <tr key={inv.id} className="hover:bg-[#16171D]/20 transition-colors">
                              <td className="px-6 py-4 font-semibold text-[#EDEFF5]">
                                {inv.user?.full_name || "N/A"}
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-[#C2C6D1]">
                                {inv.user?.email}
                              </td>
                              <td className="px-6 py-4 text-[#C2C6D1] leading-normal">
                                <div className="font-medium text-[11px]">
                                  Sent: {new Date(inv.created_at).toLocaleDateString()}
                                </div>
                                <div className={`text-[10px] ${isExpired ? "text-[#F0555D]" : "text-[#C2C6D1]"}`}>
                                  {isExpired ? "Expired" : `Expires: ${new Date(inv.expires_at).toLocaleDateString()}`}
                                </div>
                              </td>
                              <td className="px-6 py-4">{statusBadge}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isExpired && !isAccepted && inv.status !== "revoked" && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(fullInviteLink);
                                        showSuccess("Super Admin onboarding link copied!");
                                      }}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-[#6E79F4] cursor-pointer"
                                      title="Copy Invite Link"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  )}
                                  
                                  {!isAccepted && (
                                    <button
                                      onClick={() => handleRegenerateInvite(inv.id)}
                                      disabled={regeneratingId === inv.id}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#EDEFF5] cursor-pointer disabled:opacity-50"
                                      title="Regenerate Invite Token"
                                    >
                                      <RefreshCw size={12} className={regeneratingId === inv.id ? "animate-spin" : ""} />
                                    </button>
                                  )}

                                  {inv.user?.id && (
                                    <button
                                      onClick={() => {
                                        setUserToDelete({
                                          id: inv.user.id,
                                          name: inv.user.full_name || "N/A",
                                          email: inv.user.email,
                                          callback: () => {
                                            queryClient.invalidateQueries({ queryKey: ["admin-prefetch"] });
                                          }
                                        });
                                        setUserDeleteConfirmEmail("");
                                        setIsUserDeleteModalOpen(true);
                                      }}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-red-600 hover:text-red-700 cursor-pointer"
                                      title="Delete User Completely"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#C2C6D1] font-medium">
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
                <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Total Invited</div>
                  <div className="text-xl font-bold mt-1 text-[#EDEFF5]">{computedStats.total}</div>
                </div>
                <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#2FBF71] uppercase tracking-wider">Accepted (Approved)</div>
                  <div className="text-xl font-bold mt-1 text-[#2FBF71]">{computedStats.accepted}</div>
                </div>
                <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#6E79F4] uppercase tracking-wider">Pending (Awaiting)</div>
                  <div className="text-xl font-bold mt-1 text-[#6E79F4]">{computedStats.pending}</div>
                </div>
                <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-[#F5B04A] uppercase tracking-wider">Expired</div>
                  <div className="text-xl font-bold mt-1 text-[#F5B04A]">{computedStats.expired}</div>
                </div>
                <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-bold text-[#F0555D] uppercase tracking-wider">Failed / Revoked</div>
                  <div className="text-xl font-bold mt-1 text-[#F0555D]">{computedStats.failed + computedStats.revoked}</div>
                </div>
              </div>

              {/* Main List and Filters Card */}
              <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#23252C] space-y-4 bg-[#16171D]/50">
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
                                ? "bg-[#6E79F4] text-white border-[#6E79F4] shadow-sm"
                                : "bg-[#131418] text-[#C2C6D1] border-[#23252C] hover:bg-[#16171D] hover:text-[#EDEFF5]"
                            }`}
                          >
                            {labelMap[filter]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search input */}
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-2.5 text-[#C2C6D1]" size={14} />
                      <input
                        type="text"
                        placeholder="Search invitees..."
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        className="w-full bg-[#131418] border border-[#23252C] rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                      />
                    </div>
                  </div>

                  {/* Advanced Filters Row */}
                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#23252C]/50 text-xs">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Institution Scope</span>
                      <CustomSelect
                        options={[{ id: "all", name: "All Institutions" }, ...institutions]}
                        value={inviteInstitutionFilter}
                        onChange={(val) => setInviteInstitutionFilter(val)}
                        placeholder="All Institutions"
                        className="min-w-[140px]"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Assigned Role</span>
                      <CustomSelect
                        options={[
                          { id: "all", name: "All Roles" },
                          { id: "student_onboarding", name: "Student" },
                          { id: "institution_admin_invite", name: "Institution Admin" },
                        ]}
                        value={inviteRoleFilter}
                        onChange={setInviteRoleFilter}
                        className="min-w-[120px]"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <span className="text-[9px] font-bold text-[#C2C6D1] uppercase tracking-wider">Creation Timeline</span>
                      <CustomSelect
                        options={[
                          { id: "all", name: "All Time" },
                          { id: "today", name: "Today" },
                          { id: "7days", name: "Last 7 Days" },
                          { id: "30days", name: "Last 30 Days" },
                        ]}
                        value={inviteDateFilter}
                        onChange={setInviteDateFilter}
                        className="min-w-[120px]"
                        required
                      />
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
                          className="text-[#6E79F4] hover:text-[#6E79F4]/80 font-semibold text-xs hover:underline cursor-pointer flex items-center gap-1"
                        >
                          Reset Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#16171D]/30 border-b border-[#23252C] font-bold text-[#C2C6D1]">
                        <th className="px-6 py-3">Invitee Details</th>
                        <th className="px-6 py-3">Target Campus / Role</th>
                        <th className="px-6 py-3">Created / Expires At</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23252C]">
                      {filteredInvitations.length > 0 ? (
                        filteredInvitations.map((inv) => {
                          const now = new Date();
                          const isAccepted = inv.status === "accepted" || inv.user?.status === "active";
                          const isExpired = !isAccepted && (inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now));
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
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20 flex items-center gap-1 w-fit">
                              <Clock size={10} /> Pending
                            </span>
                          );

                          if (isAccepted) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20 flex items-center gap-1 w-fit">
                                <CheckCircle size={10} /> Accepted
                              </span>
                            );
                          } else if (isExpired) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Expired
                              </span>
                            );
                          } else if (inv.status === "failed") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20 flex items-center gap-1 w-fit">
                                <XCircle size={10} /> Mail Failed
                              </span>
                            );
                          } else if (inv.status === "revoked") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#4A5060]/10 text-[#C2C6D1] border-[#3A3F4B]/20 flex items-center gap-1 w-fit">
                                <Ban size={10} /> Revoked
                              </span>
                            );
                          } else if (inv.status === "created") {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/20 flex items-center gap-1 w-fit">
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
                            <tr key={inv.id} className="hover:bg-[#16171D]/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-[#EDEFF5]">{inv.user?.full_name || "N/A"}</div>
                                <div className="text-[#C2C6D1] text-[11px] font-medium">{inv.user?.email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-[#EDEFF5]">{inv.institution_name}</div>
                                <span className="inline-flex px-1.5 py-0.5 rounded bg-[#1A1C22] text-[#C2C6D1] font-bold text-[9px] mt-0.5">
                                  {roleLabel}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[#C2C6D1] leading-normal">
                                <div className="font-medium text-[11px]">
                                  Sent: {new Date(inv.created_at).toLocaleDateString()}
                                </div>
                                <div className={`text-[10px] ${isExpired ? "text-[#F0555D]" : "text-[#C2C6D1]"}`}>
                                  {isExpired ? "Expired" : `Expires: ${new Date(inv.expires_at).toLocaleDateString()}`}
                                </div>
                              </td>
                              <td className="px-6 py-4">{statusBadge}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isExpired && !isAccepted && inv.status !== "revoked" && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(fullInviteLink);
                                        showSuccess("Onboarding link copied!");
                                      }}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-[#6E79F4] cursor-pointer"
                                      title="Copy Invite Link"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  )}
                                  
                                  {!isAccepted && (
                                    <button
                                      onClick={() => handleRegenerateInvite(inv.id)}
                                      disabled={regeneratingId === inv.id}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#EDEFF5] cursor-pointer disabled:opacity-50"
                                      title="Regenerate Invite Token"
                                    >
                                      <RefreshCw size={12} className={regeneratingId === inv.id ? "animate-spin" : ""} />
                                    </button>
                                  )}

                                  {inv.user?.id && (
                                    <button
                                      onClick={() => {
                                        setUserToDelete({
                                          id: inv.user.id,
                                          name: inv.user.full_name || "N/A",
                                          email: inv.user.email,
                                          callback: () => {
                                            queryClient.invalidateQueries({ queryKey: ["admin-prefetch"] });
                                          }
                                        });
                                        setUserDeleteConfirmEmail("");
                                        setIsUserDeleteModalOpen(true);
                                      }}
                                      className="p-1 hover:bg-[#1A1C22] rounded text-red-600 hover:text-red-700 cursor-pointer"
                                      title="Delete User Completely"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#C2C6D1] font-medium">
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
              {/* Teacher Onboarding Card */}
              <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#EDEFF5]">Invite & Onboard New Teacher</h3>
                  <p className="text-[11px] text-[#C2C6D1] mt-0.5">Onboard a platform-wide teacher/trainer instantly. Teachers are not bound to any institution on invite; they are assigned to groups later.</p>
                </div>
                <form onSubmit={handleTeacherOnboardSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Professor Smith"
                      value={teacherOnboardName}
                      onChange={(e) => setTeacherOnboardName(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#C2C6D1]">Email Address *</label>
                    <input
                      type="email"
                      placeholder="e.g. smith@hynox.org"
                      value={teacherOnboardEmail}
                      onChange={(e) => setTeacherOnboardEmail(e.target.value)}
                      className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={teacherOnboardLoading || !teacherOnboardName.trim() || !teacherOnboardEmail.trim()}
                      className="w-full bg-[#6E79F4] text-white py-2 rounded-lg shadow-sm font-bold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50"
                    >
                      {teacherOnboardLoading ? "Onboarding..." : "Onboard Teacher"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Teacher Onboarding Status list */}
              {(() => {
                const teacherInvs = invitations.filter(inv => inv.invitation_type === "trainer_onboarding");

                return (
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#EDEFF5]">Teacher Onboarding Status</h3>
                      <p className="text-[11px] text-[#C2C6D1] mt-0.5">Track invitation tokens and status of teachers invited to the platform.</p>
                    </div>                     <div className="overflow-x-auto border border-[#23252C] rounded-lg">
                      <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#16171D]/30 border-b border-[#23252C] font-bold text-[#C2C6D1]">
                            <th className="px-6 py-3">Teacher Name</th>
                            <th className="px-6 py-3">Email Address</th>
                            <th className="px-6 py-3">Created / Expires At</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#23252C]">
                          {teacherInvs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-[#C2C6D1] font-medium">
                                No teacher invitations found.
                              </td>
                            </tr>
                          ) : teacherInvs.map((inv) => {
                            const now = new Date();
                            const isAccepted = inv.status === "accepted" || inv.user?.status === "active";
                            const isExpired = !isAccepted && (inv.status === "expired" || (["pending", "created", "sent"].includes(inv.status) && new Date(inv.expires_at) < now));
                            const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                            const fullInviteLink = `${appUrl}/onboarding/verify?token=${inv.token}&email=${encodeURIComponent(inv.user?.email || "")}`;

                            let statusBadge = (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20 flex items-center gap-1 w-fit">
                                <Clock size={10} /> Pending
                              </span>
                            );

                            if (isAccepted) {
                              statusBadge = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20 flex items-center gap-1 w-fit">
                                  <CheckCircle size={10} /> Accepted
                                </span>
                              );
                            } else if (isExpired) {
                              statusBadge = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20 flex items-center gap-1 w-fit">
                                  <AlertCircle size={10} /> Expired
                                </span>
                              );
                            } else if (inv.status === "revoked") {
                              statusBadge = (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20 flex items-center gap-1 w-fit">
                                  <Ban size={10} /> Revoked
                                </span>
                              );
                            }

                            return (
                              <tr key={inv.id} className="hover:bg-[#16171D]/20 transition-colors">
                                <td className="px-6 py-4 font-semibold text-[#EDEFF5]">
                                  {inv.user?.full_name || "N/A"}
                                </td>
                                <td className="px-6 py-4 font-mono text-[11px] text-[#C2C6D1]">
                                  {inv.user?.email}
                                </td>
                                <td className="px-6 py-4 text-[#C2C6D1] leading-normal">
                                  <div className="text-[#EDEFF5] font-medium text-[11px]">{new Date(inv.created_at).toLocaleDateString()}</div>
                                  <div className={`text-[10px] ${isExpired ? "text-[#F0555D]" : "text-[#C2C6D1]"}`}>Expires: {new Date(inv.expires_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4">
                                  {statusBadge}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {!isExpired && !isAccepted && (
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(fullInviteLink);
                                          showSuccess("Teacher onboarding link copied!");
                                        }}
                                        className="p-1 hover:bg-[#1A1C22] rounded text-[#6E79F4] cursor-pointer"
                                        title="Copy Invite Link"
                                      >
                                        <Copy size={12} />
                                      </button>
                                    )}
                                    {!isAccepted && (
                                      <button
                                        onClick={() => handleRegenerateInvite(inv.id)}
                                        disabled={regeneratingId === inv.id}
                                        className="p-1 hover:bg-[#1A1C22] rounded text-[#C2C6D1] hover:text-[#EDEFF5] cursor-pointer disabled:opacity-50"
                                        title="Regenerate Invite Token"
                                      >
                                        <RefreshCw size={12} className={regeneratingId === inv.id ? "animate-spin" : ""} />
                                      </button>
                                    )}
                                    {inv.user?.id && (
                                      <button
                                        onClick={() => {
                                          setUserToDelete({
                                            id: inv.user.id,
                                            name: inv.user.full_name || "N/A",
                                            email: inv.user.email,
                                            callback: () => {
                                              queryClient.invalidateQueries({ queryKey: ["admin-prefetch"] });
                                              loadAllTeachersData();
                                            }
                                          });
                                          setUserDeleteConfirmEmail("");
                                          setIsUserDeleteModalOpen(true);
                                        }}
                                        className="p-1 hover:bg-[#1A1C22] rounded text-red-600 hover:text-red-700 cursor-pointer"
                                        title="Delete User Completely"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: TEACHER GROUP MAPPING & ASSIGNMENTS */}
          {activeTab === "teacher_assignments" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm p-6">
                <div>
                  <h3 className="text-sm font-bold text-[#EDEFF5]">Teacher Group Mapping & Assignments</h3>
                  <p className="text-[11px] text-[#C2C6D1] mt-0.5">Assign, manage, and map platform educators to their respective active learning groups.</p>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#23252C]">
                  <div className="w-full sm:max-w-xs">
                    <input 
                      type="text"
                      placeholder="Search teachers by name or email..."
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      className="bg-[#131418] border border-[#23252C] px-3.5 py-1.5 rounded-lg text-xs w-full focus:outline-none focus:border-[#6E79F4]"
                    />
                  </div>
                  <button 
                    onClick={loadAllTeachersData}
                    disabled={loadingTeachers}
                    className="flex items-center gap-1.5 bg-[#6E79F4] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-xs font-bold disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loadingTeachers ? "animate-spin" : ""} />
                    Refresh Teachers
                  </button>
                </div>

                {loadingTeachers && teachersList.length === 0 ? (
                  <SecondaryLoader variant="skeleton" message="Retrieving registered teacher credentials..." className="!border-0 !p-0 shadow-none" />
                ) : teachersList.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#C2C6D1] border border-dashed border-[#23252C] rounded-xl mt-4">
                    No registered teachers/trainers found on the platform.
                  </div>
                ) : (
                  <div className="divide-y divide-[#23252C] mt-2">
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
                          className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:bg-[#16171D]/50 px-3 rounded-xl transition-all cursor-pointer select-none"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="text-xs font-bold text-[#EDEFF5] flex items-center gap-2">
                              {teacher.full_name}
                              <span className="bg-[#6E79F4]/10 text-[#6E79F4] border border-[#6E79F4]/20 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                                Teacher
                              </span>
                            </h4>
                            <p className="text-[10px] text-[#C2C6D1]">{teacher.email}</p>
                            
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs text-[#6E79F4] font-semibold flex items-center gap-1 hover:underline">
                              View details & assign
                              <ChevronRight size={14} />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserToDelete({
                                  id: teacher.id,
                                  name: teacher.full_name || "N/A",
                                  email: teacher.email,
                                  callback: () => {
                                    queryClient.invalidateQueries({ queryKey: ["admin-prefetch"] });
                                    loadAllTeachersData();
                                  }
                                });
                                setUserDeleteConfirmEmail("");
                                setIsUserDeleteModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg cursor-pointer transition-all border border-transparent hover:border-red-100"
                              title="Delete Teacher completely"
                            >
                              <Trash2 size={14} />
                            </button>
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
              <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#C2C6D1] flex items-center gap-1.5">
                  <Globe size={14} /> Select Campus Space
                </h3>
                <p className="text-xs text-[#C2C6D1] mb-4">
                  Select a campus institution tenant to explore its registered administrators, teachers, and students.
                </p>
                <CustomSelect
                  options={institutions}
                  value={explorerSelectedId}
                  onChange={(val) => handleSelectInstitutionForExplorer(val)}
                  placeholder="-- Choose Institution --"
                  className="max-w-md"
                />
              </div>

              {explorerSelectedId && (
                <>
                  {explorerLoading ? (
                    <SecondaryLoader variant="spinner" message="Loading campus directory..." />
                  ) : (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Total Campus Users</div>
                          <div className="text-xl font-bold mt-1 text-[#EDEFF5]">{computedExplorerStats.total}</div>
                        </div>
                        <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#2FBF71] uppercase tracking-wider">Administrators</div>
                          <div className="text-xl font-bold mt-1 text-[#2FBF71]">{computedExplorerStats.admins}</div>
                        </div>
                        <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#6E79F4] uppercase tracking-wider">Teachers / Trainers</div>
                          <div className="text-xl font-bold mt-1 text-[#6E79F4]">{computedExplorerStats.teachers}</div>
                        </div>
                        <div className="bg-[#131418] border border-[#23252C] p-4 rounded-xl shadow-sm">
                          <div className="text-[10px] font-bold text-[#22D3EE] uppercase tracking-wider">Students</div>
                          <div className="text-xl font-bold mt-1 text-[#22D3EE]">{computedExplorerStats.students}</div>
                        </div>
                      </div>

                      {/* User list and filtering */}
                      <div className="bg-[#131418] border border-[#23252C] rounded-xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-[#23252C] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#16171D]/50">
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
                                      ? "bg-[#6E79F4] text-white border-[#6E79F4] shadow-sm"
                                      : "bg-[#131418] text-[#C2C6D1] border-[#23252C] hover:bg-[#16171D]"
                                  }`}
                                >
                                  {labelMap[filter]}
                                </button>
                              );
                            })}
                          </div>

                          {/* Search Input */}
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 text-[#C2C6D1]" size={14} />
                            <input
                              type="text"
                              placeholder="Search directory..."
                              value={explorerSearch}
                              onChange={(e) => setExplorerSearch(e.target.value)}
                              className="w-full bg-[#131418] border border-[#23252C] rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-xs text-[#EDEFF5]"
                            />
                          </div>
                        </div>

                        {/* Directory Directory Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#16171D]/30 border-b border-[#23252C] font-bold text-[#C2C6D1]">
                                <th className="px-6 py-3">User Details</th>
                                <th className="px-6 py-3">Assigned Role</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Joined Date</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#23252C]">
                              {filteredExplorerUsers.length > 0 ? (
                                filteredExplorerUsers.map((user) => {
                                  // Determine badge style for role
                                  let roleBadge = (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#1A1C22] text-[#C2C6D1] border-[#23252C]">
                                      Member
                                    </span>
                                  );

                                  if (user.roles.includes("super_admin") || user.roles.includes("institution_admin")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20">
                                        Admin
                                      </span>
                                    );
                                  } else if (user.roles.includes("teacher") || user.roles.includes("trainer")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20">
                                        Teacher
                                      </span>
                                    );
                                  } else if (user.roles.includes("student")) {
                                    roleBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/20">
                                        Student
                                      </span>
                                    );
                                  }

                                  // Determine badge for user status
                                  let statusBadge = (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#2FBF71]/10 text-[#2FBF71] border-[#2FBF71]/20">
                                      {user.status}
                                    </span>
                                  );

                                  if (user.status === "invited" || user.status === "pending_activation") {
                                    statusBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#F5B04A]/10 text-[#F5B04A] border-[#F5B04A]/20">
                                        {user.status}
                                      </span>
                                    );
                                  } else if (user.status === "suspended" || user.status === "inactive" || user.status === "blocked") {
                                    statusBadge = (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[#F0555D]/10 text-[#F0555D] border-[#F0555D]/20">
                                        {user.status}
                                      </span>
                                    );
                                  }

                                  return (
                                    <tr key={user.id} className="hover:bg-[#16171D]/50 transition-colors">
                                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedUserDetail(user)}>
                                        <div className="font-semibold text-[#EDEFF5]">{user.full_name || "N/A"}</div>
                                        <div className="text-[#C2C6D1] text-[11px] font-medium">{user.email}</div>
                                      </td>
                                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedUserDetail(user)}>{roleBadge}</td>
                                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedUserDetail(user)}>{statusBadge}</td>
                                      <td className="px-6 py-4 text-[#C2C6D1] font-medium cursor-pointer" onClick={() => setSelectedUserDetail(user)}>
                                        {new Date(user.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setUserToDelete({
                                              id: user.id,
                                              name: user.full_name || "N/A",
                                              email: user.email,
                                              callback: () => {
                                                queryClient.invalidateQueries({ queryKey: ["admin-prefetch"] });
                                                handleSelectInstitutionForExplorer(explorerSelectedId);
                                              }
                                            });
                                            setUserDeleteConfirmEmail("");
                                            setIsUserDeleteModalOpen(true);
                                          }}
                                          className="p-1 hover:bg-[#1A1C22] rounded text-red-600 hover:text-red-700 cursor-pointer"
                                          title="Delete User Completely"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-6 py-8 text-center text-[#C2C6D1] font-medium">
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

          {/* TAB: ATTENDANCE REGISTER */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-fade-in">
              <AttendanceModule institutions={institutions} userRole="super_admin" />
            </div>
          )}

          {/* TAB 6: LIBRARY (BLUEPRINTS) */}
          {activeTab === "library" && (
            <div className="space-y-6 animate-fade-in">
              <LibraryBuilder />
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
              <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[#C2C6D1] flex items-center gap-1.5">
                  <GraduationCap size={15} /> Academic Institution Scope
                </h3>
                <p className="text-xs text-[#C2C6D1] mb-4">
                  Select a campus institution to manage its academic catalog, course curriculum, and teacher mapping.
                </p>
                <CustomSelect
                  options={institutions}
                  value={acadSelectedInstId}
                  onChange={(val) => setAcadSelectedInstId(val)}
                  placeholder="-- Select Institution Campus --"
                  className="max-w-md"
                />
              </div>

              {acadSelectedInstId && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Programs & Courses */}
                  <div className="lg:col-span-1 space-y-6">
                    
                    {/* Programs Section */}
                    <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                          <Folder size={14} className="text-[#6E79F4]" /> Programs
                        </h4>
                        <button
                          onClick={() => {
                            setEditingProgram(null);
                            const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                            const publicVisibility = acadLookups.visibilityTypes.find((v: any) => v.code === "public")?.id || "";
                            setProgramForm({ title: "", slug: "", description: "", status_id: activeStatus, visibility_type_id: publicVisibility });
                            setProgramModalOpen(true);
                          }}
                          className="flex items-center gap-1 bg-[#6E79F4] text-white px-2 py-1 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-[10px] font-bold shadow-sm"
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
                                  ? "bg-[#6E79F4]/10 border-[#6E79F4]/30 text-[#6E79F4]"
                                  : "bg-[#16171D]/50 hover:bg-[#16171D] border-[#23252C] text-[#EDEFF5]"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold truncate">{prog.title}</p>
                                <p className="text-[10px] text-[#C2C6D1] font-mono truncate">/{prog.slug}</p>
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
                                  className="p-1 hover:bg-[#23252C] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
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
                                        ? "bg-[#1A1C22] text-[#E2E4EB] border-[#23252C] hover:bg-[#23252C]/80"
                                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80"
                                    }`}
                                  >
                                    {acadLookups.statuses.find((s: any) => s.id === prog.status_id)?.code.toUpperCase() || "DRAFT"}
                                    <ChevronDown size={10} className="opacity-70" />
                                  </button>

                                  {openProgDropdownId === prog.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenProgDropdownId(null); }}></div>
                                      <div className="absolute right-0 mt-1.5 w-28 bg-[#131418] border border-[#23252C] rounded-xl shadow-lg z-20 py-1 font-semibold text-[9px] overflow-hidden text-[#E2E4EB]">
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
                                                  showError(res.error);
                                                } else {
                                                  showSuccess("Program status updated successfully!");
                                                  await refreshPrograms();
                                                }
                                              }}
                                              className="w-full text-left px-2.5 py-1.5 hover:bg-[#16171D] transition-all flex items-center gap-1.5"
                                            >
                                              <span className={`w-1 h-1 rounded-full ${
                                                s.code === "active" ? "bg-emerald-500" : s.code === "draft" ? "bg-[#3A3F4B]" : "bg-red-500"
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
                          <p className="text-[11px] text-[#C2C6D1] text-center py-4 bg-[#16171D]/50 rounded-lg">No programs registered yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Courses Section */}
                    {acadSelectedProgram && (
                      <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                              <GraduationCap size={14} className="text-[#6E79F4]" /> Courses
                            </h4>
                            <p className="text-[10px] text-[#C2C6D1] truncate font-medium">under: {acadSelectedProgram.title}</p>
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
                            className="flex items-center gap-1 bg-[#6E79F4] text-white px-2 py-1 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-[10px] font-bold shadow-sm shrink-0"
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
                                    ? "bg-[#6E79F4]/10 border-[#6E79F4]/30 text-[#6E79F4]"
                                    : "bg-[#16171D]/50 hover:bg-[#16171D] border-[#23252C] text-[#EDEFF5]"
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold truncate">{crs.title}</p>
                                  <p className="text-[10px] text-[#C2C6D1] truncate font-mono">/{crs.slug}</p>
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
                                    className="p-1 hover:bg-[#23252C] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm("Are you sure you want to delete this course?")) {
                                        const res = await deleteCourseAction(crs.id);
                                        if (res.error) showError(res.error);
                                        else {
                                          showSuccess("Course deleted successfully!");
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
                            <p className="text-[11px] text-[#C2C6D1] text-center py-4 bg-[#16171D]/50 rounded-lg font-medium">No courses in this program.</p>
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
                        <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#23252C] pb-4">
                            <div>
                              <h3 className="text-sm font-bold text-[#EDEFF5]">{acadSelectedCourse.title}</h3>
                              <p className="text-xs text-[#C2C6D1] mt-0.5">{acadSelectedCourse.description || "No description set for this course."}</p>
                            </div>
                            
                          </div>

                          {/* Instructors Panel */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                              <Users size={14} className="text-[#6E79F4]" /> Course Instructors (Teachers/Trainers)
                            </h4>
                            
                            <form onSubmit={handleSaveInstructors} className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto p-1 border border-[#23252C] rounded-lg">
                                {acadTenantTeachers.length > 0 ? (
                                  acadTenantTeachers.map((teach: any) => {
                                    const isAssigned = acadInstructors.some(i => i.user_id === teach.id);
                                    return (
                                      <label key={teach.id} className="flex items-center gap-2 px-3 py-2 bg-[#16171D] hover:bg-[#1A1C22] rounded-lg cursor-pointer text-xs transition-colors">
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
                                          className="rounded border-[#23252C] text-[#6E79F4] focus:ring-[#6E79F4] h-3.5 w-3.5"
                                        />
                                        <div className="min-w-0">
                                          <p className="font-semibold text-[#EDEFF5] truncate">{teach.full_name}</p>
                                          <p className="text-[10px] text-[#C2C6D1] truncate font-medium">{teach.email}</p>
                                        </div>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <p className="col-span-2 text-[11px] text-[#C2C6D1] text-center py-4 font-medium">No active teachers/trainers found in this tenant space.</p>
                                )}
                              </div>
                              {acadTenantTeachers.length > 0 && (
                                <button
                                  type="submit"
                                  disabled={loading}
                                  className="flex items-center gap-1.5 bg-[#6E79F4] text-white px-3.5 py-2 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-xs font-semibold shadow-sm disabled:opacity-50"
                                >
                                  <Save size={13} />
                                  {loading ? "Saving Mapping..." : "Save Assigned Instructors"}
                                </button>
                              )}
                            </form>
                          </div>
                        </div>

                        {/* Curriculum Modules & Lessons Explorer */}
                        <div className="bg-[#131418] border border-[#23252C] rounded-xl p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-[#23252C] pb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EDEFF5] flex items-center gap-1.5">
                              <FolderPlus size={15} className="text-[#6E79F4]" /> Course Curriculum Modules
                            </h4>
                            <button
                              onClick={() => {
                                setEditingModule(null);
                                const activeStatus = acadLookups.statuses.find((s: any) => s.code === "active")?.id || "";
                                setModuleForm({ title: "", description: "", position: acadModules.length + 1, status_id: activeStatus });
                                setModuleModalOpen(true);
                              }}
                              className="flex items-center gap-1 bg-[#6E79F4] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#6E79F4]/95 transition-all text-[11px] font-bold shadow-sm"
                            >
                              <Plus size={13} /> Create Module
                            </button>
                          </div>

                          <div className="space-y-4">
                            {acadModules.length > 0 ? (
                              acadModules.map((mod) => (
                                <div key={mod.id} className="border border-[#23252C] rounded-xl overflow-hidden shadow-sm bg-[#16171D]/20">
                                  {/* Module Header */}
                                  <div className="bg-[#16171D] px-4 py-3 flex items-center justify-between border-b border-[#23252C]">
                                    <div className="min-w-0 pr-2">
                                      <p className="font-semibold text-xs text-[#EDEFF5] truncate">
                                        Module {mod.position}: {mod.title}
                                      </p>
                                      {mod.description && <p className="text-[10px] text-[#C2C6D1] truncate mt-0.5">{mod.description}</p>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                                            status_id: activeStatus
                                          });
                                          setLessonModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-2 py-1 rounded text-[10px] font-bold text-[#EDEFF5] shadow-xs"
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
                                        className="p-1 hover:bg-[#23252C] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                                      >
                                        <Edit size={12} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (confirm("Are you sure you want to delete this module?")) {
                                            const res = await deleteModuleAction(mod.id);
                                            if (res.error) showError(res.error);
                                            else {
                                              showSuccess("Module deleted successfully!");
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
                                        <div key={les.id} className="bg-[#131418] border border-[#23252C] rounded-xl p-3.5 space-y-3 shadow-xs">
                                          <div className="flex items-start justify-between">
                                            <div className="min-w-0 pr-2">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-xs text-[#EDEFF5]">{les.title}</span>
                                                <span className="text-[9px] bg-[#1A1C22] text-[#C2C6D1] px-1.5 py-0.5 rounded font-bold font-mono">
                                                  {les.lesson_type?.code || "lesson"}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-[#C2C6D1] mt-0.5 font-mono font-medium">
                                                Position: {les.position}
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
                                                className="flex items-center gap-1 hover:bg-[#1A1C22] text-[10px] text-[#6E79F4] font-bold px-2 py-1 rounded"
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
                                                    status_id: les.status_id
                                                  });
                                                  setLessonModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-[#23252C] rounded text-[#C2C6D1] hover:text-[#EDEFF5]"
                                              >
                                                <Edit size={12} />
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (confirm("Are you sure you want to delete this lesson?")) {
                                                    const res = await deleteLessonAction(les.id);
                                                    if (res.error) showError(res.error);
                                                    else {
                                                      showSuccess("Lesson deleted successfully!");
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
                                            <div className="flex items-center gap-1.5 text-[10px] bg-[#16171D] px-2.5 py-1.5 rounded-lg border border-[#23252C] mb-2">
                                              <Play size={10} className="fill-[#6E79F4] text-[#6E79F4] shrink-0" />
                                              <span className="font-semibold text-[#C2C6D1]">Video Link:</span>
                                              <a href={les.video_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-[#6E79F4] font-bold flex-1">
                                                {les.video_url}
                                              </a>
                                            </div>
                                          )}

                                          {/* Lesson Resource list */}
                                          {les.resources && les.resources.length > 0 && (
                                            <div className="bg-[#16171D]/50 border border-[#23252C] rounded-lg p-2 space-y-1.5">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#C2C6D1] px-1">Attachments & External Resources</p>
                                              <div className="divide-y divide-[#23252C] bg-[#131418] rounded-md border border-[#23252C]">
                                                {les.resources.map((res: any) => (
                                                  <div key={res.id} className="px-2 py-1.5 flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <File size={12} className="text-[#C2C6D1] shrink-0" />
                                                      <span className="font-semibold text-[#EDEFF5] truncate">{res.title}</span>
                                                      <span className="text-[9px] bg-[#1A1C22] text-[#C2C6D1] px-1 rounded-sm">{res.resource_type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                      {res.external_url && (
                                                        <a href={res.external_url} target="_blank" rel="noopener noreferrer" className="p-0.5 text-[#6E79F4] hover:text-[#6E79F4]/80">
                                                          <ExternalLink size={12} />
                                                        </a>
                                                      )}
                                                      <button
                                                        onClick={async () => {
                                                          if (confirm("Remove this resource attachment?")) {
                                                            const delRes = await deleteLessonResourceAction(res.id);
                                                            if (delRes.error) showError(delRes.error);
                                                            else {
                                                              showSuccess("Resource removed successfully!");
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
                                      <p className="text-[11px] text-[#C2C6D1] text-center py-2 font-medium">No lessons created in this module.</p>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-[#C2C6D1] text-center py-6 bg-[#16171D]/50 rounded-xl font-medium">No curriculum modules defined. Add a module to begin.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-[#131418] border border-[#23252C] rounded-xl p-12 text-center shadow-sm">
                        <Folder className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-xs text-[#C2C6D1] font-medium">Select a Course on the left to start configuring its syllabus curriculum.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* MODALS */}
              
              {/* Program Modal */}
              {programModalOpen && (
                <div className="fixed inset-0 bg-[#23252D]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-sm text-[#EDEFF5]">{editingProgram ? "Edit Academic Program" : "Create New Program"}</h3>
                    <form onSubmit={handleProgramSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Program Title *</label>
                        <input
                          type="text"
                          required
                          value={programForm.title}
                          onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                          placeholder="e.g. Full Stack Web Development"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">URL Slug (Unique per Tenant) *</label>
                        <input
                          type="text"
                          required
                          value={programForm.slug}
                          onChange={(e) => setProgramForm({ ...programForm, slug: e.target.value })}
                          placeholder="e.g. full-stack-dev"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Description</label>
                        <textarea
                          value={programForm.description}
                          onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                          placeholder="Provide a brief curriculum program overview..."
                          rows={3}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                          <select
                            value={programForm.status_id}
                            onChange={(e) => setProgramForm({ ...programForm, status_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Visibility *</label>
                          <select
                            value={programForm.visibility_type_id}
                            onChange={(e) => setProgramForm({ ...programForm, visibility_type_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.visibilityTypes.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#23252C]">
                        <button
                          type="button"
                          onClick={() => setProgramModalOpen(false)}
                          className="bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50"
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
                <div className="fixed inset-0 bg-[#23252D]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-sm text-[#EDEFF5]">{editingCourse ? "Edit Course" : "Create New Course"}</h3>
                    <form onSubmit={handleCourseSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Course Title *</label>
                        <input
                          type="text"
                          required
                          value={courseForm.title}
                          onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                          placeholder="e.g. Intro to React & Next.js"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">URL Slug (Unique per Tenant) *</label>
                        <input
                          type="text"
                          required
                          value={courseForm.slug}
                          onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                          placeholder="e.g. react-nextjs-intro"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Description</label>
                        <textarea
                          value={courseForm.description}
                          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                          placeholder="Provide a syllabus course description..."
                          rows={2}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Course Type *</label>
                          <select
                            value={courseForm.course_type_id}
                            onChange={(e) => setCourseForm({ ...courseForm, course_type_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.courseTypes.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Enrollment Mode *</label>
                          <select
                            value={courseForm.enrollment_mode}
                            onChange={(e) => setCourseForm({ ...courseForm, enrollment_mode: e.target.value as any })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            <option value="open">Open Access</option>
                            <option value="approval">Approval Required</option>
                            <option value="private">Private Access</option>
                            <option value="institution_only">Institution Members Only</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Duration (Mins)</label>
                          <input
                            type="number"
                            value={courseForm.duration_minutes}
                            onChange={(e) => setCourseForm({ ...courseForm, duration_minutes: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                          <select
                            value={courseForm.status_id}
                            onChange={(e) => setCourseForm({ ...courseForm, status_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Visibility *</label>
                          <select
                            value={courseForm.visibility_type_id}
                            onChange={(e) => setCourseForm({ ...courseForm, visibility_type_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.visibilityTypes.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#23252C]">
                        <button
                          type="button"
                          onClick={() => setCourseModalOpen(false)}
                          className="bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50"
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
                <div className="fixed inset-0 bg-[#23252D]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-sm text-[#EDEFF5]">{editingModule ? "Edit Module" : "Create New Module"}</h3>
                    <form onSubmit={handleModuleSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Module Title *</label>
                        <input
                          type="text"
                          required
                          value={moduleForm.title}
                          onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                          placeholder="e.g. Getting Started with React"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Description</label>
                        <textarea
                          value={moduleForm.description}
                          onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                          placeholder="Module syllabus description..."
                          rows={2}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={moduleForm.position}
                            onChange={(e) => setModuleForm({ ...moduleForm, position: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                          <select
                            value={moduleForm.status_id}
                            onChange={(e) => setModuleForm({ ...moduleForm, status_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#23252C]">
                        <button
                          type="button"
                          onClick={() => setModuleModalOpen(false)}
                          className="bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50"
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
                <div className="fixed inset-0 bg-[#23252D]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-sm text-[#EDEFF5]">{editingLesson ? "Edit Lesson" : "Create New Lesson"}</h3>
                    <form onSubmit={handleLessonSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Title *</label>
                        <input
                          type="text"
                          required
                          value={lessonForm.title}
                          onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                          placeholder="e.g. 1.1 Intro to Components"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Lesson Type *</label>
                          <select
                            value={lessonForm.lesson_type_id}
                            onChange={(e) => setLessonForm({ ...lessonForm, lesson_type_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.lessonTypes.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.description}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                          <select
                            value={lessonForm.status_id}
                            onChange={(e) => setLessonForm({ ...lessonForm, status_id: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            {acadLookups.statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={lessonForm.position}
                            onChange={(e) => setLessonForm({ ...lessonForm, position: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Duration (Mins) *</label>
                          <input
                            type="number"
                            required
                            value={lessonForm.duration}
                            onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Video Lecture URL</label>
                        <input
                          type="text"
                          value={lessonForm.video_url}
                          onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                          placeholder="e.g. https://youtube.com/... or Vimeo"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Learning Content (Markdown / Text) *</label>
                        <textarea
                          placeholder="Enter lesson markdown or text content here..."
                          value={lessonForm.content_text}
                          onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
                          rows={6}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5] resize-y"
                          required
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#23252C]">
                        <button
                          type="button"
                          onClick={() => setLessonModalOpen(false)}
                          className="bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50"
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
                <div className="fixed inset-0 bg-[#23252D]/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#131418] border border-[#23252C] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-sm text-[#EDEFF5]">Attach Lesson Resource</h3>
                    <form onSubmit={handleResourceSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Resource Title *</label>
                        <input
                          type="text"
                          required
                          value={resourceForm.title}
                          onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                          placeholder="e.g. Component Cheatsheet PDF"
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Resource Type *</label>
                          <select
                            value={resourceForm.resource_type}
                            onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          >
                            <option value="link">External URL Link</option>
                            <option value="file">File Attachment</option>
                            <option value="pdf">PDF Document</option>
                            <option value="video">Reference Video</option>
                            <option value="code">Source Code Repository</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">Position Order *</label>
                          <input
                            type="number"
                            required
                            value={resourceForm.position}
                            onChange={(e) => setResourceForm({ ...resourceForm, position: Number(e.target.value) })}
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                      </div>
                      {resourceForm.resource_type === "file" || resourceForm.resource_type === "pdf" ? (
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">File URL *</label>
                          <input
                            type="text"
                            required
                            value={resourceForm.file_url}
                            onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                            placeholder="e.g. https://storage.hynox.com/file.pdf"
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block font-semibold mb-1 text-[#C2C6D1]">External URL *</label>
                          <input
                            type="text"
                            required
                            value={resourceForm.external_url}
                            onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                            placeholder="e.g. https://github.com/... or external link"
                            className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#23252C]">
                        <button
                          type="button"
                          onClick={() => setResourceModalOpen(false)}
                          className="bg-[#131418] border border-[#23252C] hover:bg-[#16171D] px-3.5 py-2 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 disabled:opacity-50"
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

      {renderUserDetailDrawer()}
      {renderTeacherDetailDrawer()}

      {(() => {
        if (!selectedInstForSidebar || !isInstSidebarOpen) return null;

        const inst = selectedInstForSidebar;
        
        return (
          <div className="fixed inset-0 z-50 overflow-hidden text-xs">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsInstSidebarOpen(false)} />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-[#131418] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out" style={{ animation: "slide-over 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes slide-over {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                  }
                `}} />
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#23252C] flex items-center justify-between bg-[#16171D] shrink-0">
                  <div>
                    <h3 className="font-bold text-[#EDEFF5] text-sm uppercase tracking-wider">Institution Details</h3>
                    <p className="text-[10px] text-[#C2C6D1] mt-0.5 font-mono">{inst.id}</p>
                  </div>
                  <button 
                    onClick={() => setIsInstSidebarOpen(false)} 
                    className="p-1.5 hover:bg-black/5 rounded-full text-[#C2C6D1] hover:text-[#EDEFF5] transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {isEditingInst ? (
                    <form onSubmit={handleSaveEditInst} className="space-y-4">
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Institution Name *</label>
                        <input
                          type="text"
                          required
                          value={editInstForm.name}
                          onChange={(e) => setEditInstForm({ ...editInstForm, name: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Institution Code *</label>
                        <input
                          type="text"
                          required
                          value={editInstForm.institution_code}
                          onChange={(e) => setEditInstForm({ ...editInstForm, institution_code: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Category Type *</label>
                        <select
                          value={editInstForm.institution_type}
                          onChange={(e) => setEditInstForm({ ...editInstForm, institution_type: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        >
                          <option value="college">College</option>
                          <option value="school">School</option>
                          <option value="others">Others</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Status *</label>
                        <select
                          value={editInstForm.status}
                          onChange={(e) => setEditInstForm({ ...editInstForm, status: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        >
                          <option value="active">Active</option>
                          <option value="onboarding">Onboarding</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Contact Email</label>
                        <input
                          type="email"
                          value={editInstForm.email}
                          onChange={(e) => setEditInstForm({ ...editInstForm, email: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Contact Phone</label>
                        <input
                          type="text"
                          value={editInstForm.phone}
                          onChange={(e) => setEditInstForm({ ...editInstForm, phone: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Website Address</label>
                        <input
                          type="text"
                          value={editInstForm.website}
                          onChange={(e) => setEditInstForm({ ...editInstForm, website: e.target.value })}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm text-[#EDEFF5]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-[#C2C6D1]">Physical Address</label>
                        <textarea
                          value={editInstForm.address}
                          onChange={(e) => setEditInstForm({ ...editInstForm, address: e.target.value })}
                          rows={3}
                          className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4] shadow-sm resize-none text-[#EDEFF5]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 bg-[#6E79F4] text-white px-4 py-2 rounded-lg shadow-sm font-semibold hover:bg-[#6E79F4]/95 transition-all disabled:opacity-50 text-center cursor-pointer"
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingInst(false)}
                          className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#16171D] px-4 py-2 rounded-lg font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Name</span>
                          <span className="text-sm font-semibold text-[#EDEFF5]">{inst.name}</span>
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Code</span>
                          <span className="font-mono font-semibold text-[#EDEFF5]">{inst.institution_code}</span>
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Category Type</span>
                          <span className="font-semibold text-[#EDEFF5] capitalize">{inst.institution_type}</span>
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Contact Email</span>
                          <span className="font-semibold text-[#EDEFF5]">{inst.email || <span className="text-[#C2C6D1] italic">Not Provided</span>}</span>
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Contact Phone</span>
                          <span className="font-semibold text-[#EDEFF5]">{inst.phone || <span className="text-[#C2C6D1] italic">Not Provided</span>}</span>
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Website</span>
                          {inst.website ? (
                            <a href={inst.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6E79F4] hover:underline flex items-center gap-1">
                              {inst.website} <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-[#C2C6D1] italic">Not Provided</span>
                          )}
                        </div>

                        <div className="border-b border-[#23252C]/50 pb-3">
                          <span className="block font-semibold text-[#C2C6D1] uppercase tracking-wider text-[9px] mb-1">Physical Address</span>
                          <span className="font-semibold text-[#EDEFF5] whitespace-pre-wrap">{inst.address || <span className="text-[#C2C6D1] italic">Not Provided</span>}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-6 shrink-0 border-t border-[#23252C]">
                        <button
                          onClick={() => setIsEditingInst(true)}
                          className="flex-1 bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#16171D] font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit size={14} /> Edit Details
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(inst)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        if (!isDeleteModalOpen || !instToDelete) return null;

        const deleteButtonDisabled = deleteConfirmName !== instToDelete.name || loading || checkingRelations;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden text-xs">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDeleteModalOpen(false)} />
            <div className="bg-[#131418] rounded-2xl border border-[#23252C] max-w-md w-full overflow-hidden shadow-2xl z-10 transform transition-all duration-300" style={{ animation: "modal-fade 0.2s ease-out both" }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes modal-fade {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
              `}} />
              
              <div className="p-6 border-b border-[#23252C] bg-red-50 text-red-800 flex items-center gap-2">
                <AlertCircle size={20} className="shrink-0" />
                <h3 className="font-bold text-sm">CRITICAL: Confirm Deletion</h3>
              </div>

              <div className="p-6 space-y-4">
                <p className="leading-relaxed text-[#EDEFF5]">
                  You are about to permanently delete <strong>{instToDelete.name}</strong>. This action is irreversible.
                </p>

                {checkingRelations ? (
                  <div className="flex items-center gap-2 text-[#C2C6D1]">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Checking linked resources...</span>
                  </div>
                ) : relationCounts && (relationCounts.cohorts > 0 || relationCounts.programs > 0 || relationCounts.users > 0) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold flex items-center gap-1 text-[11px]">
                      <AlertCircle size={14} /> WARN: Cascading Deletion Detected
                    </h4>
                    <p className="text-[11px] leading-normal text-amber-900">
                      Deleting this institution will cascade delete all linked data. The following records will be permanently removed from all tables:
                    </p>
                    <ul className="list-disc pl-4 text-[10px] space-y-1 font-semibold text-amber-950">
                      <li>{relationCounts.cohorts} Group(s)</li>
                      <li>{relationCounts.programs} Academic Program(s)</li>
                      <li>{relationCounts.users} User(s) (will be unlinked/tenant set to NULL)</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block font-semibold text-[#C2C6D1]">
                    Type the name of the institution to confirm (case-sensitive):
                    <span className="block text-[#EDEFF5] font-bold mt-1 select-all">{instToDelete.name}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="Type the exact name here"
                    className="w-full bg-[#131418] border border-red-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500 shadow-sm text-red-700 font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteButtonDisabled}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
                >
                  {loading ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        if (!isUserDeleteModalOpen || !userToDelete) return null;

        const deleteButtonDisabled = userDeleteConfirmEmail.trim() !== userToDelete.email || userDeleteLoading;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden text-xs">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsUserDeleteModalOpen(false)} />
            <div className="bg-[#131418] rounded-2xl border border-[#23252C] max-w-md w-full overflow-hidden shadow-2xl z-10 transform transition-all duration-300" style={{ animation: "modal-fade 0.2s ease-out both" }}>
              <div className="p-6 border-b border-[#23252C] bg-red-50 text-red-800 flex items-center gap-2">
                <AlertCircle size={20} className="shrink-0" />
                <h3 className="font-bold text-sm">CRITICAL: Confirm User Deletion</h3>
              </div>

              <div className="p-6 space-y-4">
                <p className="leading-relaxed text-[#EDEFF5]">
                  You are about to permanently delete the user <strong>{userToDelete.name}</strong> ({userToDelete.email}).
                  This will completely remove them and all their invitations, roles, and records from our system. This action is irreversible.
                </p>

                <div className="space-y-2">
                  <label className="block font-semibold text-[#C2C6D1]">
                    Type the email address of the user to confirm:
                    <span className="block text-[#EDEFF5] font-bold mt-1 select-all">{userToDelete.email}</span>
                  </label>
                  <input
                    type="text"
                    value={userDeleteConfirmEmail}
                    onChange={(e) => setUserDeleteConfirmEmail(e.target.value)}
                    placeholder="Type user's exact email here"
                    className="w-full bg-[#131418] border border-red-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500 shadow-sm text-red-700 font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-[#23252C] bg-[#16171D] flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => setIsUserDeleteModalOpen(false)}
                  className="bg-[#131418] border border-[#23252C] text-[#EDEFF5] hover:bg-[#1A1C22] font-bold py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUserDelete}
                  disabled={deleteButtonDisabled}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
                >
                  {userDeleteLoading ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      </AppShell>
    </>
  );
}
