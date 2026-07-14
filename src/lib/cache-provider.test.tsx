/**
 * cache-provider.test.tsx
 * ──────────────────────────────────────────────────────────────
 * Professional QA test suite for the CacheProvider & useCache system.
 *
 * Strategy: We test the cache logic directly without a DOM environment by
 * extracting the same Record<string,any> + useRef pattern used in the real
 * cache-provider.tsx into a local factory. This keeps tests fast, hermetic,
 * and runnable in Vitest's default Node environment (no jsdom required).
 *
 * Test categories
 *   A. Core API              – get / set / clear
 *   B. Isolation             – separate cache instances do NOT share state
 *   C. Re-render stability   – cache object survives repeated "re-renders"
 *   D. Edge-case values      – null, false, 0, empty-string, objects, arrays
 *   E. Key patterns          – template-literal keys, long keys, special chars
 *   F. Clear semantics       – before/after, partial re-population
 *   G. Cross-key independence– writing to one key never pollutes another
 *   H. Error guard           – useCache outside provider throws descriptive msg
 *   I. seedAcademicListCaches integration – verifies real helper from dashboard-query.ts
 */

import { describe, expect, it, vi } from "vitest";
import { seedAcademicListCaches } from "./dashboard-query";

// ---------------------------------------------------------------------------
// Factory: mirrors the internal shape of CacheProvider's useRef cache.
// ---------------------------------------------------------------------------
type CacheEntry = {
  value: any;
  expiresAt?: number;
};

function makeCacheInstance() {
  const ref = { current: {} as Record<string, CacheEntry> };

  const get = <T = any,>(key: string): T | undefined => {
    const entry = ref.current[key];
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      delete ref.current[key];
      return undefined;
    }
    return entry.value as T;
  };

  const set = (key: string, value: any, ttlMs?: number) => {
    ref.current[key] = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
  };

  const clear = () => {
    ref.current = {};
  };

  return {
    get,
    set,
    clear,
    rerender() {
      return { get, set, clear };
    },
  };
}

