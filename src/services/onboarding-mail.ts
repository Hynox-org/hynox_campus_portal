import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOnboardingEmail, sendPublicPurchaseEmail } from "@/utils/email";
import { onboardingLink } from "@/lib/onboarding-link";

const labels: Record<string, string> = {
  student_onboarding: "Student", trainer_onboarding: "Teacher / Trainer",
  institution_admin_invite: "Institution Administrator", mentor_invite: "Mentor",
  super_admin_invite: "Super Administrator",
  public_course_purchase: "Public Course Learner",
};

export async function processNextOnboardingMail(client: SupabaseClient) {
  const db = client.schema("core");
  const { data: job, error } = await db.rpc("claim_onboarding_mail");
  if (error) throw new Error("Unable to claim an onboarding email.");
  if (!job) return processNextPublicPurchaseMail(client);
  let succeeded = false;
  let messageId: string | null = null;
  try {
    const response = await sendOnboardingEmail(job.email, onboardingLink(job.token, job.email), job.name || "Member",
      labels[job.invitation_type] || "Member", job.institution_name, job.token);
    messageId = response.messageId || null;
    succeeded = true;
  } catch (error) {
    // Provider errors may contain addresses or credentials; persist only the retry state.
    const failure = (error && typeof error === "object" ? error : {}) as { statusCode?: number; body?: { code?: string } };
    const code = failure.body?.code;
    console.warn("Onboarding email send failed; retry scheduled.", {
      status: typeof failure.statusCode === "number" ? failure.statusCode : null,
      code: typeof code === "string" && /^[a-z_0-9-]{1,50}$/i.test(code) ? code : "unknown",
    });
  }
  const { error: finishError } = await db.rpc("finish_onboarding_mail", {
    invitation_id: job.id, token_value: job.token, lease_value: job.lease, succeeded, message_id: messageId,
  });
  if (finishError) throw new Error("Unable to acknowledge an onboarding email; its lease will expire.");
  return true;
}

export async function processNextPublicPurchaseMail(client: SupabaseClient) {
  const db = client.schema("core");
  const { data: job, error } = await db.rpc("claim_public_purchase_mail");
  if (error) throw new Error("Unable to claim a purchase email.");
  if (!job) return false;
  let succeeded = false;
  let messageId: string | null = null;
  try {
    const response = await sendPublicPurchaseEmail(
      job.email, job.name || "Course learner", job.purchased_course,
      Array.isArray(job.courses) ? job.courses : [],
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString(),
      job.mail_kind === "duplicate_refund_review", job.idempotency_key
    );
    messageId = response.messageId || null;
    succeeded = true;
  } catch (error) {
    const failure = (error && typeof error === "object" ? error : {}) as { statusCode?: number; body?: { code?: string } };
    const code = failure.body?.code;
    console.warn("Purchase email send failed; retry scheduled.", {
      status: typeof failure.statusCode === "number" ? failure.statusCode : null,
      code: typeof code === "string" && /^[a-z_0-9-]{1,50}$/i.test(code) ? code : "unknown",
    });
  }
  const { error: finishError } = await db.rpc("finish_public_purchase_mail", {
    payment_id: job.payment_id, lease_value: job.lease, succeeded, message_id: messageId,
  });
  if (finishError) throw new Error("Unable to acknowledge a purchase email; its lease will expire.");
  return true;
}
