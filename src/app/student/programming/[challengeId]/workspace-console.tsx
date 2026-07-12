"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  runChallengeCodeAction,
  submitChallengeCodeAction,
  getChallengeSubmissionResultsAction,
  getProgrammingChallengeDetailsAction
} from "@/app/actions/learning-actions";
import {
  Code,
  Terminal as TerminalIcon,
  Play,
  Send,
  History,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Clock,
  Cpu,
  BookOpen,
  ChevronLeft,
  Loader2
} from "lucide-react";
import Link from "next/link";

interface WorkspaceConsoleProps {
  activityId: string;
  studentId: string;
  initialData: {
    challenge: any;
    progress: any;
    examples: any[];
    submissions: any[];
  };
}

export default function WorkspaceConsole({
  activityId,
  studentId,
  initialData
}: WorkspaceConsoleProps) {
  const { challenge, examples } = initialData;

  const [submissions, setSubmissions] = useState(initialData.submissions);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Tabs for right panel: "editor" | "results" | "history"
  const [activeTab, setActiveTab] = useState<"editor" | "results" | "history">("editor");

  // Run Code states
  const [runningCode, setRunningCode] = useState(false);
  const [runResults, setRunResults] = useState<any[] | null>(null);
  const [runConsoleError, setRunConsoleError] = useState<string | null>(null);

  // Submit Code states
  const [submitting, setSubmitting] = useState(false);
  const [pollingSubmissionId, setPollingSubmissionId] = useState<string | null>(null);
  const [activeSubmissionResults, setActiveSubmissionResults] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Editor Theme & Custom settings
  const editorRef = useRef<any>(null);

  // Load starter code or local storage draft
  useEffect(() => {
    const draftKey = `challenge_draft_${challenge.id}_${selectedLanguage}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      setCode(savedDraft);
    } else {
      setCode(challenge.starter_code || "");
    }
  }, [selectedLanguage, challenge.id, challenge.starter_code]);

  // Handle autosave on code change
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    if (newCode.trim()) {
      const draftKey = `challenge_draft_${challenge.id}_${selectedLanguage}`;
      localStorage.setItem(draftKey, newCode);
    }
  };

  // Full Screen Toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Run Code Action
  const handleRunCode = async () => {
    setRunningCode(true);
    setRunResults(null);
    setRunConsoleError(null);
    setActiveTab("results");

    try {
      const res = await runChallengeCodeAction(challenge.id, selectedLanguage, code);
      if (res.error) {
        setRunConsoleError(res.error);
      } else if (res.results) {
        setRunResults(res.results);
      }
    } catch (e: any) {
      setRunConsoleError(e.message || "Failed to compile or run code.");
    } finally {
      setRunningCode(false);
    }
  };

  // Submit Solution Action
  const handleSubmitSolution = async () => {
    setSubmitting(true);
    setStatusMessage("Creating submission & queuing judge...");
    setActiveTab("results");
    setRunResults(null);
    setRunConsoleError(null);
    setActiveSubmissionResults(null);

    try {
      const res = await submitChallengeCodeAction(
        challenge.id,
        studentId,
        initialData.progress?.id || "new",
        selectedLanguage,
        code
      );

      if (res.error) {
        setStatusMessage(null);
        setRunConsoleError(res.error);
      } else if (res.submission) {
        setStatusMessage("Queued in Judge Engine...");
        setPollingSubmissionId(res.submission.id);
      }
    } catch (e: any) {
      setStatusMessage(null);
      setRunConsoleError(e.message || "Failed to submit code.");
      setSubmitting(false);
    }
  };

  // Polling for Submission results
  useEffect(() => {
    if (!pollingSubmissionId) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        // Timeout after 30 seconds
        clearInterval(interval);
        setStatusMessage(null);
        setRunConsoleError("Grading timeout. Please check submission history.");
        setPollingSubmissionId(null);
        setSubmitting(false);
        return;
      }

      try {
        const res = await getChallengeSubmissionResultsAction(pollingSubmissionId);
        if (res && !("error" in res) && res.result) {
          // If status is no longer pending/running
          if (res.result) {
            clearInterval(interval);
            setActiveSubmissionResults(res);
            setStatusMessage(null);
            setPollingSubmissionId(null);
            setSubmitting(false);

            // Refresh submissions history list
            const refreshDetails = await getProgrammingChallengeDetailsAction(activityId, studentId);
            if (refreshDetails && "submissions" in refreshDetails) {
              setSubmissions(refreshDetails.submissions || []);
            }
          }
        }
      } catch (e) {
        console.error("Error polling results:", e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [pollingSubmissionId, activityId, studentId]);

  // Load detailed results from history
  const handleLoadSubmissionResults = async (sub: any) => {
    setSubmitting(true);
    setStatusMessage("Loading submission logs...");
    setActiveTab("results");
    setRunResults(null);
    setRunConsoleError(null);
    setActiveSubmissionResults(null);

    try {
      const res = await getChallengeSubmissionResultsAction(sub.id);
      setActiveSubmissionResults(res);
    } catch (e: any) {
      setRunConsoleError(e.message || "Failed to load submission logs.");
    } finally {
      setStatusMessage(null);
      setSubmitting(false);
    }
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch ${isFullscreen ? "fixed inset-0 bg-[#F8FAFC] z-50 p-6 overflow-auto" : ""}`}>
      
      {/* Left Pane: Problem Description */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm flex flex-col justify-between overflow-hidden min-h-[500px]">
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
              <BookOpen size={16} className="text-[#2563EB]" /> Problem Specification
            </h2>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
              challenge.difficulty_level === "easy"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : challenge.difficulty_level === "medium"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {challenge.difficulty_level}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-wrap">
                {challenge.problem_statement}
              </p>
            </div>

            {challenge.instructions && (
              <div className="bg-[#2563EB]/5 border border-[#2563EB]/15 p-3 rounded-lg text-xs text-[#0f172a] space-y-1">
                <span className="font-bold text-[#2563EB] block text-[9px] uppercase tracking-wider">💡 Instructions & Hints</span>
                <p className="leading-relaxed whitespace-pre-wrap">{challenge.instructions}</p>
              </div>
            )}

            {challenge.input_format && (
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">Input Format</h3>
                <p className="text-xs text-[#475569]">{challenge.input_format}</p>
              </div>
            )}

            {challenge.output_format && (
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">Output Format</h3>
                <p className="text-xs text-[#475569]">{challenge.output_format}</p>
              </div>
            )}

            {challenge.constraints_text && (
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">Constraints</h3>
                <pre className="text-[9px] font-mono bg-slate-50 border border-[#E2E8F0] p-2 rounded text-[#0F172A]">
                  {challenge.constraints_text}
                </pre>
              </div>
            )}

            <div className="flex gap-4 text-[9px] font-mono text-[#475569]">
              <span className="bg-slate-100 px-2 py-1 rounded">Time Limit: {challenge.time_limit_ms || 1000}ms</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Memory Limit: {challenge.memory_limit_mb || 256}MB</span>
            </div>
          </div>

          {/* Examples Section */}
          {examples.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">Examples</h3>
              {examples.map((ex) => (
                <div key={ex.id} className="border border-[#E2E8F0] rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <span className="text-[9px] font-bold text-[#2563EB] block">Example {ex.example_number}</span>
                  <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                    <div>
                      <span className="text-[8px] font-bold text-[#475569] block mb-0.5">Input</span>
                      <pre className="bg-white border border-[#E2E8F0] p-2 rounded text-[#0F172A] whitespace-pre-wrap">{ex.input_example}</pre>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-[#475569] block mb-0.5">Output</span>
                      <pre className="bg-white border border-[#E2E8F0] p-2 rounded text-[#0F172A] whitespace-pre-wrap">{ex.output_example}</pre>
                    </div>
                  </div>
                  {ex.explanation && (
                    <p className="text-[9px] text-[#475569] italic mt-1">
                      <strong>Explanation:</strong> {ex.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t border-[#E2E8F0] p-4 flex justify-between items-center text-[10px] text-[#475569]">
          <span>Security check: Hidden test cases are active.</span>
        </div>
      </div>

      {/* Right Pane: Editor, Results & History */}
      <div className="flex flex-col gap-6">
        
        {/* Workspace Navigation Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-sm flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "editor"
                  ? "bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/10"
                  : "hover:bg-slate-50 text-[#475569]"
              }`}
            >
              <Code size={13} />
              Editor Workspace
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "results"
                  ? "bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/10"
                  : "hover:bg-slate-50 text-[#475569]"
              }`}
            >
              <TerminalIcon size={13} />
              Console Results
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/10"
                  : "hover:bg-slate-50 text-[#475569]"
              }`}
            >
              <History size={13} />
              Submission History
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-slate-50 border border-transparent hover:border-[#E2E8F0] rounded-lg transition-all text-[#475569]"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Dynamic Panel Content */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
          
          {/* TAB 1: MONACO EDITOR */}
          {activeTab === "editor" && (
            <div className="flex flex-col flex-1">
              <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1">
                  <Code size={14} className="text-[#2563EB]" /> Code Editor
                </span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-[10px] font-semibold text-[#0F172A] outline-none shadow-sm focus:border-[#2563EB]/30 transition-all"
                >
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3</option>
                  <option value="java">Java (OpenJDK)</option>
                  <option value="cpp">C++ (GCC)</option>
                  <option value="c">C (GCC)</option>
                </select>
              </div>

              <div className="flex-1 bg-[#0F172A]">
                <Editor
                  height="340px"
                  language={selectedLanguage}
                  value={code}
                  onChange={handleCodeChange}
                  theme="hynox-dark"
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    
                    // Register custom Hynox Campus theme matching Deep Navy and SaaS aesthetic
                    monaco.editor.defineTheme("hynox-dark", {
                      base: "vs-dark",
                      inherit: true,
                      rules: [
                        { token: "comment", foreground: "6A737D", fontStyle: "italic" },
                        { token: "keyword", foreground: "F97583", fontStyle: "bold" },
                        { token: "string", foreground: "9ECBFF" },
                        { token: "number", foreground: "79B8FF" },
                        { token: "regexp", foreground: "85E89D" },
                        { token: "type", foreground: "B392F0" }
                      ],
                      colors: {
                        "editor.background": "#0F172A", // Secondary (Deep Navy)
                        "editor.foreground": "#F8FAFC", // Background (Off-white)
                        "editorLineNumber.foreground": "#475569", // Text Secondary
                        "editorLineNumber.activeForeground": "#2563EB", // Primary Blue
                        "editor.lineHighlightBackground": "#1E293B", // subtle highlight
                        "editor.selectionBackground": "#334155" // slate selection
                      }
                    });
                    
                    monaco.editor.setTheme("hynox-dark");
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2
                  }}
                />
              </div>

              <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/30 flex gap-3">
                <button
                  onClick={handleRunCode}
                  disabled={runningCode || submitting}
                  className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/25 hover:bg-[#2563EB]/5 text-[#0F172A] hover:text-[#2563EB] px-4 py-2 rounded-lg shadow-sm font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {runningCode ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  Run Code
                </button>

                <button
                  onClick={handleSubmitSolution}
                  disabled={runningCode || submitting}
                  className="bg-[#2563EB] text-white hover:bg-[#2563EB]/95 px-4.5 py-2 rounded-lg shadow-sm font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ml-auto"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Submit Solution
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CONSOLE RESULTS */}
          {activeTab === "results" && (
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6 overflow-y-auto flex-1 max-h-[380px]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A] border-b border-[#E2E8F0] pb-2">
                  Execution Report
                </h3>

                {/* State: Loading/Queueing */}
                {statusMessage && (
                  <div className="bg-[#2563EB]/5 border border-[#2563EB]/15 text-[#2563EB] p-4 rounded-xl flex items-center gap-2 text-xs font-semibold animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                {/* State: Compile/Runtime Errors */}
                {runConsoleError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={14} />
                      <span>Execution Error</span>
                    </div>
                    <pre className="font-mono text-[9px] bg-red-100/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {runConsoleError}
                    </pre>
                  </div>
                )}

                {/* State: Run Code Results */}
                {runResults && (
                  <div className="space-y-4">
                    {runResults.map((res, idx) => (
                      <div key={idx} className="border border-[#E2E8F0] rounded-xl p-4 bg-slate-50/20 space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#0F172A]">Test Case #{idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                            res.passed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {res.passed ? "Passed" : "Failed"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[9px]">
                          <div>
                            <span className="text-[8px] font-bold text-[#475569] block mb-0.5">Input</span>
                            <pre className="bg-white border border-[#E2E8F0] p-2 rounded overflow-x-auto">{res.input}</pre>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-[#475569] block mb-0.5">Expected Output</span>
                            <pre className="bg-white border border-[#E2E8F0] p-2 rounded overflow-x-auto">{res.expected}</pre>
                          </div>
                        </div>

                        {!res.passed && (
                          <div className="font-mono text-[9px] bg-red-50/30 p-2 rounded border border-red-100">
                            <span className="text-[8px] font-bold text-red-700 block mb-0.5">Received Output</span>
                            <pre className="text-red-700 overflow-x-auto">{res.actual || "[Empty Output]"}</pre>
                          </div>
                        )}

                        {res.stderr && (
                          <div className="font-mono text-[9px] bg-amber-50/20 p-2 rounded border border-amber-100 text-amber-700">
                            <span className="text-[8px] font-bold block mb-0.5">Stderr Logs</span>
                            <pre className="overflow-x-auto">{res.stderr}</pre>
                          </div>
                        )}

                        <div className="text-[8px] text-[#475569] font-mono">
                          Execution time: {res.executionTimeMs}ms
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* State: Submit Code Detailed Results */}
                {activeSubmissionResults && (
                  <div className="space-y-5">
                    {/* Summary Card */}
                    <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-[#475569] block font-bold uppercase tracking-wider">Passed Cases</span>
                        <span className="text-sm font-bold text-[#0F172A]">
                          {activeSubmissionResults.result?.passed_test_cases || 0} / {activeSubmissionResults.result?.total_test_cases || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#475569] block font-bold uppercase tracking-wider">Score</span>
                        <span className="text-sm font-bold text-[#2563EB]">
                          {activeSubmissionResults.result?.score || 0} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#475569] block font-bold uppercase tracking-wider">Time Spent</span>
                        <span className="text-sm font-bold text-[#0F172A] flex items-center gap-1">
                          <Clock size={12} /> {activeSubmissionResults.result?.execution_time_ms || 0}ms
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#475569] block font-bold uppercase tracking-wider">Memory</span>
                        <span className="text-sm font-bold text-[#0F172A] flex items-center gap-1">
                          <Cpu size={12} /> {activeSubmissionResults.result?.memory_used_kb || 0}KB
                        </span>
                      </div>
                    </div>

                    {/* Detailed Test Results */}
                    <div className="space-y-3">
                      <h4 className="text-[9px] font-bold uppercase tracking-wider text-[#0F172A]">Detailed Results</h4>
                      <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl bg-white overflow-hidden">
                        {activeSubmissionResults.testCases?.map((tc: any, index: number) => (
                          <div key={tc.id} className="p-3 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-[#0F172A]">Test Case #{index + 1}</span>
                              <span className="text-[8px] text-[#475569] font-mono ml-3">{tc.execution_time_ms}ms</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                              tc.passed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}>
                              {tc.passed ? "Passed" : "Failed"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Console Logs */}
                    {activeSubmissionResults.logs?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-bold uppercase tracking-wider text-[#0F172A]">Judge Engine Outputs</h4>
                        <div className="bg-[#0F172A] text-emerald-400 font-mono p-4 rounded-xl text-[9px] space-y-1 max-h-32 overflow-y-auto border border-slate-800">
                          {activeSubmissionResults.logs.map((log: any) => (
                            <div key={log.id}>
                              <span className="text-amber-400">[{log.log_type}]</span> {log.log_message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Idle State */}
                {!runningCode && !submitting && !runResults && !activeSubmissionResults && !runConsoleError && (
                  <div className="text-center py-10 text-slate-500 font-medium">
                    No execution outputs. Write code and click "Run Code" or "Submit Solution".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SUBMISSION HISTORY */}
          {activeTab === "history" && (
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[380px]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A] border-b border-[#E2E8F0] pb-2">
                  My Submissions
                </h3>

                <div className="divide-y divide-[#E2E8F0]">
                  {submissions.length > 0 ? (
                    submissions.map((sub) => {
                      const dateStr = new Date(sub.submitted_at).toLocaleString();
                      const statusColor =
                        sub.submission_status_code === "accepted"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : sub.submission_status_code === "pending" || sub.submission_status_code === "running"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200";

                      return (
                        <div key={sub.id} className="py-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold capitalize text-[#0F172A]">{sub.language}</span>
                            <span className="text-[10px] text-[#475569] ml-3">{dateStr}</span>
                            <div className="mt-1 flex gap-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold border capitalize ${statusColor}`}>
                                {sub.submission_status_code}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleLoadSubmissionResults(sub)}
                            className="text-[#2563EB] hover:underline font-bold text-[10px] cursor-pointer"
                          >
                            Logs & Score
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-slate-500 font-medium">
                      You have not submitted any solutions yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
