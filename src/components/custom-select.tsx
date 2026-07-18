"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

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
  searchable?: boolean;
}

function optionLabel(opt: Option) {
  const suffix = opt.institution_code ? ` (${opt.institution_code})` : opt.code ? ` (${opt.code})` : "";
  return `${opt.name}${suffix}`;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "-- Select Option --",
  className = "",
  required = false,
  disabled = false,
  searchable = true,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // Let the dropdown mount before focusing the search field
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.id === value);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => optionLabel(opt).toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const showSearch = searchable && options.length > 6;

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-xs text-[#EDEFF5] ${className}`}>
      <button
        disabled={disabled}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-[#131418] border border-[#23252C] rounded-lg px-3 py-2 text-left focus:outline-none focus:border-[#6E79F4] focus:ring-1 focus:ring-[#6E79F4]/20 shadow-sm flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer hover:bg-[#16171D]/50 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className={`truncate ${selectedOption ? "text-[#EDEFF5] font-medium" : "text-[#C2C6D1]"}`}>
          {selectedOption ? optionLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#C2C6D1] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-[#6E79F4]" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-[#131418] border border-[#23252C] rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn scale-95 origin-top transition-all duration-150 ease-out">
          {showSearch && (
            <div className="relative border-b border-[#23252C] p-1.5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C2C6D1]" size={12} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-[#16171D] border border-transparent rounded-md pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-[#6E79F4] text-[#EDEFF5]"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between ${
                  !value ? "bg-[#6E79F4]/10 text-[#6E79F4] font-semibold" : "hover:bg-[#16171D] text-[#C2C6D1]"
                }`}
              >
                {placeholder}
                {!value && <Check size={14} className="shrink-0" />}
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? "bg-[#6E79F4]/10 text-[#6E79F4] font-semibold" : "hover:bg-[#16171D] text-[#EDEFF5]"
                    }`}
                  >
                    <span className="truncate">{optionLabel(opt)}</span>
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[#C2C6D1]">
                {options.length === 0 ? "No options available" : "No matches found"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
