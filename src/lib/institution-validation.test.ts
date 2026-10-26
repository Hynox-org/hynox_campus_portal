import { expect, it } from "vitest";
import { validateInstitution, validateInstitutionId } from "./institution-validation";
const valid={name:" Test Campus ",institution_code:"campus-1",institution_type:"college"};
it.each([null, undefined, []])("rejects missing or invalid details %o",value=>expect(()=>validateInstitution(value as never)).toThrow("Invalid institution details"));
it("accepts multiline postal addresses",()=>expect(validateInstitution({...valid,address:"Building 1\nCampus Road"}).address).toBe("Building 1\nCampus Road"));
it("normalizes institution fields and optional contacts",()=>{
  expect(validateInstitution({...valid,email:" TEST@example.com ",website:"https://example.com"})).toMatchObject({name:"Test Campus",institution_code:"CAMPUS-1",email:"test@example.com",website:"https://example.com/",status:"onboarding",phone:null});
});
it.each([{name:" "},{name:"x".repeat(161)},{institution_code:"bad code"},{institution_type:"invalid"},{email:"bad"},{email:42},{phone:{}},{status:"unknown"},{website:"javascript:alert(1)"},{website:"https://secret:password@example.com"},{logo_url:"data:image/svg+xml,unsafe"}])("rejects malformed institution fields %o",change=>{
  expect(()=>validateInstitution({...valid,...change} as never)).toThrow();
});
it.each(["", "invalid", "id,or=other", null])("rejects malformed identifiers %s",value=>expect(()=>validateInstitutionId(value as never)).toThrow());
