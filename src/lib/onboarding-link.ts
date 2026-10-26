export function onboardingLink(token: string, email: string) {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) throw new Error("Invalid application URL.");
  const link = new URL("/onboarding/verify", origin.origin);
  link.searchParams.set("token", token);
  link.searchParams.set("email", email);
  return link.toString();
}
