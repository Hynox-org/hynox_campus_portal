import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOnboardingEmail } from "@/utils/email";
import { onboardingLink } from "@/lib/onboarding-link";

const labels: Record<string, string> = {
  student_onboarding: "Student", trainer_onboarding: "Teacher / Trainer",
  institution_admin_invite: "Institution Administrator", mentor_invite: "Mentor",
  super_admin_invite: "Super Administrator",
};

export async function processNextOnboardingMail(client: SupabaseClient) {
  const db = client.schema("core");
  const { data: job, error } = await db.rpc("claim_onboarding_mail");
  if (error) throw new Error("Unable to claim an onboarding email.");
  if (!job) return false;
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
