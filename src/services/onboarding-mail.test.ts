import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/utils/email", () => ({ sendOnboardingEmail: vi.fn(), sendPublicPurchaseEmail: vi.fn() }));
import { sendOnboardingEmail, sendPublicPurchaseEmail } from "@/utils/email";
import { processNextOnboardingMail, processNextPublicPurchaseMail } from "./onboarding-mail";
const job={id:"invitation",token:"token",lease:"lease",email:"student@example.com",name:"Student",invitation_type:"student_onboarding",institution_name:"Campus"};
const rpc=vi.fn();
const client={schema:()=>({rpc})} as unknown as SupabaseClient;
beforeEach(()=>{vi.clearAllMocks();rpc.mockReset().mockResolvedValueOnce({data:job,error:null}).mockResolvedValue({data:true,error:null});vi.mocked(sendOnboardingEmail).mockResolvedValue({messageId:"message"});vi.mocked(sendPublicPurchaseEmail).mockResolvedValue({messageId:"purchase-message"});});
it("uses a stable idempotency key and acknowledges provider acceptance",async()=>{
  expect(await processNextOnboardingMail(client)).toBe(true);
  expect(sendOnboardingEmail).toHaveBeenCalledWith(job.email,expect.stringContaining("token=token"),job.name,"Student",job.institution_name,job.token);
  expect(rpc).toHaveBeenLastCalledWith("finish_onboarding_mail",{invitation_id:job.id,token_value:job.token,lease_value:job.lease,succeeded:true,message_id:"message"});
});
it("labels purchase onboarding as public course access",async()=>{
  rpc.mockReset().mockResolvedValueOnce({data:{...job,invitation_type:"public_course_purchase"},error:null}).mockResolvedValue({data:true,error:null});
  await processNextOnboardingMail(client);
  expect(sendOnboardingEmail).toHaveBeenCalledWith(job.email,expect.any(String),job.name,"Public Course Learner",job.institution_name,job.token);
});
it("records a failed attempt without exposing provider errors",async()=>{
  const warning=vi.spyOn(console,"warn").mockImplementation(()=>{});
  vi.mocked(sendOnboardingEmail).mockRejectedValue(new Error("private provider details"));
  await processNextOnboardingMail(client);
  expect(rpc.mock.calls[1][1]).toMatchObject({succeeded:false,message_id:null});
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("private provider details");
  expect(JSON.stringify(warning.mock.calls)).not.toContain("private provider details");
  warning.mockRestore();
});
it.each([null,"private provider details"])("handles non-object provider failures safely: %s",async failure=>{
  const warning=vi.spyOn(console,"warn").mockImplementation(()=>{});
  vi.mocked(sendOnboardingEmail).mockRejectedValue(failure);
  await expect(processNextOnboardingMail(client)).resolves.toBe(true);
  expect(rpc.mock.calls[1][1]).toMatchObject({succeeded:false});
  expect(JSON.stringify(warning.mock.calls)).not.toContain("private provider details");
  warning.mockRestore();
});
it("does nothing when no job is claimable",async()=>{
  rpc.mockReset().mockResolvedValue({data:null,error:null});
  expect(await processNextOnboardingMail(client)).toBe(false);expect(sendOnboardingEmail).not.toHaveBeenCalled();
});
it("fails safely on acknowledgement errors so the lease can recover",async()=>{
  rpc.mockReset().mockResolvedValueOnce({data:job,error:null}).mockResolvedValueOnce({error:{message:"private"}});
  await expect(processNextOnboardingMail(client)).rejects.toThrow(/lease will expire/);
});
it("falls through to purchase confirmations when onboarding is empty",async()=>{
  const purchase={payment_id:7,lease:"lease",email:"buyer@example.com",name:"Buyer",purchased_course:"Product Design",courses:["Product Design","UI/UX Design"],mail_kind:"purchase_confirmation",payment_reference:"order-7"};
  rpc.mockReset().mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:purchase,error:null}).mockResolvedValue({data:true,error:null});
  expect(await processNextOnboardingMail(client)).toBe(true);
  expect(sendPublicPurchaseEmail).toHaveBeenCalledWith(purchase.email,purchase.name,purchase.purchased_course,purchase.courses,expect.stringContaining("/login"),false,"purchase:order-7");
  expect(rpc).toHaveBeenLastCalledWith("finish_public_purchase_mail",{payment_id:7,lease_value:"lease",succeeded:true,message_id:"purchase-message"});
});
it("sends duplicate-purchase notices through the purchase queue",async()=>{
  const purchase={payment_id:8,lease:"lease",email:"buyer@example.com",name:"Buyer",purchased_course:"UI/UX Design",courses:["UI/UX Design"],mail_kind:"duplicate_refund_review",payment_reference:"order-8"};
  rpc.mockReset().mockResolvedValueOnce({data:purchase,error:null}).mockResolvedValue({data:true,error:null});
  await processNextPublicPurchaseMail(client);
  expect(sendPublicPurchaseEmail).toHaveBeenCalledWith(purchase.email,purchase.name,purchase.purchased_course,purchase.courses,expect.any(String),true,"purchase:order-8");
});
