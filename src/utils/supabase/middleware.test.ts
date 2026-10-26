import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("@supabase/ssr",()=>({createServerClient:vi.fn()}));
import {createServerClient} from "@supabase/ssr";
import {updateSession} from "./middleware";
const getUser=vi.fn();
beforeEach(()=>{vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id:"auth-1"}},error:null});});
it("propagates refreshed cookies from every SDK write batch",async()=>{
 vi.mocked(createServerClient).mockImplementation((_url,_key,options)=>{
  getUser.mockImplementation(async()=>{
   options!.cookies.setAll!([{name:"token-a",value:"new-a",options:{httpOnly:true,path:"/"}}],{});
   options!.cookies.setAll!([{name:"token-b",value:"new-b",options:{httpOnly:true,path:"/"}}],{});
   return {data:{user:{id:"auth-1"}},error:null};
  });return {auth:{getUser}} as never;
 });
 const request=new NextRequest("https://campus.example.com/student");
 const {supabaseResponse}=await updateSession(request);
 expect(request.cookies.get("token-a")?.value).toBe("new-a");
 expect(supabaseResponse.cookies.get("token-a")?.value).toBe("new-a");
 expect(supabaseResponse.cookies.get("token-b")?.httpOnly).toBe(true);
});
it("does not treat a failed authentication verification as a session",async()=>{
 getUser.mockResolvedValue({data:{user:{id:"stale"}},error:{message:"expired"}});
 vi.mocked(createServerClient).mockReturnValue({auth:{getUser}} as never);
 expect((await updateSession(new NextRequest("https://campus.example.com/student"))).user).toBeNull();
});
