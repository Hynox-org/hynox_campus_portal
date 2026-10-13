import { after } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/server", () => ({after:vi.fn()}));
vi.mock("@/services/learning", () => ({submitChallengeCode:vi.fn(async()=>({id:"submission-1"}))}));
vi.mock("@/services/runner", () => ({executeAllTestsAndGrade:vi.fn(async()=>{})}));
import { executeAllTestsAndGrade } from "@/services/runner";
import { submitChallengeCodeAction } from "./learning-actions";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("keeps automatic grading in the serverless request lifecycle", async()=>{
  vi.stubEnv("JUDGE_WORKER_ENABLED","false");
  const result=await submitChallengeCodeAction("challenge-1","student-1","new","python","print(1)");
  expect(result.submission?.id).toBe("submission-1");
  expect(executeAllTestsAndGrade).not.toHaveBeenCalled();
  const callback=vi.mocked(after).mock.calls[0][0] as ()=>Promise<void>;
  await callback();
  expect(executeAllTestsAndGrade).toHaveBeenCalledWith("submission-1");
});
it("does not duplicate grading when a separate worker is enabled", async()=>{
  vi.stubEnv("JUDGE_WORKER_ENABLED","true");
  await submitChallengeCodeAction("challenge-1","student-1","new","python","print(1)");
  expect(after).not.toHaveBeenCalled();
});
