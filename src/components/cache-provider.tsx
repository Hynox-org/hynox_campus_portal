"use client";

import React, { createContext, useContext, useRef } from "react";

interface CacheContextProps {
  get: <T = unknown>(key: string) => T | undefined;
  set: (key: string, value: unknown, ttlMs?: number) => void;
  clear: () => void;
}

const CacheContext = createContext<CacheContextProps | null>(null);

type CacheEntry = {
  value: unknown;
  expiresAt?: number;
};

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Record<string, CacheEntry>>({});

  const get = <T = unknown,>(key: string): T | undefined => {
    const entry = cacheRef.current[key];
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      delete cacheRef.current[key];
      return undefined;
    }
    return entry.value as T;
  };

  const set = (key: string, value: unknown, ttlMs?: number) => {
    cacheRef.current[key] = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
  };

  const clear = () => {
    cacheRef.current = {};
  };

  return (
    <CacheContext.Provider value={{ get, set, clear }}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
}
