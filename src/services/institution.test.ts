import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server",()=>({createClient:vi.fn()}));
import { createClient } from "@/utils/supabase/server";
import { createInstitution, updateInstitutionStatus, listInstitutionUsers, listTeacherInstitutions, getInstitutionRelationsCount, deleteInstitution } from "./institution";
const campus="11111111-1111-4111-8111-111111111111";
beforeEach(()=>vi.clearAllMocks());
it("starts independent teacher mappings together and merges duplicate campuses",async()=>{
  const started = new Set<string>();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release=resolve; });
  const from=(table:string)=>{
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),
      maybeSingle:()=>{started.add(table);return gate.then(()=>({data:{tenant_id:campus},error:null}));},
      then:(resolve:(value:unknown)=>void)=>{started.add(table);return gate.then(()=>resolve({data:table==="institutions"?[{id:campus}]:[{tenant_id:campus}],error:null}));},
    };return query;
  };
  vi.mocked(createClient).mockResolvedValue({schema:()=>({from})} as never);
  const result=listTeacherInstitutions("teacher",false);
  await vi.waitFor(()=>expect([...started].sort()).toEqual(["course_instructors","tenant_teachers","users"]));
  release();expect(await result).toEqual([{id:campus}]);
});
it("validates creation before making any database call",async()=>{
  await expect(createInstitution({name:" ",institution_code:"campus",institution_type:"college"})).rejects.toThrow();
  expect(createClient).not.toHaveBeenCalled();
});
it("does not claim success when a status update affects no institution",async()=>{
  const query={update:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};
  vi.mocked(createClient).mockResolvedValue({schema:()=>({from:()=>query})} as never);
  await expect(updateInstitutionStatus(campus,"active")).rejects.toThrow(/could not be updated/);
});
it("checks institution dependencies concurrently with both institution aliases",async()=>{
  const filters: string[]=[];
  const makeQuery=()=>({select:vi.fn().mockReturnThis(),or:(filter:string)=>{filters.push(filter);return Promise.resolve({count:2,error:null});},eq:()=>Promise.resolve({count:3,error:null})});
  vi.mocked(createClient).mockResolvedValue({schema:()=>({from:makeQuery})} as never);
  expect(await getInstitutionRelationsCount(campus)).toEqual({cohorts:2,programs:2,users:3});
  expect(filters).toEqual([`institution_id.eq.${campus},tenant_id.eq.${campus}`,`institution_id.eq.${campus},tenant_id.eq.${campus}`]);
});
it("deletes only through the guarded institution transaction",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{deleted:true},error:null});
  vi.mocked(createClient).mockResolvedValue({schema:()=>({rpc})} as never);
  expect(await deleteInstitution(campus)).toBe(true);expect(rpc).toHaveBeenCalledWith("delete_managed_institution",{institution_id_value:campus});
});
it("loads 2500 directory users without the default 1000-row truncation",async()=>{
  let page=0;const filters: string[]=[];
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),or:(filter:string)=>{filters.push(filter);return query;},
    then:(resolve:(value:unknown)=>void)=>{const current=page++;resolve({data:current<5?Array.from({length:500},(_,i)=>({id:String(current*500+i),created_at:"2026-10-26T00:00:00Z",email:"student@example.com",status:"active",full_name:"Student",user_roles:[{role:{name:"student"}},{role:null}]})):[],error:null});},
  };
  vi.mocked(createClient).mockResolvedValue({schema:()=>({from:()=>query})} as never);
  const users=await listInstitutionUsers(campus);expect(users).toHaveLength(2500);expect(users[0].roles).toEqual(["student"]);expect(page).toBe(6);expect(filters[0]).toContain("id.lt.499");
});
