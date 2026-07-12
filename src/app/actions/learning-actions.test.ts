import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  listAllActivitiesAction, 
  getActivityDetailsNoStudentAction, 
  listActivityProgressAction,
  listQuizAttemptsAction
} from "./learning-actions";

// Mock the services module
vi.mock("@/services/learning", () => ({
  listAllActivities: vi.fn(),
  getQuizDetails: vi.fn(),
  getProgrammingChallengeDetails: vi.fn(),
  getProjectDetails: vi.fn()
}));

// Define query mocks per table
const quizQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "quiz-1", activity_id: "act-1", shuffle_questions: true }, error: null })
};

const questionsQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: "q-1", quiz_id: "quiz-1", question_text: "React question", points: 10 }], error: null })
};

const optionsQueryMock = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: "opt-1", question_id: "q-1", option_text: "Option A", is_correct: true }], error: null })
};

const projectQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "proj-1", activity_id: "act-2", overview: "React Project" }, error: null })
};

const challengeQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "chal-1", activity_id: "act-3" }, error: null })
};

const examplesQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: "ex-1", input_example: "in", output_example: "out" }], error: null })
};

const testCasesQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: "tc-1", input_data: "tc_in", expected_output: "tc_out" }], error: null })
};

const assignmentsQueryMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockResolvedValue({ data: [{ id: "assign-1" }], error: null })
};

const progressQueryMock = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: "prog-1", student_id: "stud-1", score: 80 }], error: null })
};

const usersQueryMock = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockResolvedValue({ data: [{ id: "stud-1", full_name: "Jane Doe", email: "jane@doe.com" }], error: null })
};

// Router mock based on table name
const fromMock = vi.fn((tableName) => {
  switch (tableName) {
    case "quizzes": return quizQueryMock;
    case "quiz_questions": return questionsQueryMock;
    case "quiz_options": return optionsQueryMock;
    case "projects": return projectQueryMock;
    case "programming_challenges": return challengeQueryMock;
    case "challenge_examples": return examplesQueryMock;
    case "challenge_test_cases": return testCasesQueryMock;
    case "activity_assignments": return assignmentsQueryMock;
    case "student_activity_progress": return progressQueryMock;
    case "users": return usersQueryMock;
    default: return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
  }
});

// Mock Supabase client creator
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    schema: vi.fn().mockReturnValue({
      from: fromMock
    })
  }))
}));

import * as service from "@/services/learning";

describe("learning-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAllActivitiesAction", () => {
    it("should return activities on success", async () => {
      const mockActivities = [{ id: "act-1", title: "React Test" }];
      vi.mocked(service.listAllActivities).mockResolvedValue(mockActivities);

      const result = await listAllActivitiesAction("tenant-123");
      expect(result).toEqual({ activities: mockActivities });
      expect(service.listAllActivities).toHaveBeenCalledWith("tenant-123");
    });

    it("should return error message on failure", async () => {
      vi.mocked(service.listAllActivities).mockRejectedValue(new Error("Database connection timed out"));

      const result = await listAllActivitiesAction("tenant-123");
      expect(result).toEqual({ error: "Database connection timed out" });
    });
  });

  describe("getActivityDetailsNoStudentAction", () => {
    it("should fetch quiz details correctly without checking student attempts", async () => {
      const result = await getActivityDetailsNoStudentAction("act-1", "quiz") as any;

      expect(result).toHaveProperty("quiz");
      expect(result).toHaveProperty("questions");
      expect(result.questions[0].options).toHaveLength(1);
      expect(result.questions[0].options[0].option_text).toBe("Option A");
    });

    it("should fetch project details correctly", async () => {
      const result = await getActivityDetailsNoStudentAction("act-2", "project") as any;
      expect(result).toHaveProperty("project");
      expect(result.project.overview).toBe("React Project");
    });

    it("should fetch programming challenge details correctly", async () => {
      const result = await getActivityDetailsNoStudentAction("act-3", "programming") as any;
      expect(result).toHaveProperty("challenge");
      expect(result).toHaveProperty("examples");
      expect(result).toHaveProperty("testCases");
    });
  });

  describe("listActivityProgressAction", () => {
    it("should fetch and compile progress with user details correctly", async () => {
      const result = await listActivityProgressAction("act-1") as any;
      expect(result).toHaveProperty("progress");
      expect(result.progress).toHaveLength(1);
      expect(result.progress[0].student.full_name).toBe("Jane Doe");
    });
  });

  describe("listQuizAttemptsAction", () => {
    it("should return empty attempts when database is mocked to return nothing", async () => {
      const result = await listQuizAttemptsAction("tenant-123") as any;
      expect(result).toHaveProperty("attempts");
    });
  });
});
