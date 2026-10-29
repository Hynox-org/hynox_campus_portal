const fs=require('fs');
const ts=require('typescript');
const report=JSON.parse(fs.readFileSync('output/testing/lint-cleanup/before.json','utf8'));
for(const item of report){
 if(!item.messages.length)continue;
 let s=fs.readFileSync(item.filePath,'utf8');
 const original=s;
 const sf=ts.createSourceFile(item.filePath,s,ts.ScriptTarget.Latest,true,item.filePath.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const edits=[];
 function visit(n){
   // Array callbacks get their type from their collection instead of overriding it.
   if(ts.isParameter(n)&&n.type?.kind===ts.SyntaxKind.AnyKeyword&&n.parent.parent&&ts.isCallExpression(n.parent.parent)&&n.parent.parent.arguments.includes(n.parent)){
     edits.push([n.name.end,n.type.end,'']);
   }
   ts.forEachChild(n,visit);
 }visit(sf);
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+v+s.slice(b);
 s=s.replace(/catch \((\w+): any\)/g,'catch ($1)');
 let errorUsed=false;
 s=s.replace(/\b(error|err)\.message(?:\s*\|\|\s*("[^"]*"|'[^']*'))?/g,(v,n,f)=>{errorUsed=true;return `errorMessage(${n}${f?', '+f:''})`;});
 if(errorUsed)s='import { errorMessage } from "@/lib/error-message";\n'+s;
 if(s!==original)fs.writeFileSync(item.filePath,s);
}
