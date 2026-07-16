"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface Option {
  id: string;
  name: string;
  code?: string;
  [key: string]: any;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "-- Select Option --",
  className = "",
  required = false,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-xs text-[#1d1d1f] ${className}`}
    >
      <button
        disabled={disabled}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2 text-left focus:outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]/20 shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer hover:bg-slate-50/50 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className={selectedOption ? "text-[#1d1d1f] font-medium" : "text-[#86868b]"}>
          {selectedOption
            ? `${selectedOption.name}${selectedOption.institution_code ? ` (${selectedOption.institution_code})` : selectedOption.code ? ` (${selectedOption.code})` : ""}`
            : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#86868b] transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "transform rotate-180 text-[#0066cc]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-[#d2d2d7] rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto animate-fadeIn scale-95 origin-top transition-all duration-150 ease-out">
          {required && placeholder && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-[#86868b]"
            >
              {placeholder}
            </button>
          )}
          {!required && placeholder && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-[#86868b]"
            >
              {placeholder}
            </button>
          )}
          {options.length > 0 ? (
            options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between ${
                    isSelected
                      ? "bg-[#0066cc]/10 text-[#0066cc] font-semibold"
                      : "hover:bg-slate-50 text-[#1d1d1f]"
                  }`}
                >
                  <span>
                    {opt.name}
                    {opt.institution_code ? ` (${opt.institution_code})` : opt.code ? ` (${opt.code})` : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-center text-[#86868b]">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
