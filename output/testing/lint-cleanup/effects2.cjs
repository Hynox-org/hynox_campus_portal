const fs=require('fs'),ts=require('typescript');
function edit(f,fn){let p='src/'+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
// Drawer closure owns its reset. No need to render stale data and reset in an effect.
for(const f of ['app/institution/institution-panel.tsx','app/teacher/teacher-console.tsx'])edit(f,s=>s.replace(/  useEffect\(\(\) => \{\n    if \(!selectedStudent\) \{\n      setActiveStudentProgress\(\[\]\);\n      setActiveStudentLessonsProgress\(\[\]\);\n    \}\n  \}, \[selectedStudent\]\);/,'').replace(/setSelectedStudent\(null\);/g,'setSelectedStudent(null); setActiveStudentProgress([]); setActiveStudentLessonsProgress([]);'));
edit('app/admin/delivery-manager.tsx',s=>s.replace(/    \} else \{\n      setActiveStudentProgress\(\[\]\);\n      setActiveStudentLessonsProgress\(\[\]\);\n    \}\n  \}, \[selectedStudent\]\);/,'    }\n  }, [selectedStudent]);').replace(/setSelectedStudent\(null\);/g,'setSelectedStudent(null); setActiveStudentProgress([]); setActiveStudentLessonsProgress([]);'));
edit('app/teacher/teacher-console.tsx',s=>s.replace(/  useEffect\(\(\) => \{\n    if \(typeof window !== 'undefined' && window.innerWidth < 1024\) \{\n      setIsSidebarOpen\(false\);\n    \}\n  \}, \[\]\);/,'  if (useInputsChanged([hydrated]) && hydrated && window.innerWidth < 1024) setIsSidebarOpen(false);').replace('    setSelectedLessonId("");\n    if (!selectedCourseId) {\n      setLessonsList([]);\n      return;\n    }\n\n    let cancelled = false;\n    setLessonsLoading(true);\n\n    (async () => {','    if (!selectedCourseId) return;\n    let cancelled = false;\n    (async () => {\n      setSelectedLessonId("");\n      setLessonsLoading(true);').replace('  }, [selectedCourseId, selectedInstId]);','  }, [selectedCourseId, selectedInstId, showError]);').replace('    let restored = false;','').replace(/; restored = true;/g,';').replace('hasRestoredFromUrl.current','restoredFromUrl').replace('const hasRestoredFromUrl = useRef(false);','const [restoredFromUrl, setRestoredFromUrl] = useState(false);').replace('restoredFromUrl = true;','setRestoredFromUrl(true);'));
// Convert the remaining synchronous URL index restoration to a guarded state adjustment.
edit('app/teacher/teacher-console.tsx',s=>{
 const sf=ts.createSourceFile('teacher.tsx',s,99,true,4);let target;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[1]?.getText(sf)==='[cohorts, assignedInstitutions, programsList]')target=n;ts.forEachChild(n,visit);}visit(sf);if(target){const b=target.arguments[0].body.getText(sf);s=s.slice(0,target.parent.getStart(sf))+`if (useInputsChanged([hydrated, cohorts, assignedInstitutions, programsList]) && hydrated) { (() => ${b})(); }`+s.slice(target.parent.end);}return s;
});
// Request loading starts inside the actual asynchronous request, with cancellation.
edit('app/teacher/teacher-console.tsx',s=>s.replace(/  useEffect\(\(\) => \{\n    if \(selectedQuizAttempt\) \{[\s\S]*?\n  \}, \[selectedQuizAttempt\]\);/,`  useEffect(() => {
    if (!selectedQuizAttempt) return;
    let cancelled = false;
    async function loadSession() {
      setLoadingQuizSession(true);
      try {
        const res = await getQuizSessionDetailsAction(selectedQuizAttempt.id);
        if (!cancelled) setQuizAttemptSession("questions" in res ? res : null);
      } finally { if (!cancelled) setLoadingQuizSession(false); }
    }
    void loadSession();
    return () => { cancelled = true; };
  }, [selectedQuizAttempt]);`).replace('setSelectedQuizAttempt(null);','setSelectedQuizAttempt(null); setQuizAttemptSession(null);'));
edit('app/admin/program-manager.tsx',s=>s.replace(/  useEffect\(\(\) => \{\n    setSelectedProgram\(null\);[\s\S]*?\n  \}, \[selectedInstId, setSelectedProgram\]\);/,`  const handleCampusChange = (campusId: string) => {
    setSelectedProgram(null);
    setSelectedCourseId(null);
    setModulesCache({}); setLessonsCache({}); setResourcesCache({});
    setSelectedInstId(campusId);
  };`).replace('onChange={setSelectedInstId}','onChange={handleCampusChange}'));
// Selecting the first course performs the same real async fetch as clicking it.
edit('app/admin/program-manager.tsx',s=>{
 const start=s.indexOf('  // Auto-select the first course'),end=s.indexOf('  // Fetch one opened branch',start);const effect=s.slice(start,end);
 s=s.slice(0,start)+s.slice(end);
 const insertion=s.indexOf('  const refreshModules');
 const next=effect.replace('  useEffect(() => {','  useEffect(() => {\n    async function selectInitialCourse() {').replace('void handleSelectCourse(courses[0].id)','await handleSelectCourse(courses[0].id)').replace('  }, [selectedProgram, courses]);','    }\n    void selectInitialCourse();\n  }, [selectedProgram, courses, selectedCourseId, handleSelectCourse]);');
 s=s.slice(0,insertion)+next+s.slice(insertion);return s;
});
