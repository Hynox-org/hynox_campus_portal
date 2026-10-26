import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import InvitationStatusBadge from "./invitation-status-badge";
afterEach(()=>vi.useRealTimers());
it.each([["created","Mail Pending"],["sent","Mail Sent"],["pending","Pending"],["accepted","Accepted"],["failed","Mail Failed"],["revoked","Revoked"],["expired","Expired"]])("renders the actual %s invitation state",(status,label)=>{
  expect(renderToStaticMarkup(<InvitationStatusBadge status={status} expiresAt="2099-01-01"/>)).toContain(label);
});
it.each(["created","sent","pending"])("expires %s at the exact deadline",status=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
  expect(renderToStaticMarkup(<InvitationStatusBadge status={status} expiresAt="2026-10-26T12:00:00Z"/>)).toContain("Expired");
});
it("does not replace failed or revoked states with elapsed expiry",()=>{
  for(const [status,label] of [["failed","Mail Failed"],["revoked","Revoked"]]) expect(renderToStaticMarkup(<InvitationStatusBadge status={status} expiresAt="2020-01-01"/>)).toContain(label);
});
