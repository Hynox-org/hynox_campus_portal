import { beforeEach, expect, it, vi } from "vitest";
const { send } = vi.hoisted(()=>({send:vi.fn()}));
vi.mock("@getbrevo/brevo",()=>({BrevoClient:class {transactionalEmails={sendTransacEmail:send};}}));
import { sendOnboardingEmail } from "./email";
beforeEach(()=>{send.mockReset().mockResolvedValue({messageId:"message"});});
it("escapes untrusted HTML fields and includes the provider idempotency key",async()=>{
  await sendOnboardingEmail("a@example.com","https://campus.example/onboarding?token=a&email=b","<img src=x>","Teacher","A&B","stable-key");
  const message=send.mock.calls[0][0];
  expect(message.htmlContent).not.toContain("<img src=x>");
  expect(message.htmlContent).toContain("&lt;img src=x&gt;");
  expect(message.htmlContent).toContain("A&amp;B");
  expect(message.headers).toEqual({idempotencyKey:"stable-key"});
});
