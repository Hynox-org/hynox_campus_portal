const fs=require('fs');function edit(f,fn){const p='src/'+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
edit('app/institution/institution-panel.tsx',s=>s.replace('interface InstitutionPanelProps','const EMPTY_COHORTS: never[] = [];\n\ninterface InstitutionPanelProps').replace('deliveryData?.cohorts || []','deliveryData?.cohorts || EMPTY_COHORTS'));
edit('app/student/student-console.tsx',s=>s.replace('  useEffect(() => { void refreshFromEffect(); }, [studentId]);',`  useEffect(() => {
    let cancelled = false;
    async function loadInitialProgress() {
      try {
        const [activityResult, progressResult] = await Promise.all([
          getStudentAssignedActivitiesAction(studentId), listStudentLessonProgressAction(studentId)
        ]);
        if (cancelled) return;
        if (activityResult.activities) setActivities(activityResult.activities);
        if (progressResult.progressList) setLessonProgressMap(Object.fromEntries(progressResult.progressList.map(progress => [progress.lesson_id, progress])));
      } catch (error) { if (!cancelled) showError(errorMessage(error, "Unable to load your progress.")); }
    }
    void loadInitialProgress();
    return () => { cancelled = true; };
  }, [studentId, showError]);`).replace('    attemptActiveRef.current = false;\n    quizViolationCountRef.current = 0;\n    setSelectedProjectActivity','    setSelectedProjectActivity').replace('                            handleSelectCohort(coh);','                            attemptActiveRef.current = false;\n                            quizViolationCountRef.current = 0;\n                            handleSelectCohort(coh);'));
