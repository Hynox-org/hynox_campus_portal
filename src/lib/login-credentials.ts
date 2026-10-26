export function loginCredentials(formData: FormData) {
  const email = formData.get("email"), password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;
  const normalized = email.trim();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !password || password.length > 4096) return null;
  return { email: normalized, password };
}
