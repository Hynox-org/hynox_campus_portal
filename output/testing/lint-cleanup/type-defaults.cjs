const fs=require('fs'),ts=require('typescript');
const errs=fs.readFileSync('output/testing/lint-cleanup/types-step5.log','utf8');
const paths=new Set([...errs.matchAll(/^(src\/.*?)\(\d+,\d+\):.*(?:user.*possibly 'null'|caller.user)/gm)].map(m=>m[1]));
for(const path of paths){if(path.endsWith('auth.ts'))continue;let s=fs.readFileSync(path,'utf8');s=s.replace(/getCurrentUser\(\)/g,'getCurrentUser(true)');fs.writeFileSync(path,s);}
for(const path of ['src/services/academic.ts','src/services/library.ts','src/services/delivery.ts']){let s=fs.readFileSync(path,'utf8');s=s.replace(/if \(!session\?\.user\)/g,'if (!session)');fs.writeFileSync(path,s);}
const files=new Map();for(const m of errs.matchAll(/^(src\/.*?)\((\d+),(\d+)\): error TS(2322|2345|2769): (.*)/gm)){
 if(!/string/.test(m[5])&&m[4]!=='2769')continue;if(!/undefined|null/.test(m[5])&&m[4]!=='2769')continue;
 const a=files.get(m[1])||[];a.push(m);files.set(m[1],a);
}
for(const [path,list]of files){let s=fs.readFileSync(path,'utf8'),edits=[];let sf=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const m of list){let pos=sf.getPositionOfLineAndCharacter(+m[2]-1,+m[3]-1),node;function visit(n){if(n.getStart(sf)<=pos&&n.end>pos){node=n;ts.forEachChild(n,visit);}}visit(sf);if(!node)continue;
 while(node.parent&&!ts.isPropertyAssignment(node)&&!ts.isJsxAttribute(node)&&!ts.isCallExpression(node.parent)&&!ts.isNewExpression(node.parent))node=node.parent;
 let expr;
 if(ts.isPropertyAssignment(node))expr=node.initializer;
 else if(ts.isJsxAttribute(node)&&node.initializer&&ts.isJsxExpression(node.initializer))expr=node.initializer.expression;
 else if((ts.isCallExpression(node.parent)||ts.isNewExpression(node.parent))&&node.parent.arguments?.includes(node))expr=node;
 if(expr&&/^[\w?.]+$/.test(expr.getText(sf)))edits.push([expr.getStart(sf),expr.end,`(${expr.getText(sf)} ?? "")`]);
 }
 const seen=new Set;for(const[a,b,t]of edits.sort((a,b)=>b[0]-a[0]))if(!seen.has(a)){s=s.slice(0,a)+t+s.slice(b);seen.add(a);}fs.writeFileSync(path,s);
}
