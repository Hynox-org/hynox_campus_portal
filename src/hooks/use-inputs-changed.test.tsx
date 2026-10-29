// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { useInputsChanged } from "./use-inputs-changed";

describe("selection snapshot changes", () => {
  it("adjusts local state once per changed input and preserves it otherwise", () => {
    const { result, rerender } = renderHook(({ input }) => {
      const [selection, setSelection] = useState(input);
      if (useInputsChanged([input])) setSelection(input);
      return { selection, setSelection };
    }, { initialProps: { input: "first" } });
    expect(result.current.selection).toBe("first");
    act(() => result.current.setSelection("local edit"));
    rerender({ input: "first" });
    expect(result.current.selection).toBe("local edit");
    rerender({ input: "second" });
    expect(result.current.selection).toBe("second");
    rerender({ input: "second" });
    expect(result.current.selection).toBe("second");
  });
});
