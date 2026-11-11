import { beforeEach, expect, it, vi } from "vitest";
const { send } = vi.hoisted(()=>({send:vi.fn()}));
vi.mock("@getbrevo/brevo",()=>({BrevoClient:class {transactionalEmails={sendTransacEmail:send};}}));
import { sendOnboardingEmail, sendPublicPurchaseEmail } from "./email";
beforeEach(()=>{send.mockReset().mockResolvedValue({messageId:"message"});});
it("escapes untrusted HTML fields and includes the provider idempotency key",async()=>{
  await sendOnboardingEmail("a@example.com","https://campus.example/onboarding?token=a&email=b","<img src=x>","Teacher","A&B","stable-key");
  const message=send.mock.calls[0][0];
  expect(message.htmlContent).not.toContain("<img src=x>");
  expect(message.htmlContent).toContain("&lt;img src=x&gt;");
  expect(message.htmlContent).toContain("A&amp;B");
  expect(message.headers).toEqual({idempotencyKey:"stable-key"});
});
it("sends an escaped purchase confirmation with the complete course list",async()=>{
  await sendPublicPurchaseEmail("a@example.com","<Buyer>","UI/UX & Design",["UI/UX & Design","Product Design"],"https://campus.example/login",false,"purchase:one");
  const message=send.mock.calls[0][0];
  expect(message.subject).toContain("Purchase confirmed");
  expect(message.htmlContent).toContain("UI/UX &amp; Design");
  expect(message.htmlContent).not.toContain("<Buyer>");
  expect(message.headers).toEqual({idempotencyKey:"purchase:one"});
});
it("does not claim a duplicate payment has already been refunded",async()=>{
  await sendPublicPurchaseEmail("a@example.com","Buyer","UI/UX Design",["UI/UX Design"],"https://campus.example/login",true,"purchase:two");
  const message=send.mock.calls[0][0];
  expect(message.subject).toContain("Duplicate purchase detected");
  expect(message.htmlContent).toContain("process the duplicate-payment refund");
  expect(message.htmlContent).not.toContain("has been refunded");
});
