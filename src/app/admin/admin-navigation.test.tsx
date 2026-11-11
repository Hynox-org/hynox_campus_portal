// @vitest-environment jsdom
import React from "react";
import type { ShellNavItem } from "@/components/app-shell";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
vi.mock("@/hooks/use-admin",()=>({useAdminData:()=>({data:null,isLoading:false})}));
vi.mock("@/hooks/use-academics",()=>Object.fromEntries(["usePrograms","useTenantInstructors","useCourses","useCourseModules","useCourseInstructors","useAcademicLookups","useAcademicPrefetchData"].map(name=>[name,()=>({})])));
vi.mock("@/components/toast",()=>({useToast:()=>({showSuccess:vi.fn(),showError:vi.fn()})}));
vi.mock("@/components/app-shell",()=>({default:({items,onSelect,children,pageTitle}: { items: ShellNavItem[]; onSelect: (id: string) => void; children: React.ReactNode; pageTitle: string })=><main><h1>{pageTitle}</h1><nav>{items.map((item)=><button key={item.id} onClick={()=>onSelect(item.id)}>{item.label}</button>)}</nav>{children}</main>}));
vi.mock("@/features/newsletter/admin-panel",()=>({default:()=> <div>Newsletter controls</div>}));
vi.mock("@/services/auth",()=>({getCurrentUser:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn((url:string)=>{throw Error(`redirect:${url}`)})}));
import AdminPanel from "./admin-panel";
import NewsletterPage from "./newsletters/page";
import {getCurrentUser} from "@/services/auth";
afterEach(cleanup);
function dashboard(){window.history.replaceState(null,"","/admin");render(<QueryClientProvider client={new QueryClient()}><AdminPanel adminEmail="admin@example.com"/></QueryClientProvider>)}
it("puts newsletters last and opens it inside the shell with a synced URL",async()=>{
 dashboard();const nav=screen.getByRole("navigation");expect(nav.lastElementChild).toHaveTextContent("Course Newsletters");
 fireEvent.click(screen.getByRole("button",{name:"Course Newsletters"}));expect(screen.getByText("Newsletter controls")).toBeVisible();
 await waitFor(()=>expect(window.location.search).toBe("?parentTab=newsletters&tab=newsletters"));expect(window.location.pathname).toBe("/admin");
 fireEvent.click(screen.getByRole("button",{name:"Institutions"}));await waitFor(()=>expect(window.location.search).toBe("?parentTab=institutions&tab=institutions"));expect(screen.queryByText("Newsletter controls")).toBeNull();
});
it("restores the newsletter tab from its URL",async()=>{
 window.history.replaceState(null,"","/admin?parentTab=newsletters&tab=newsletters");render(<QueryClientProvider client={new QueryClient()}><AdminPanel adminEmail="admin@example.com"/></QueryClientProvider>);expect(await screen.findByText("Newsletter controls")).toBeVisible();await waitFor(()=>expect(window.location.search).toBe("?parentTab=newsletters&tab=newsletters"));
});
it("redirects the legacy URL and preserves authorization",async()=>{
 vi.mocked(getCurrentUser).mockResolvedValue(null);await expect(NewsletterPage()).rejects.toThrow("redirect:/login");
 vi.mocked(getCurrentUser).mockResolvedValue({user:{id:"admin"},primaryRole:"super_admin"} as never);await expect(NewsletterPage()).rejects.toThrow("redirect:/admin?parentTab=newsletters&tab=newsletters");
});
