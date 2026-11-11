import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { retryProvisionAction, saveOfferingAction, setEntitlementStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const products = [
  ["ui-ux-design", "UI/UX Design"], ["product-design", "Product Design"],
  ["d2c-mentorship", "D2C Mentorship"], ["full-stack-development", "Full Stack Dev"],
  ["digital-marketing", "Digital Marketing"], ["management-consulting", "Management Consulting"],
  ["ai-machine-learning", "AI & Machine Learning"],
] as const;

export default async function PublicAccessPage() {
  const current = await getCurrentUser();
  if (!current || current.primaryRole !== "super_admin") redirect("/login");
  const admin = createAdminClient();
  const [courseResult, offeringResult, entitlementResult, userResult, paymentResult] = await Promise.all([
    admin.schema("library").from("course_templates").select("id,title,slug").eq("is_published", true).is("deleted_at", null).order("title"),
    admin.schema("delivery").from("public_course_offerings").select("*").order("display_name"),
    admin.schema("delivery").from("public_course_entitlements").select("*").order("created_at", { ascending: false }),
    admin.schema("core").from("users").select("id,email,full_name").is("deleted_at", null),
    admin.from("hynox_campus_payments").select("id,customer_email,course_name,course_code,merchant_order_id,portal_provision_status,portal_provision_error").eq("payment_status", "COMPLETED").neq("portal_provision_status", "COMPLETED").order("created_at", { ascending: false }),
  ]);
  if (courseResult.error || offeringResult.error || entitlementResult.error || userResult.error || paymentResult.error) {
    throw new Error("Unable to load public access administration.");
  }
  const courses = courseResult.data || [];
  const offerings = offeringResult.data || [];
  const entitlements = entitlementResult.data || [];
  const users = new Map((userResult.data || []).map(user => [user.id, user]));
  const courseNames = new Map(courses.map(course => [course.id, course.title]));
  const field = "rounded-lg border border-[#343846] bg-[#111319] px-3 py-2 text-sm text-[#EDEFF5]";
  const button = "rounded-lg bg-[#6E79F4] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50";

  return <main className="min-h-screen bg-[#0B0C0F] px-6 py-10 text-[#EDEFF5]">
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#6E79F4]">Super admin</p><h1 className="mt-2 text-3xl font-semibold">Public course access</h1></div><Link href="/admin" className="text-sm text-[#8D96FF]">Back to dashboard</Link></header>
      <section className="rounded-2xl border border-[#2B2E37] bg-[#131418] p-6"><h2 className="font-semibold">Landing-page course mappings</h2><p className="mt-2 text-xs text-[#9BA1AE]">Every purchasable product must point to one portal course before access can be issued.</p>
        {!courses.length && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Create the portal courses first. There are currently no courses available to map.</p>}
        <div className="mt-5 grid gap-3">{products.map(([code, name]) => { const mapped = offerings.find(item => item.purchase_code === code); return <form action={saveOfferingAction} key={code} className="grid gap-3 rounded-xl border border-[#2B2E37] p-4 md:grid-cols-[1fr_2fr_auto]">
          <input type="hidden" name="purchaseCode" value={code}/><input type="hidden" name="displayName" value={name}/><div><p className="text-sm font-medium">{name}</p><p className="text-[10px] text-[#8B91A0]">{code}</p></div>
          <select name="courseTemplateId" className={field} defaultValue={mapped?.course_template_id || ""} required><option value="">Select library blueprint</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
          <button className={button} disabled={!courses.length}>Save mapping</button>
        </form>; })}</div>
      </section>
      {!!paymentResult.data?.length && <section className="rounded-2xl border border-red-500/30 bg-[#131418] p-6"><h2 className="font-semibold">Access requiring attention</h2><div className="mt-4 space-y-3">{paymentResult.data.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#343846] p-4"><div><p className="text-sm">{payment.customer_email} · {payment.course_name}</p><p className="mt-1 text-[10px] text-[#9BA1AE]">{payment.portal_provision_error || "Waiting for provisioning"}</p></div><form action={retryProvisionAction}><input type="hidden" name="paymentId" value={payment.id}/><button className={button}>Retry access</button></form></div>)}</div></section>}
      <section className="rounded-2xl border border-[#2B2E37] bg-[#131418] p-6"><h2 className="font-semibold">Buyer access</h2>{!entitlements.length ? <p className="mt-4 text-sm text-[#9BA1AE]">No public course entitlements yet.</p> : <div className="mt-4 space-y-3">{entitlements.map(item => { const user = users.get(item.user_id); return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#343846] p-4"><div><p className="text-sm font-medium">{user?.full_name || "Learner"} · {user?.email}</p><p className="mt-1 text-xs text-[#9BA1AE]">{courseNames.get(item.course_template_id) || item.purchase_code} · {item.payment_reference}</p></div><form action={setEntitlementStatusAction}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value={item.status === "active" ? "revoked" : "active"}/><button className={item.status === "active" ? "rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300" : button}>{item.status === "active" ? "Remove access" : "Restore access"}</button></form></div>; })}</div>}</section>
    </div>
  </main>;
}
