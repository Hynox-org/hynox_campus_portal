// The dev branch is the demo build. Set DEMO_MODE=false to use normal login.
export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}

export const DEMO_ROLE_COOKIE = "hynox-demo-role";
export const DEMO_ROLE_HEADER = "x-hynox-demo-role";

export const DEMO_USERS = {
  super_admin: "063c4d31-d485-48d8-96f9-c0c03547fddd",
  institution_admin: "c4b02753-7566-47e2-aec7-9bb888d7bb51",
  teacher: "bdf6e7e8-8ab0-45f2-bd55-8051d2d41a95",
  student: "30750469-6c37-4c5e-bbf3-bd2f7c1bf619",
} as const;

export type DemoRole = keyof typeof DEMO_USERS;

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return !!value && Object.hasOwn(DEMO_USERS, value);
}

export function resolveDemoRole(pathname: string, selectedRole?: string): DemoRole {
  const routes: Record<string, DemoRole> = {
    admin: "super_admin",
    institution: "institution_admin",
    teacher: "teacher",
    student: "student",
  };
  const segment = pathname.split("/")[1];
  return Object.hasOwn(routes, segment) ? routes[segment] : (isDemoRole(selectedRole) ? selectedRole : "student");
}
