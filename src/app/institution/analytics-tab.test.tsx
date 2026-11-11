// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/components/analytics-charts", () => ({
  StatTile: ({ label, value }: { label: string; value: string | number }) => <div data-testid={label}>{value}</div>,
  HBarChart: () => null, VBarChart: () => null, DonutChart: () => null,
}));
vi.mock("@/components/custom-select", () => ({ CustomSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
  <select aria-label="Cohort" value={value} onChange={event => onChange(event.target.value)}><option value="all">All</option><option value="a">A</option></select> }));
import AnalyticsTab from "./analytics-tab";
afterEach(cleanup);
it("counts a person once across programs and averages their cohort progress before ranking", () => {
  render(<AnalyticsTab cohorts={[{ id: "a", name: "A" }, { id: "b", name: "B" }]}
    enrollments={[
      { id: "1", user_id: "one", cohort_id: "a", progress_percentage: 0, student: { full_name: "Learner One" } },
      { id: "2", user_id: "one", cohort_id: "b", progress_percentage: 100, student: { full_name: "Learner One" } },
      { id: "3", user_id: "two", cohort_id: "b", progress_percentage: 100, student: { full_name: "Learner Two" } },
    ]} activities={[]} quizAttempts={[]} projectSubmissions={[]} challengeSubmissions={[]} cohortReports={{}} />);
  expect(screen.getByTestId("Students").textContent).toBe("2");
  expect(screen.getByTestId("Avg Progress").textContent).toBe("75%");
  // One ranking row plus one attention row, rather than two duplicate rankings.
  expect(screen.getAllByText("Learner One")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Cohort"), { target: { value: "a" } });
  expect(screen.getByTestId("Students").textContent).toBe("1");
  expect(screen.getByTestId("Avg Progress").textContent).toBe("0%");
});
