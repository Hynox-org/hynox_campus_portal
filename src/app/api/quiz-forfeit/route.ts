import { NextResponse } from "next/server";
import { forfeitQuizAttempt } from "@/services/learning";

// Dedicated endpoint for navigator.sendBeacon — fired from a pagehide handler
// when a student closes/navigates away from an active strict-mode quiz.
// sendBeacon can't invoke a Next.js server action directly, and a normal
// fetch is unreliable during unload, so this plain route is the delivery
// mechanism for that specific case.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { attemptId, reason } = body || {};

    if (!attemptId || typeof attemptId !== "string") {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    await forfeitQuizAttempt(attemptId, typeof reason === "string" ? reason : "tab_closed");
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to forfeit quiz attempt." }, { status: 500 });
  }
}
