import { describe, expect, it } from "vitest";
import { errorMessage } from "./error-message";

describe("error messages at action boundaries", () => {
  it("accepts Error and database error objects and rejects malformed values", () => {
    expect(errorMessage(new Error("Retry later"))).toBe("Retry later");
    expect(errorMessage({ message: "Database unavailable" })).toBe("Database unavailable");
    for (const value of [null, "private detail", { message: 5 }, { message: "" }]) {
      expect(errorMessage(value, "Request failed")).toBe("Request failed");
    }
  });
});