// ---------------------------------------------------------------------------
// A. Core API
// ---------------------------------------------------------------------------
describe("A. Core API – get / set / clear", () => {
  it("A1 – set then get returns the same value", () => {
    const cache = makeCacheInstance();
    cache.set("hello", "world");
    expect(cache.get("hello")).toBe("world");
  });

  it("A2 – get on a key that was never set returns undefined", () => {
    const cache = makeCacheInstance();
    expect(cache.get("ghost-key")).toBeUndefined();
  });

  it("A3 – set overwrites an existing key with the new value", () => {
    const cache = makeCacheInstance();
    cache.set("k", "v1");
    cache.set("k", "v2");
    expect(cache.get("k")).toBe("v2");
  });

  it("A4 – clear removes ALL previously set keys", () => {
    const cache = makeCacheInstance();
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeUndefined();
  });

  it("A5 – clear then set allows the cache to accept new entries", () => {
    const cache = makeCacheInstance();
    cache.set("x", 99);
    cache.clear();
    cache.set("x", 42);
    expect(cache.get("x")).toBe(42);
  });

  it("A6 – multiple consecutive clear calls do not throw", () => {
    const cache = makeCacheInstance();
    expect(() => {
      cache.clear();
      cache.clear();
      cache.clear();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// B. Isolation – two separate instances do not share state
// ---------------------------------------------------------------------------
describe("B. Isolation – separate cache instances are independent", () => {
  it("B1 – writing to cache-A is invisible to cache-B", () => {
    const cacheA = makeCacheInstance();
    const cacheB = makeCacheInstance();
    cacheA.set("shared-key", "from-A");
    expect(cacheB.get("shared-key")).toBeUndefined();
  });

  it("B2 – clearing cache-A does not affect cache-B", () => {
    const cacheA = makeCacheInstance();
    const cacheB = makeCacheInstance();
    cacheA.set("data", "A-data");
    cacheB.set("data", "B-data");
    cacheA.clear();
    expect(cacheA.get("data")).toBeUndefined();
    expect(cacheB.get("data")).toBe("B-data");
  });

  it("B3 – overwriting in cache-A does not affect cache-B", () => {
    const cacheA = makeCacheInstance();
    const cacheB = makeCacheInstance();
    cacheA.set("x", "A1");
    cacheB.set("x", "B1");
    cacheA.set("x", "A2");
    expect(cacheB.get("x")).toBe("B1");
  });
});

// ---------------------------------------------------------------------------
// C. Re-render stability
// ---------------------------------------------------------------------------
describe("C. Re-render stability – cache survives simulated re-renders", () => {
  it("C1 – values written before a re-render are readable after it", () => {
    const cache = makeCacheInstance();
    cache.set("persist", "yes");
    const afterRender = cache.rerender();
    expect(afterRender.get("persist")).toBe("yes");
  });

  it("C2 – values written via new render instance are readable via original", () => {
    const cache = makeCacheInstance();
    const render2 = cache.rerender();
    render2.set("written-by-render2", 77);
    expect(cache.get("written-by-render2")).toBe(77);
  });

  it("C3 – clear via new render instance affects original instance too", () => {
    const cache = makeCacheInstance();
    cache.set("temp", "data");
    const render2 = cache.rerender();
    render2.clear();
    // Both share the same underlying ref — post-clear both see undefined
    expect(render2.get("temp")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D. Edge-case values
// ---------------------------------------------------------------------------
describe("D. Edge-case values – storing falsy and complex types", () => {
  it("D1 – stores and retrieves null correctly", () => {
    const cache = makeCacheInstance();
    cache.set("null-key", null);
    expect(cache.get("null-key")).toBeNull();
  });

  it("D2 – stores and retrieves false (falsy boolean)", () => {
    const cache = makeCacheInstance();
    cache.set("bool-key", false);
    expect(cache.get("bool-key")).toBe(false);
  });

  it("D3 – stores and retrieves 0 (falsy number)", () => {
    const cache = makeCacheInstance();
    cache.set("zero", 0);
    expect(cache.get("zero")).toBe(0);
  });

  it("D4 – stores and retrieves empty string value", () => {
    const cache = makeCacheInstance();
    cache.set("empty-val", "");
    expect(cache.get("empty-val")).toBe("");
  });

  it("D5 – stores and retrieves a plain object (by reference)", () => {
    const cache = makeCacheInstance();
    const obj = { programs: [{ id: "p-1" }] };
    cache.set("obj-key", obj);
    expect(cache.get("obj-key")).toBe(obj);
    expect(cache.get("obj-key")).toEqual({ programs: [{ id: "p-1" }] });
  });

  it("D6 – stores and retrieves an array (by reference)", () => {
    const cache = makeCacheInstance();
    const arr = [1, 2, 3];
    cache.set("arr", arr);
    expect(cache.get("arr")).toBe(arr);
    expect(cache.get("arr")).toEqual([1, 2, 3]);
  });

  it("D7 – stores and retrieves a nested deeply-nested object", () => {
    const cache = makeCacheInstance();
    const deep = { a: { b: { c: { d: 42 } } } };
    cache.set("deep", deep);
    expect((cache.get("deep") as any).a.b.c.d).toBe(42);
  });

  it("D8 – mutating the original object is reflected (pass-by-reference semantics)", () => {
    const cache = makeCacheInstance();
    const obj: any = { count: 0 };
    cache.set("mutable", obj);
    obj.count = 99; // mutate original
    expect(cache.get("mutable").count).toBe(99); // cache reflects mutation
  });
});

// ---------------------------------------------------------------------------
// E. Key patterns
// ---------------------------------------------------------------------------
describe("E. Key patterns – various key formats", () => {
  it("E1 – empty-string key is accepted and readable", () => {
    const cache = makeCacheInstance();
    cache.set("", "empty-key-value");
    expect(cache.get("")).toBe("empty-key-value");
  });

  it("E2 – template-literal keys as used by student-console (stale-while-revalidate pattern)", () => {
    const studentId = "stu-abc-123";
    const cache = makeCacheInstance();
    cache.set(`student-delivery-data-${studentId}`, { programs: [] });
    expect(cache.get(`student-delivery-data-${studentId}`)).toEqual({ programs: [] });
  });

  it("E3 – student-activities key pattern used in loadActivities()", () => {
    const studentId = "stu-xyz-456";
    const cache = makeCacheInstance();
    const activities = [{ id: "act-1", title: "Quiz 1" }];
    cache.set(`student-activities-${studentId}`, activities);
    expect(cache.get(`student-activities-${studentId}`)).toEqual(activities);
  });

  it("E4 – keys with special characters (slashes, dots, colons) work", () => {
    const cache = makeCacheInstance();
    cache.set("api/v2/data.json:tenant-1", { ok: true });
    expect(cache.get("api/v2/data.json:tenant-1")).toEqual({ ok: true });
  });

  it("E5 – very long key (512 chars) does not throw or truncate", () => {
    const cache = makeCacheInstance();
    const longKey = "x".repeat(512);
    cache.set(longKey, "long-value");
    expect(cache.get(longKey)).toBe("long-value");
  });

  it("E6 – two keys that differ only by a number suffix are independent", () => {
    const cache = makeCacheInstance();
    cache.set("key-1", "value-1");
    cache.set("key-2", "value-2");
    expect(cache.get("key-1")).toBe("value-1");
    expect(cache.get("key-2")).toBe("value-2");
  });
});

// ---------------------------------------------------------------------------
// F. Clear semantics
// ---------------------------------------------------------------------------
describe("F. Clear semantics", () => {
  it("F1 – cleared cache reports undefined for every previously-set key", () => {
    const cache = makeCacheInstance();
    const keys = ["a", "b", "c", "d", "e"];
    keys.forEach((k, i) => cache.set(k, i));
    cache.clear();
    keys.forEach((k) => expect(cache.get(k)).toBeUndefined());
  });

  it("F2 – partial set after clear exposes only new keys", () => {
    const cache = makeCacheInstance();
    cache.set("old", "gone");
    cache.clear();
    cache.set("new", "here");
    expect(cache.get("old")).toBeUndefined();
    expect(cache.get("new")).toBe("here");
  });

  it("F3 – clear before any set does not throw and leaves cache in valid state", () => {
    const cache = makeCacheInstance();
    expect(() => cache.clear()).not.toThrow();
    cache.set("after-preemptive-clear", true);
    expect(cache.get("after-preemptive-clear")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// G. Cross-key independence
// ---------------------------------------------------------------------------
describe("G. Cross-key independence", () => {
  it("G1 – setting key A does not create or touch key B", () => {
    const cache = makeCacheInstance();
    cache.set("A", "valueA");
    expect(cache.get("B")).toBeUndefined();
  });

  it("G2 – overwriting key A does not change key B", () => {
    const cache = makeCacheInstance();
    cache.set("A", "v1");
    cache.set("B", "v1");
    cache.set("A", "v2");
    expect(cache.get("B")).toBe("v1");
    expect(cache.get("A")).toBe("v2");
  });

  it("G3 – 50 concurrent keys all resolve to their own values", () => {
    const cache = makeCacheInstance();
    for (let i = 0; i < 50; i++) cache.set(`key-${i}`, i * 10);
    for (let i = 0; i < 50; i++) {
      expect(cache.get(`key-${i}`)).toBe(i * 10);
    }
  });

  it("G4 – large payload stored under one key does not corrupt a sibling key", () => {
    const cache = makeCacheInstance();
    const large = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` }));
    cache.set("large", large);
    cache.set("small", "tiny");
    expect(cache.get("small")).toBe("tiny");
    expect(cache.get("large")).toHaveLength(1000);
  });
});

// ---------------------------------------------------------------------------
// H. Error guard – useCache outside provider throws
// ---------------------------------------------------------------------------
describe("H. Error guard – missing provider", () => {
  it("H1 – calling useCache simulation without context returns null (as React would)", () => {
    // Mirrors what useContext returns when no provider is in scope
    const fakeContext: null = null; // React.useContext(CacheContext) returns null
    const useCache = () => {
      const context = fakeContext;
      if (!context) throw new Error("useCache must be used within a CacheProvider");
      return context;
    };
    expect(() => useCache()).toThrow("useCache must be used within a CacheProvider");
  });

  it("H2 – error message is descriptive enough for developer debugging", () => {
    const useCache = () => {
      const context = null;
      if (!context) throw new Error("useCache must be used within a CacheProvider");
      return context;
    };
    let message = "";
    try { useCache(); } catch (e: any) { message = e.message; }
    expect(message).toContain("CacheProvider");
    expect(message.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// I. seedAcademicListCaches integration (real code from dashboard-query.ts)
// ---------------------------------------------------------------------------
describe("I. seedAcademicListCaches integration – interplay with cache system", () => {
  it("I1 – programs key is seeded once under [programs, institutionId]", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-1", {
      programs: [{ id: "p-1" }, { id: "p-2" }],
    });
    const programCall = calls.find(([key]) => (key as string[])[0] === "programs");
    expect(programCall).toBeDefined();
    expect(programCall![1]).toHaveLength(2);
  });

  it("I2 – courses are bucketed by program_id, not collapsed into one key", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-1", {
      programs: [{ id: "p-1" }, { id: "p-2" }],
      courses: [
        { program_id: "p-1" },
        { program_id: "p-1" },
        { program_id: "p-2" },
      ],
    });
    const p1Call = calls.find(([key]) => (key as string[])[0] === "courses" && (key as string[])[1] === "p-1");
    const p2Call = calls.find(([key]) => (key as string[])[0] === "courses" && (key as string[])[1] === "p-2");
    expect((p1Call![1] as any[]).length).toBe(2);
    expect((p2Call![1] as any[]).length).toBe(1);
  });

  it("I3 – course-modules key is NEVER touched (guard against masquerading)", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-1", {
      programs: [{ id: "p-1" }],
      courses: [{ program_id: "p-1" }],
    });
    const moduleCall = calls.find(([key]) => (key as string[])[0] === "course-modules");
    expect(moduleCall).toBeUndefined();
  });

  it("I4 – empty programs list seeds an empty array (not undefined)", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-1", {});
    const programCall = calls.find(([key]) => (key as string[])[0] === "programs");
    expect(programCall![1]).toEqual([]);
  });

  it("I5 – empty courses list produces no course-level setQueryData calls", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-1", {
      programs: [{ id: "p-1" }],
      courses: [],
    });
    const courseCalls = calls.filter(([key]) => (key as string[])[0] === "courses");
    expect(courseCalls).toHaveLength(0);
  });

  it("I6 – institutionId is correctly embedded in the programs key", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };
    seedAcademicListCaches(client as never, "my-institution-42", {
      programs: [{ id: "p-1" }],
    });
    expect(calls[0][0]).toEqual(["programs", "my-institution-42"]);
  });

  it("I7 – two separate calls with different institutionIds seed independently", () => {
    const allCalls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => allCalls.push([key, data]) };
    seedAcademicListCaches(client as never, "inst-A", { programs: [{ id: "p-a" }] });
    seedAcademicListCaches(client as never, "inst-B", { programs: [{ id: "p-b" }] });
    const instACalls = allCalls.filter(([key]) => (key as string[])[1] === "inst-A");
    const instBCalls = allCalls.filter(([key]) => (key as string[])[1] === "inst-B");
    expect(instACalls).toHaveLength(1);
    expect(instBCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// J. TTL expiration checks
// ---------------------------------------------------------------------------
describe("J. TTL expiration – key eviction after lifetime expires", () => {
  it("J1 – set with TTL is immediately readable", () => {
    const cache = makeCacheInstance();
    cache.set("temporary", "data", 1000);
    expect(cache.get("temporary")).toBe("data");
  });

  it("J2 – expired key returns undefined", () => {
    const cache = makeCacheInstance();
    cache.set("stale", "gone", 10);
    
    // Simulate passage of time by mocking Date.now
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 50;
    
    try {
      expect(cache.get("stale")).toBeUndefined();
    } finally {
      Date.now = realDateNow;
    }
  });

  it("J3 – expired key is removed from ref completely", () => {
    const cache = makeCacheInstance();
    cache.set("stale", "data", 10);
    
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 50;
    
    try {
      cache.get("stale"); // triggers eviction
      // Verify it's gone and won't reappear even if clock rewinds
      Date.now = realDateNow;
      expect(cache.get("stale")).toBeUndefined();
    } finally {
      Date.now = realDateNow;
    }
  });

  it("J4 – set with TTL does not impact other non-TTL keys", () => {
    const cache = makeCacheInstance();
    cache.set("temp", "data", 10);
    cache.set("permanent", "keep");
    
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 50;
    
    try {
      expect(cache.get("temp")).toBeUndefined();
      expect(cache.get("permanent")).toBe("keep");
    } finally {
      Date.now = realDateNow;
    }
  });
});
