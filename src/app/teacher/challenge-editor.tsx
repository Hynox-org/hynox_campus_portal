"use client";

import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { upsertChallengeStarterTemplateAction, updateChallengeStrictModeAction } from "@/app/actions/learning-actions";
import { Code, ShieldAlert, Save, Loader2, CheckCircle2 } from "lucide-react";

const LANGUAGES: Array<{ code: string; label: string; monaco: string }> = [
  { code: "javascript", label: "JavaScript", monaco: "javascript" },
  { code: "typescript", label: "TypeScript", monaco: "typescript" },
  { code: "python", label: "Python", monaco: "python" },
  { code: "java", label: "Java", monaco: "java" },
  { code: "cpp", label: "C++", monaco: "cpp" },
  { code: "c", label: "C", monaco: "c" },
];

interface ChallengeEditorProps {
  challengeId: string;
  initialStarterCode?: Record<string, string>;
  strictMode: boolean;
  onStrictModeChange: (value: boolean) => void;
}

// Per-language starter code editor + lockdown toggle for coding challenges.
// Starter code is persisted per language immediately via upsertChallengeStarterTemplateAction
// (its own table, independent of the rest of the activity form), so switching tabs never loses
// unsaved work the way a single shared textarea would.
export default function ChallengeEditor({
  challengeId,
  initialStarterCode,
  strictMode,
  onStrictModeChange,
}: ChallengeEditorProps) {
  const [activeLanguage, setActiveLanguage] = useState("javascript");
  const [codeByLanguage, setCodeByLanguage] = useState<Record<string, string>>(initialStarterCode || {});
  const [savingLanguage, setSavingLanguage] = useState<string | null>(null);
  const [savedLanguage, setSavedLanguage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCodeByLanguage(initialStarterCode || {});
  }, [challengeId, initialStarterCode]);

  const handleSaveStarterCode = async (language: string) => {
    setSavingLanguage(language);
    setSavedLanguage(null);
    setSaveError(null);
    try {
      const res = await upsertChallengeStarterTemplateAction({
        challengeId,
        language,
        starterCode: codeByLanguage[language] || "",
      });
      if (res.error) {
        setSaveError(res.error);
      } else {
        setSavedLanguage(language);
        setTimeout(() => setSavedLanguage(null), 2000);
      }
    } catch {
      setSaveError("Unable to save starter code. Please try again.");
    } finally {
      setSavingLanguage(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#C2C6D1] flex items-center gap-1.5">
          <Code size={14} className="text-[#6E79F4]" /> Starter Code Per Language
        </h4>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setActiveLanguage(lang.code)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeLanguage === lang.code
                ? "bg-[#6E79F4] text-white"
                : "bg-[#1A1C22] text-[#C2C6D1] hover:bg-[#23252C]"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      <div className="border border-[#23252C] rounded-xl overflow-hidden">
        <Editor
          height="220px"
          language={LANGUAGES.find((l) => l.code === activeLanguage)?.monaco || "plaintext"}
          value={codeByLanguage[activeLanguage] || ""}
          onChange={(value) =>
            setCodeByLanguage((prev) => ({ ...prev, [activeLanguage]: value || "" }))
          }
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => handleSaveStarterCode(activeLanguage)}
        disabled={savingLanguage === activeLanguage}
        className="bg-[#6E79F4] hover:bg-[#6E79F4]/90 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1.5 disabled:opacity-50"
      >
        {savingLanguage === activeLanguage ? (
          <Loader2 size={12} className="animate-spin" />
        ) : savedLanguage === activeLanguage ? (
          <CheckCircle2 size={12} />
        ) : (
          <Save size={12} />
        )}
        {savedLanguage === activeLanguage
          ? "Saved"
          : `Save ${LANGUAGES.find((l) => l.code === activeLanguage)?.label} Starter`}
      </button>

      {saveError && <p role="alert" className="text-xs text-[#F0555D]">{saveError}</p>}

      <div className="pt-3 border-t border-[#23252C]">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={strictMode}
            onChange={async (e) => {
              const value = e.target.checked;
              onStrictModeChange(value);
              // Persisted immediately (unlike starter code, there's no separate save
              // button for this toggle in every context it's rendered in).
              await updateChallengeStrictModeAction(challengeId, value);
            }}
            className="rounded text-[#6E79F4] focus:ring-[#6E79F4] border-[#23252C]"
          />
          <span className="font-semibold text-[#EDEFF5] flex items-center gap-1">
            <ShieldAlert size={13} className="text-[#F0555D]" />
            Enable Lockdown Mode (fullscreen required, tab-switch/exit forfeits the attempt)
          </span>
        </label>
      </div>
    </div>
  );
}
