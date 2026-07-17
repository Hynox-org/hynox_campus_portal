import { NextResponse } from "next/server";
import { forfeitChallengeSubmission } from "@/services/learning";

// Dedicated endpoint for navigator.sendBeacon — fired from a pagehide handler
// when a student closes/navigates away from an active strict-mode coding
// challenge. sendBeacon can't invoke a Next.js server action directly, and a
// normal fetch is unreliable during unload, so this plain route is the
// delivery mechanism for that specific case. Mirrors /api/quiz-forfeit.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { progressId, studentId, reason } = body || {};

    if (!progressId || typeof progressId !== "string") {
      return NextResponse.json({ error: "progressId is required" }, { status: 400 });
    }
    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    await forfeitChallengeSubmission(progressId, studentId, typeof reason === "string" ? reason : "tab_closed");
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to forfeit challenge attempt." }, { status: 500 });
  }
}
