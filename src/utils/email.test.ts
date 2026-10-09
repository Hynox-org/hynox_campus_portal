import { afterEach, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("@getbrevo/brevo", () => ({ BrevoClient: class { transactionalEmails = { sendTransacEmail: send }; } }));
import { sendOnboardingEmail } from "./email";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("does not send activation emails during a demo", async () => {
  vi.stubEnv("DEMO_MODE", "true");
  await sendOnboardingEmail("demo@example.test", "/demo", "Demo", "Student", "Campus");
  expect(send).not.toHaveBeenCalled();
});

it("preserves email delivery when authentication is enabled", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  await sendOnboardingEmail("demo@example.test", "/invite", "Demo", "Student", "Campus");
  expect(send).toHaveBeenCalledOnce();
});
