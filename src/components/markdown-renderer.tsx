"use client";

import React from "react";

export function MarkdownRenderer({ content }: { content?: string | null }) {
  if (!content) return null;

  // Split content by code blocks to separate text from code blocks
  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 font-sans text-xs text-[#E6E8EF] leading-relaxed break-words">
      {blocks.map((block, i) => {
        if (block.startsWith("```")) {
          // Parse code block
          const match = block.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : "";
          const code = match ? match[2] : block.slice(3, -3);
          return (
            <pre key={i} className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto font-mono text-[11px] my-2 border border-slate-800 shadow-inner">
              {lang && <div className="text-[9px] uppercase tracking-wider text-[#A3A9B6] mb-1 font-sans font-bold">{lang}</div>}
              <code>{code}</code>
            </pre>
          );
        } else {
          // Parse paragraph blocks
          const lines = block.split(/\n/);
          let currentList: { type: 'ul' | 'ol', items: string[] } | null = null;
          const parsedElements: React.ReactNode[] = [];

          const renderTextWithStyles = (text: string) => {
            const parts: React.ReactNode[] = [];
            const tokenRegex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5|(\[(.*?)\]\((.*?)\))/g;
            let match;
            let lastIndex = 0;

            while ((match = tokenRegex.exec(text)) !== null) {
              if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
              }

              if (match[1]) { // Bold
                parts.push(<strong key={match.index} className="font-bold text-[#EDEFF5]">{match[2]}</strong>);
              } else if (match[3]) { // Italic
                parts.push(<em key={match.index} className="italic text-[#E2E4EB]">{match[4]}</em>);
              } else if (match[5]) { // Inline code
                parts.push(<code key={match.index} className="bg-[#1A1C22] text-[#EDEFF5] px-1 py-0.5 rounded font-mono text-[10px] border border-[#23252C]">{match[6]}</code>);
              } else if (match[7]) { // Link
                parts.push(
                  <a 
                    key={match.index} 
                    href={match[9]} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[#6E79F4] hover:underline font-semibold inline-flex items-center gap-0.5"
                  >
                    {match[8]}
                  </a>
                );
              }

              lastIndex = tokenRegex.lastIndex;
            }

            if (lastIndex < text.length) {
              parts.push(text.substring(lastIndex));
            }

            return parts.length > 0 ? parts : text;
          };

          const flushList = (keyPrefix: number) => {
            if (!currentList) return;
            const ListTag = currentList.type;
            const listClass = currentList.type === 'ul' ? 'list-disc pl-5 my-2 space-y-1' : 'list-decimal pl-5 my-2 space-y-1';
            parsedElements.push(
              <ListTag key={`list-${keyPrefix}`} className={listClass}>
                {currentList.items.map((item, idx) => (
                  <li key={idx} className="text-[#E6E8EF]">{renderTextWithStyles(item)}</li>
                ))}
              </ListTag>
            );
            currentList = null;
          };

          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmed = line.trim();

            // Headings
            if (trimmed.startsWith('# ')) {
              flushList(lineIndex);
              parsedElements.push(<h1 key={lineIndex} className="text-sm font-bold text-[#EDEFF5] mt-4 mb-2 border-b border-[#1F2128] pb-1">{renderTextWithStyles(trimmed.slice(2))}</h1>);
            } else if (trimmed.startsWith('## ')) {
              flushList(lineIndex);
              parsedElements.push(<h2 key={lineIndex} className="text-xs font-bold text-[#EDEFF5] mt-3.5 mb-1.5">{renderTextWithStyles(trimmed.slice(3))}</h2>);
            } else if (trimmed.startsWith('### ')) {
              flushList(lineIndex);
              parsedElements.push(<h3 key={lineIndex} className="text-[11px] font-bold text-[#EDEFF5] mt-3 mb-1">{renderTextWithStyles(trimmed.slice(4))}</h3>);
            } else if (trimmed.startsWith('#### ')) {
              flushList(lineIndex);
              parsedElements.push(<h4 key={lineIndex} className="text-[10px] font-bold text-[#EDEFF5] mt-2.5 mb-1">{renderTextWithStyles(trimmed.slice(5))}</h4>);
            }
            // Blockquotes
            else if (trimmed.startsWith('>')) {
              flushList(lineIndex);
              parsedElements.push(
                <blockquote key={lineIndex} className="border-l-4 border-[#6E79F4] bg-[#16171D] pl-3 py-1.5 italic text-[#C2C6D1] my-2 rounded-r-md">
                  {renderTextWithStyles(trimmed.replace(/^>\s*/, ''))}
                </blockquote>
              );
            }
            // Unordered List Items
            else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
              const listContent = trimmed.slice(2);
              if (!currentList || currentList.type !== 'ul') {
                flushList(lineIndex);
                currentList = { type: 'ul', items: [listContent] };
              } else {
                currentList.items.push(listContent);
              }
            }
            // Ordered List Items
            else if (/^\d+\.\s+/.test(trimmed)) {
              const listContent = trimmed.replace(/^\d+\.\s+/, '');
              if (!currentList || currentList.type !== 'ol') {
                flushList(lineIndex);
                currentList = { type: 'ol', items: [listContent] };
              } else {
                currentList.items.push(listContent);
              }
            }
            // Empty line
            else if (trimmed === '') {
              flushList(lineIndex);
              parsedElements.push(<div key={lineIndex} className="h-1" />);
            }
            // Normal paragraph text
            else {
              flushList(lineIndex);
              parsedElements.push(
                <p key={lineIndex} className="leading-relaxed mb-1.5 text-justify">
                  {renderTextWithStyles(line)}
                </p>
              );
            }
          }
          flushList(lines.length);

          return <React.Fragment key={i}>{parsedElements}</React.Fragment>;
        }
      })}
    </div>
  );
}
