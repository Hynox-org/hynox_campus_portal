import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseCsv, processCsvOnboarding, onboardSingleUser, onboardSuperAdmin, regenerateInvitation, verifyInvitation, listOnboardingInvitations } from "./onboarding";

const campus = "11111111-1111-4111-8111-111111111111";
const invitationId = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333";
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation(async (_name, params) => ({ data: params?.rows?.map((row: {email:string}) => ({email:row.email,status:"success",token,queued:true})), error:null }));
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({rpc}) } as never);
});

describe("CSV boundaries", () => {
  it("supports BOMs, quoted commas, escaped quotes and normalized emails", () => {
    expect(parseCsv('\uFEFFName,Email\r\n"Kumar, Akshay ""A""", Student@EXAMPLE.com\r\n')).toEqual([
      {name:'Kumar, Akshay "A"',email:"student@example.com",role:"student",institution_id:undefined},
    ]);
  });
  it.each(["", "name,email", "username,email\nOne,a@example.com", "name,email,email\nOne,a@example.com,a@example.com"])("rejects empty or ambiguous CSV %s", csv => {
    expect(() => parseCsv(csv)).toThrow();
  });
  it("limits input before parsing", () => { expect(() => parseCsv("a".repeat(750001))).toThrow(/750/); });
  it("rejects 2501 rows", () => { expect(() => parseCsv("name,email\n"+Array.from({length:2501},(_,i)=>"User,u"+i+"@example.com").join("\n"))).toThrow(/2500/); });
  it.each([
    "name,email\n,a@example.com",
    "name,email\nName,invalid",
    "name,email\nOne,a@example.com\nTwo,A@EXAMPLE.COM",
    "name,email,role\nAdmin,a@example.com,super_admin",
    "name,email,role\nAdmin,a@example.com,unknown",
  ])("validates the whole upload before any database call", async csv => {
    await expect(processCsvOnboarding(csv,campus)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed institution IDs before database access", async () => {
    await expect(processCsvOnboarding("name,email\nStudent,a@example.com","invalid")).rejects.toThrow(/institution/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("atomic provisioning and batch performance", () => {
  it.each([1000,2500])("provisions %i users with one RPC per 100 rows and no email requests", async count => {
    const csv="name,email\n"+Array.from({length:count},(_,i)=>"Student,student"+i+"@example.com").join("\n");
    const results=await processCsvOnboarding(csv,campus);
    expect(results).toHaveLength(count);
    expect(results.every(row=>row.status==="success" && row.queued)).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(count/100);
    expect(rpc.mock.calls.every(([name,params])=>name==="provision_onboarding" && params.rows.length===100 && !("invited_by" in params))).toBe(true);
  });
  it.each(["student","institution_admin","mentor","teacher","trainer"])("shares provisioning for %s", async role => {
    const result=await onboardSingleUser({name:" Member ",email:" MEMBER@example.com ",role,institutionId:campus,invitedByUserId:"forged"});
    expect(result.status).toBe("success");
    expect(rpc.mock.calls[0][1].rows[0]).toMatchObject({name:"Member",email:"member@example.com",role});
    expect(rpc.mock.calls[0][1].rows[0].institution_id).toBe(["teacher","trainer"].includes(role)?undefined:campus);
  });
  it("uses the dedicated super-admin gate", async () => {
    expect((await onboardSuperAdmin({name:"Admin",email:"admin@example.com",invitedByUserId:"forged"})).status).toBe("success");
    expect(rpc.mock.calls[0][1].dedicated_super).toBe(true);
  });
  it("blocks super-admin role through ordinary onboarding", async () => {
    const result=await onboardSingleUser({name:"Admin",email:"admin@example.com",role:"super_admin",invitedByUserId:"forged"});
    expect(result.status).toBe("error");expect(rpc).not.toHaveBeenCalled();
  });
  it("stops after an unconfirmed batch but preserves earlier outcomes for safe retry", async () => {
    rpc.mockImplementationOnce(async (_name,params)=>({data:params.rows.map((row:{email:string})=>({...row,status:"success",token})),error:null}))
      .mockResolvedValueOnce({data:null,error:{message:"private database details"}});
    const results=await processCsvOnboarding("name,email\n"+Array.from({length:250},(_,i)=>"User,u"+i+"@example.com").join("\n"),campus);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(results.filter(row=>row.status==="success")).toHaveLength(100);
    expect(results.filter(row=>row.status==="error")).toHaveLength(150);
    expect(JSON.stringify(results)).not.toContain("private database details");
  });
  it("preserves per-row database validation failures", async () => {
    rpc.mockResolvedValue({data:[{email:"a@example.com",status:"error",error:"Existing account has a different role or institution"}],error:null});
    expect((await onboardSingleUser({name:"User",email:"a@example.com",role:"student",institutionId:campus,invitedByUserId:"actor"})).status).toBe("error");
  });
  it("does not expose unexpected network exceptions", async () => {
    rpc.mockRejectedValue(new Error("private network details"));
    const result=await onboardSingleUser({name:"User",email:"a@example.com",role:"student",institutionId:campus,invitedByUserId:"forged"});
    expect(result.status).toBe("error");
    expect(result.error).not.toContain("private network details");
  });
  it("regenerates through the scoped transaction without trusting a supplied inviter", async () => {
    rpc.mockResolvedValue({data:{id:invitationId,token,email:"a+tag@example.com",status:"created"},error:null});
    const result=await regenerateInvitation(invitationId);
    expect(rpc).toHaveBeenCalledWith("regenerate_onboarding",{invitation_id:invitationId});
    expect(result.link).toContain("a%2Btag%40example.com");
  });
  it("rejects malformed IDs and hides private regeneration errors", async () => {
    await expect(regenerateInvitation("bad")).rejects.toThrow(/Invalid/);
    rpc.mockResolvedValue({data:null,error:{message:"private details"}});
    await expect(regenerateInvitation(invitationId)).rejects.toThrow(/could not/);
  });
});

describe("invitation verification", () => {
  let invitation: Record<string,unknown>;
  const campusQuery=vi.fn();
  beforeEach(() => {
    invitation={id:invitationId,token,status:"sent",expires_at:"2099-01-01",invitation_type:"student_onboarding",
      user:{id:"student",full_name:"Member",email:"student@example.com",tenant_id:campus,status:"invited",auth_user_id:null,deleted_at:null}};
    campusQuery.mockResolvedValue({data:{name:"QA campus"},error:null});
    vi.mocked(createAdminClient).mockReturnValue({schema:()=>({from:(table:string)=>({
      select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),
      maybeSingle:table==="user_invitations"?async()=>({data:invitation,error:null}):campusQuery,
    })})} as never);
  });
  it("validates the token and email before resolving campus details", async () => {
    expect((await verifyInvitation(token,"STUDENT@example.com")).invitation?.institutionName).toBe("QA campus");
  });
  it.each(["revoked","accepted","failed"])("rejects %s invitations", async status => {
    invitation.status=status;
    expect((await verifyInvitation(token,"student@example.com")).valid).toBe(false);
    expect(campusQuery).not.toHaveBeenCalled();
  });
  it.each(["2020-01-01","invalid"])("rejects expired or malformed dates %s", async expiry => {
    invitation.expires_at=expiry;
    expect((await verifyInvitation(token,"student@example.com")).valid).toBe(false);
  });
  it.each([{status:"suspended"},{status:"active",auth_user_id:"auth"},{deleted_at:"2026-01-01"}])("rejects unavailable accounts %o", async change => {
    Object.assign(invitation.user as object,change);
    expect((await verifyInvitation(token,"student@example.com")).valid).toBe(false);
  });
  it("rejects mismatched email and malformed tokens without revealing campus details", async () => {
    expect((await verifyInvitation(token,"other@example.com")).valid).toBe(false);
    expect((await verifyInvitation("bad","student@example.com")).valid).toBe(false);
    expect(campusQuery).not.toHaveBeenCalled();
  });
});

it("lists more than the default Supabase row limit in stable pages", async () => {
  let page = 0;
  const filter = vi.fn().mockReturnThis();
  const query={select:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),or:filter,limit:vi.fn().mockReturnThis(),
    then:(resolve:(value:unknown)=>void)=>{const start=page++*500;resolve({data:Array.from({length:start<1000?500:1},(_,i)=>({
      id:String(start+i),created_at:"2026-10-26T00:00:00Z",status:"sent",expires_at:"2099-01-01",institution:{name:"Campus"},
    })),error:null});},
  };
  vi.mocked(createClient).mockResolvedValue({schema:()=>({from:()=>query})} as never);
  expect(await listOnboardingInvitations()).toHaveLength(1001);
  expect(page).toBe(3);
  expect(filter).toHaveBeenCalledTimes(2);
  expect(filter.mock.calls[0][0]).toContain("id.lt.499");
});

describe("invitation dashboard schema compatibility", () => {
  const select = vi.fn();
  const tenantLookup = vi.fn();
  let invitations: { id: string; tenant_id: string | null; status: string; expires_at: string }[];
  let invitationError: object | null;
  beforeEach(() => {
    invitations = []; invitationError = null;
    select.mockReset(); tenantLookup.mockReset().mockResolvedValue({ data: [{ id: campus, name: "QA campus" }], error: null });
    const query = {
      select: (columns: string) => { select(columns); return query; },
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: invitations, error: invitationError }),
    };
    vi.mocked(createClient).mockResolvedValue({ schema: (schema: string) => ({
      from: () => schema === "core" ? query : { select: () => ({ in: tenantLookup }) },
    }) } as never);
  });
  it("loads an empty dashboard without an unsupported cross-schema embed", async () => {
    expect(await listOnboardingInvitations()).toEqual([]);
    expect(select.mock.calls[0][0]).not.toContain("institution:tenant_id");
    expect(tenantLookup).not.toHaveBeenCalled();
  });
  it("resolves institutions once per page using unique tenant IDs", async () => {
    invitations = [campus, campus, null].map((tenant_id, index) => ({ id: String(index), tenant_id, status: "sent", expires_at: "2099-01-01" }));
    const result = await listOnboardingInvitations();
    expect(result.map(row => row.institution_name)).toEqual(["QA campus", "QA campus", "Global / Platform"]);
    expect(tenantLookup).toHaveBeenCalledExactlyOnceWith("id", [campus]);
  });
  it("reports institution lookup failures without exposing database details", async () => {
    invitations = [{ id: "invitation", tenant_id: campus, status: "sent", expires_at: "2099-01-01" }];
    tenantLookup.mockResolvedValue({ data: null, error: { message: "private database details" } });
    await expect(listOnboardingInvitations()).rejects.toThrow("Unable to load invitation institutions.");
  });
  it("keeps invitation permission failures visible", async () => {
    invitationError = { message: "private database details" };
    await expect(listOnboardingInvitations()).rejects.toThrow("Unable to load onboarding invitations.");
  });
});
