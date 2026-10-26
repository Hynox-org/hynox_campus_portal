// Only application paths may be carried through an OAuth redirect.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/") && !decoded.startsWith("//") && !/[\\\u0000-\u0020]/.test(decoded) ? value : "/";
  } catch { return "/"; }
}
