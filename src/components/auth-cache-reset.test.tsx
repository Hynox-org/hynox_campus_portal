// @vitest-environment jsdom
import React, {useEffect} from "react";
import { afterEach, expect, it, vi } from "vitest";
import {act,cleanup,render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {CacheProvider,useCache} from "./cache-provider";
import AuthCacheReset from "./auth-cache-reset";
import { LOGOUT_EVENT, notifySignOut, navigateAfterSignOut } from "@/lib/auth-logout";
vi.mock("@/lib/auth-logout", async () => ({ ...await vi.importActual("@/lib/auth-logout"), navigateAfterSignOut: vi.fn() }));
let pathname="/student";
vi.mock("next/navigation",()=>({usePathname:()=>pathname}));
afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks();vi.unstubAllGlobals();});
it.each(["/login","/super-admin-login"])("clears both dashboard caches at %s", path => {
 const client=new QueryClient();client.setQueryData(["student-data"],{private:"previous account"});
 let cache:ReturnType<typeof useCache>;
 function Probe(){cache=useCache();useEffect(()=>{cache.set("roster","private");},[]);return null;}
 function App(){return <QueryClientProvider client={client}><CacheProvider><Probe/><AuthCacheReset/></CacheProvider></QueryClientProvider>;}
 pathname="/student";const view=render(<App/>);expect(cache!.get("roster")).toBe("private");
 pathname=path;view.rerender(<App/>);expect(client.getQueryData(["student-data"])).toBeUndefined();expect(cache!.get("roster")).toBeUndefined();
});

function renderProtected() {
  pathname="/student";
  const client=new QueryClient();client.setQueryData(["student-data"],"private");
  const view=render(<QueryClientProvider client={client}><CacheProvider><AuthCacheReset><button>Private action</button></AuthCacheReset></CacheProvider></QueryClientProvider>);
  return {client,...view};
}
it.each(["/login","/super-admin-login"])("removes private content and clears query data on another tab's logout to %s", path=>{
  const {client}=renderProtected();
  act(()=>window.dispatchEvent(new StorageEvent("storage",{key:LOGOUT_EVENT,newValue:JSON.stringify({redirectTo:path})})));
  expect(screen.queryByText("Private action")).toBeNull();
  expect(client.getQueryData(["student-data"])).toBeUndefined();
  expect(navigateAfterSignOut).toHaveBeenCalledExactlyOnceWith(path);
});
it("broadcasts successful logout to the current tab and other tabs",()=>{
  const postMessage=vi.fn(),close=vi.fn();
  vi.stubGlobal("BroadcastChannel",class {postMessage=postMessage;close=close;});
  renderProtected();
  act(()=>notifySignOut("/login"));
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({redirectTo:"/login"}));
  expect(localStorage.getItem(LOGOUT_EVENT)).toContain('"redirectTo":"/login"');
  expect(screen.queryByText("Private action")).toBeNull();
  expect(close).toHaveBeenCalled();
});
it("uses BroadcastChannel when browser storage is unavailable",()=>{
  let receive: ((event:{data:unknown})=>void)|undefined;
  vi.stubGlobal("BroadcastChannel",class {set onmessage(callback:(event:{data:unknown})=>void){receive=callback;}close(){} });
  renderProtected();
  act(()=>receive!({data:{redirectTo:"/login"}}));
  expect(navigateAfterSignOut).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("Private action")).toBeNull();
});
it("checks the logout marker when a suspended tab resumes",()=>{
  renderProtected();
  localStorage.setItem(LOGOUT_EVENT,JSON.stringify({redirectTo:"/login"}));
  act(()=>window.dispatchEvent(new Event("focus")));
  expect(navigateAfterSignOut).toHaveBeenCalledWith("/login");
});
it("does not sign out a new session because of an old logout marker",()=>{
  localStorage.setItem(LOGOUT_EVENT,JSON.stringify({redirectTo:"/login"}));
  renderProtected();
  act(()=>window.dispatchEvent(new Event("focus")));
  expect(navigateAfterSignOut).not.toHaveBeenCalled();
  expect(screen.getByText("Private action")).toBeTruthy();
});
it("ignores malformed messages, unsafe destinations and duplicate notifications",()=>{
  renderProtected();
  for(const value of ["invalid",JSON.stringify({redirectTo:"https://attacker.example"})]) act(()=>window.dispatchEvent(new StorageEvent("storage",{key:LOGOUT_EVENT,newValue:value})));
  expect(navigateAfterSignOut).not.toHaveBeenCalled();
  for(let i=0;i<2;i++) act(()=>window.dispatchEvent(new CustomEvent(LOGOUT_EVENT,{detail:{redirectTo:"/login"}})));
  expect(navigateAfterSignOut).toHaveBeenCalledTimes(1);
});
it("removes its listeners after unmount",()=>{
  const view=renderProtected();view.unmount();
  act(()=>window.dispatchEvent(new CustomEvent(LOGOUT_EVENT,{detail:{redirectTo:"/login"}})));
  expect(navigateAfterSignOut).not.toHaveBeenCalled();
});
