const fs=require('fs');
const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const f of report){
 const edits=[];
 for(const m of f.messages){
   const fix=m.fix || (['@typescript-eslint/no-unused-vars','react/no-unescaped-entities'].includes(m.ruleId)?m.suggestions?.[0]?.fix:null);
   if(fix)edits.push(fix);
 }
 let s=fs.readFileSync(f.filePath,'utf8'),last=s.length+1;
 for(const fix of edits.sort((a,b)=>b.range[0]-a.range[0]))if(fix.range[1]<=last){s=s.slice(0,fix.range[0])+fix.text+s.slice(fix.range[1]);last=fix.range[0];}
 fs.writeFileSync(f.filePath,s);
}
