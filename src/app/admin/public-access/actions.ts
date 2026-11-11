"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const purchaseCodes = new Set([
  "ui-ux-design", "product-design", "d2c-mentorship", "full-stack-development",
  "digital-marketing", "management-consulting", "ai-machine-learning",
]);

async function requireSuperAdmin() {
  const current = await getCurrentUser();
  const user = current?.user;
  if (!current || !user || current.primaryRole !== "super_admin") throw new Error("Access denied.");
  return { ...current, user };
}

export async function saveOfferingAction(formData: FormData) {
  await requireSuperAdmin();
  const purchaseCode = String(formData.get("purchaseCode") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  const courseTemplateId = String(formData.get("courseTemplateId") || "");
  if (!purchaseCodes.has(purchaseCode) || !displayName || displayName.length > 160 || !uuid.test(courseTemplateId)) {
    throw new Error("Invalid course offering.");
  }
  const supabase = await createClient();
  const { error } = await supabase.schema("delivery").from("public_course_offerings").upsert({
    purchase_code: purchaseCode, display_name: displayName, course_template_id: courseTemplateId, active: true, updated_at: new Date().toISOString(),
  }, { onConflict: "purchase_code" });
  if (error) throw new Error("Unable to save the course mapping.");
  revalidatePath("/admin/public-access");
}

export async function setEntitlementStatusAction(formData: FormData) {
  const current = await requireSuperAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!uuid.test(id) || !["active", "revoked"].includes(status)) throw new Error("Invalid access update.");
  const supabase = await createClient();
  const { error } = await supabase.schema("delivery").from("public_course_entitlements").update({
    status,
    revoked_at: status === "revoked" ? new Date().toISOString() : null,
    revoked_by: status === "revoked" ? current.user.id : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error("Unable to update course access.");
  revalidatePath("/admin/public-access");
}

export async function retryProvisionAction(formData: FormData) {
  await requireSuperAdmin();
  const paymentId = String(formData.get("paymentId") || "");
  if (!/^\d+$/.test(paymentId)) throw new Error("Invalid payment.");
  const admin = createAdminClient();
  const { error } = await admin.schema("core").rpc("provision_public_purchase", { payment_id: paymentId });
  if (error) throw new Error("Access provisioning is still blocked. Check the course mapping.");
  revalidatePath("/admin/public-access");
}
