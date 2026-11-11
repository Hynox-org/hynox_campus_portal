import { NextResponse } from "next/server";
import { forfeitQuizAttempt } from "@/services/learning";
import { institutionIdPattern } from "@/lib/institution-validation";

// Dedicated endpoint for navigator.sendBeacon — fired from a pagehide handler
// when a student closes/navigates away from an active strict-mode quiz.
// sendBeacon can't invoke a Next.js server action directly, and a normal
// fetch is unreliable during unload, so this plain route is the delivery
// mechanism for that specific case.
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const text = await request.text();
    if (text.length > 2048) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
    const { attemptId, reason } = body || {};

    if (typeof attemptId !== "string" || !institutionIdPattern.test(attemptId) ||
      (reason !== undefined && (typeof reason !== "string" || !reason.trim() || reason.length > 200))) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    await forfeitQuizAttempt(attemptId, typeof reason === "string" ? reason : "tab_closed");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to confirm quiz forfeit. Retry when connected." }, { status: 500 });
  }
}
