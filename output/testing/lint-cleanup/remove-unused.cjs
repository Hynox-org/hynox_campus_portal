const fs=require('fs'),ts=require('typescript');
const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const f of report){
 let s=fs.readFileSync(f.filePath,'utf8');if(f.source&&f.source!==s)throw Error('Stale lint input: '+f.filePath);
 const unused=f.messages.filter(m=>m.ruleId==='@typescript-eslint/no-unused-vars');if(!unused.length)continue;
 const sf=ts.createSourceFile(f.filePath,s,99,true,f.filePath.endsWith('tsx')?4:3),positions=new Set(unused.map(m=>sf.getPositionOfLineAndCharacter(m.line-1,m.column-1))),edits=[];
 function identifiers(n){if(ts.isIdentifier(n))return[n];if(ts.isObjectBindingPattern(n)||ts.isArrayBindingPattern(n))return n.elements.flatMap(e=>ts.isBindingElement(e)?identifiers(e.name):[]);return[];}
 function visit(n){
  if(ts.isVariableDeclaration(n)){
   const ids=identifiers(n.name),dead=ids.filter(i=>positions.has(i.getStart(sf)));
   if(dead.length&&dead.length===ids.length){
    const stmt=n.parent.parent;
    if(ts.isVariableStatement(stmt)&&n.parent.declarations.length===1){edits.push([stmt.getStart(sf),stmt.end,'']);return;}
   }
   if(ts.isArrayBindingPattern(n.name)&&dead.length){
    const elements=n.name.elements.map(e=>ts.isBindingElement(e)&&identifiers(e.name).every(i=>positions.has(i.getStart(sf)))?'':e.getText(sf));
    while(elements.length&&elements[elements.length-1]==='')elements.pop();edits.push([n.name.getStart(sf),n.name.end,'['+elements.join(', ')+']']);return;
   }
  }
  if(ts.isBindingElement(n)&&ts.isObjectBindingPattern(n.parent)&&identifiers(n.name).every(i=>positions.has(i.getStart(sf)))){
   const el=n.parent.elements,idx=el.indexOf(n),start=n.getStart(sf),end=idx<el.length-1?el[idx+1].getStart(sf):n.end;
   edits.push([idx===el.length-1&&idx>0?el[idx-1].end:start,end,'']);return;
  }
  ts.forEachChild(n,visit);
 }visit(sf);
 let last=s.length+1;for(const[a,b,t]of edits.sort((a,b)=>b[0]-a[0]))if(b<=last){s=s.slice(0,a)+t+s.slice(b);last=a;}
 fs.writeFileSync(f.filePath,s);
}
