const ts=require('typescript'),fs=require('fs');
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile).config;
const parsed=ts.parseJsonConfigFileContent(config,ts.sys,process.cwd());
const host={getCompilationSettings:()=>parsed.options,getScriptFileNames:()=>parsed.fileNames,getScriptVersion:f=>String(fs.existsSync(f)?fs.statSync(f).mtimeMs:0),getScriptSnapshot:f=>fs.existsSync(f)?ts.ScriptSnapshot.fromString(fs.readFileSync(f,'utf8')):undefined,getCurrentDirectory:()=>process.cwd(),getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:ts.sys.fileExists,readFile:ts.sys.readFile,readDirectory:ts.sys.readDirectory};
const service=ts.createLanguageService(host);
for(const f of JSON.parse(fs.readFileSync(process.argv[2],'utf8'))){if(!f.messages.some(m=>m.ruleId==='@typescript-eslint/no-unused-vars'))continue;for(const change of service.organizeImports({type:'file',fileName:f.filePath},{},{})){let s=fs.readFileSync(change.fileName,'utf8');for(const e of [...change.textChanges].sort((a,b)=>b.span.start-a.span.start))s=s.slice(0,e.span.start)+e.newText+s.slice(e.span.start+e.span.length);fs.writeFileSync(change.fileName,s);}}
