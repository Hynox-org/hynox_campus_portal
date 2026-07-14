"use client";

import React, { createContext, useContext, useRef } from "react";

interface CacheContextProps {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
  clear: () => void;
}

const CacheContext = createContext<CacheContextProps | null>(null);

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Record<string, any>>({});

  const get = (key: string) => cacheRef.current[key];
  const set = (key: string, value: any) => {
    cacheRef.current[key] = value;
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
