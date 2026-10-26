"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCache } from "./cache-provider";
import { LOGOUT_EVENT, navigateAfterSignOut } from "@/lib/auth-logout";

export default function AuthCacheReset({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { clear } = useCache();
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let handled = false;
    const readMarker = () => { try { return localStorage.getItem(LOGOUT_EVENT); } catch { return null; } };
    const initialMarker = readMarker();
    const receive = (value: unknown) => {
      if (handled || !value || typeof value !== "object") return;
      const path = (value as { redirectTo?: unknown }).redirectTo;
      if (path !== "/login" && path !== "/super-admin-login") return;
      handled = true;
      setSignedOut(true);
      queryClient.clear();
      clear();
      navigateAfterSignOut(path);
    };
    const receiveStored = (value: string | null) => { try { if (value) receive(JSON.parse(value)); } catch { /* Ignore unrelated/malformed browser messages. */ } };
    const onStorage = (event: StorageEvent) => { if (event.key === LOGOUT_EVENT) receiveStored(event.newValue); };
    const onLocal = (event: Event) => receive((event as CustomEvent).detail);
    const onResume = () => { const marker = readMarker(); if (marker !== initialMarker) receiveStored(marker); };
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel(LOGOUT_EVENT); channel.onmessage = event => receive(event.data); } catch { /* Storage events remain available. */ }
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOGOUT_EVENT, onLocal);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOGOUT_EVENT, onLocal);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [queryClient, clear]);
  useEffect(() => {
    if (pathname === "/login" || pathname === "/super-admin-login") {
      queryClient.clear();
      clear();
    }
  }, [pathname, queryClient, clear]);
  return signedOut ? null : children;
}
