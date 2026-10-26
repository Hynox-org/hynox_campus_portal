import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root='http://localhost:3101';const smoke=[];
for(const path of ['/login','/super-admin-login','/admin','/institution','/teacher','/student','/academic','/public','/auth/callback']){
 const response=await fetch(root+path,{redirect:'manual'});
 const entry={path,status:response.status,location:response.headers.get('location'),cacheControl:response.headers.get('cache-control')};
 if(['/login','/super-admin-login'].includes(path))assert.equal(response.status,200);
 else {assert.equal(response.status,307);assert.equal(new URL(entry.location,root).pathname,'/login');}
 smoke.push(entry);
}
await fetch(root+'/login');
const durations=await Promise.all(Array.from({length:10},async()=>{const start=performance.now();const response=await fetch(root+'/login');await response.text();assert.equal(response.status,200);return performance.now()-start}));
durations.sort((a,b)=>a-b);
const secretNames=Object.keys(process.env).filter(k=>/SERVICE_ROLE|BREVO_API_KEY|SCHEDULER_TOKEN|SANDBOX_ENGINE_API_KEY/.test(k)&&process.env[k]?.length>16);
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(join(path,item.name)):[join(path,item.name)]);}
const publicFiles=files('.next/static').filter(p=>/\.(js|json|map)$/.test(p));const leaks=[];
for(const file of publicFiles){const content=readFileSync(file,'utf8');for(const name of secretNames)if(content.includes(process.env[name]))leaks.push({file,variable:name});}
assert.equal(leaks.length,0,'A server secret appeared in a public build artifact');
const result={checkedAt:new Date().toISOString(),smoke,localAnonymousLoginBurst:{requests:10,p50Ms:Math.round(durations[4]),p95Ms:Math.round(durations[9]),note:'Local anonymous GET only, after warm-up. No authenticated capacity, OAuth throughput or Supabase load claim.'},publicBuildSecretCheck:{publicFiles:publicFiles.length,configuredSecretNamesChecked:secretNames,exposures:leaks}};
writeFileSync('output/testing/module-01/local-smoke-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
