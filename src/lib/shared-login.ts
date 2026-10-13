export const SHARED_ROLE_COOKIE = "campus-dashboard-role";
export const SHARED_ROLE_HEADER = "x-campus-dashboard-role";
export const SHARED_DASHBOARDS = {
  super_admin: { label: "Admin", path: "/admin" },
  institution_admin: { label: "Institution Admin", path: "/institution" },
  teacher: { label: "Teacher", path: "/teacher" },
  student: { label: "Student", path: "/student" },
} as const;

export function isSharedLogin(user: { app_metadata?: Record<string, unknown> } | null) {
  return user?.app_metadata?.shared_dashboard_login === true;
}

export function selectedSharedRole(value: string | undefined, authId: string, assignedRoles: string[]) {
  const [id, role] = (value || "").split(":");
  return id === authId && value === `${id}:${role}` && Object.hasOwn(SHARED_DASHBOARDS, role) && assignedRoles.includes(role)
    ? role : null;
}
