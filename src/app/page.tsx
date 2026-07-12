"use client";

import React, { useEffect, useState } from "react";
import { Terminal, ArrowRight } from "lucide-react";

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate continuous scroll-based transformations (unbounded, spins as you scroll)
  const rotateX = scrollY * 0.05;    // Continuous rotation on X
  const rotateY = scrollY * -0.08;   // Continuous rotation on Y
  const rotateZ = scrollY * 0.015;   // Continuous rotation on Z
  
  // Z-axis separation between text layers (capped to a maximum so layers stay cohesive)
  const zOffset = Math.min(scrollY * 0.15, 80);

  // Dynamic opacity indicator for visual blending
  const opacityProgress = Math.min(scrollY / 300, 1);

  return (
    <div className="min-h-[300vh] bg-[#F8FAFC] font-sans text-[#0F172A] selection:bg-[#2563EB]/10 selection:text-[#2563EB] flex flex-col overflow-x-hidden">
      
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl border border-[#2563EB]/20">
              <Terminal size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[#0F172A] tracking-tight text-sm leading-tight">Hynox Campus</span>
              <span className="text-[10px] text-[#475569] font-medium tracking-wide">ACADEMIC ENGINE v1.0</span>
            </div>
          </div>

          <div>
            <a 
              href="/login" 
              className="bg-[#2563EB] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md hover:bg-[#2563EB]/95 hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
            >
              Portal Login
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Main 3D Hero Section */}
      <main className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="text-center px-4 select-none flex flex-col items-center">
          
          {/* Under Development Badge */}
          <div className="mb-6 inline-flex items-center gap-2 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            Site is under Development
          </div>

          {/* 3D Perspective Wrapper */}
          <div 
            style={{ perspective: "1200px" }}
            className="flex items-center justify-center"
          >
            {/* Transform Target */}
            <div
              style={{
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
                transformStyle: "preserve-3d",
                transition: "transform 0.05s ease-out",
              }}
              className="relative flex items-center justify-center p-8"
            >
              {/* Layer 5 (Deepest Cyan Highlight Layer) */}
              <h1
                style={{
                  transform: `translateZ(${-zOffset * 2}px)`,
                  opacity: Math.max(0.1, opacityProgress * 0.4),
                }}
                className="absolute text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#06B6D4] transition-all duration-700 ease-out select-none blur-sm"
              >
                Hynox Campus
              </h1>

              {/* Layer 4 (Blue Shadow Layer) */}
              <h1
                style={{
                  transform: `translateZ(${-zOffset * 1.5}px)`,
                  opacity: Math.max(0.2, opacityProgress * 0.6),
                }}
                className="absolute text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#2563EB]/40 transition-all duration-700 ease-out select-none"
              >
                Hynox Campus
              </h1>

              {/* Layer 3 (Muted Mid Layer) */}
              <h1
                style={{
                  transform: `translateZ(${-zOffset}px)`,
                  opacity: Math.max(0.3, opacityProgress * 0.8),
                }}
                className="absolute text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#475569]/50 transition-all duration-700 ease-out select-none"
              >
                Hynox Campus
              </h1>

              {/* Layer 2 (Soft Highlight Shadow) */}
              <h1
                style={{
                  transform: `translateZ(${-zOffset * 0.5}px)`,
                  opacity: Math.max(0.4, opacityProgress * 0.9),
                }}
                className="absolute text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#2563EB]/10 transition-all duration-700 ease-out select-none"
              >
                Hynox Campus
              </h1>

              {/* Layer 1 (Front Active Layer) */}
              <h1
                style={{
                  transform: "translateZ(0px)",
                }}
                className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#0F172A] select-none drop-shadow-sm"
              >
                Hynox Campus
              </h1>
            </div>
          </div>

          {/* Action button inside viewport */}
          <div className="mt-12 pointer-events-auto">
            <a 
              href="/login" 
              className="inline-flex items-center gap-2 bg-[#0F172A] text-white text-sm font-semibold px-8 py-3.5 rounded-xl shadow-lg hover:bg-[#0F172A]/90 transition-all hover:shadow-xl duration-200"
            >
              Enter the Campus
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </main>

      {/* Decorative Interactive Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div 
          style={{ transform: `translateY(${scrollY * -0.2}px)` }} 
          className="absolute top-1/4 left-1/10 w-96 h-96 bg-[#2563EB]/5 rounded-full filter blur-3xl"
        />
        <div 
          style={{ transform: `translateY(${scrollY * -0.4}px)` }} 
          className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-[#06B6D4]/5 rounded-full filter blur-3xl"
        />
      </div>

      {/* Scroll Spacers to facilitate continuous scroll interactions */}
      <div className="h-[300vh] pointer-events-none" />

    </div>
  );
}
