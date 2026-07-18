"use client";

import React, { useEffect, useRef } from "react";

// Full-screen interactive particle field (2D canvas).
// Particles drift through a procedural flow field with a gentle wave motion,
// and are repelled by the cursor with velocity-scaled force — the
// "pop and scatter" interaction from antigravity.google-style sites.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number; // 0..1 palette index
  phase: number; // per-particle wave offset
};

const PALETTE = [
  "96, 165, 250", // blue-400
  "56, 189, 248", // sky-400
  "129, 140, 248", // indigo-400
  "226, 232, 240", // slate-200 (white sparkle)
];

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const isLowEnd =
      (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4) ||
      // @ts-expect-error deviceMemory not in all lib.dom typings
      (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);

    const dpr = Math.min(window.devicePixelRatio || 1, isLowEnd ? 1 : 2);
    let width = 0;
    let height = 0;

    const particles: Particle[] = [];

    function targetCount() {
      // Density-based count, capped for performance.
      const area = width * height;
      return Math.min(isLowEnd ? 160 : 320, Math.max(80, Math.floor(area / 6500)));
    }

    function spawn(randomVelocity = false): Particle {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: randomVelocity ? (Math.random() - 0.5) * 0.4 : 0,
        vy: randomVelocity ? (Math.random() - 0.5) * 0.4 : 0,
        size: 0.8 + Math.random() * 1.8,
        hue: Math.random(),
        phase: Math.random() * Math.PI * 2,
      };
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = targetCount();
      while (particles.length < n) particles.push(spawn(true));
      particles.length = n;
    }

    // Pointer state (in CSS pixels). Starts far off-screen so nothing reacts
    // until the user actually moves the mouse.
    const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false };

    function onPointerMove(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }
    function onPointerLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    }

    let running = true;
    let rafId = 0;
    let last = performance.now();

    function frame(now: number) {
      if (!running) return;
      // Clamp dt so a background tab doesn't cause a physics explosion.
      const dt = Math.min((now - last) / 16.667, 2.5);
      last = now;
      const time = now * 0.001;

      // Cursor velocity — faster mouse movement throws particles harder.
      pointer.vx = pointer.x - pointer.px;
      pointer.vy = pointer.y - pointer.py;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      const cursorSpeed = Math.min(Math.hypot(pointer.vx, pointer.vy), 60);

      // Dark backdrop with slight trail persistence for a fluid look.
      ctx!.fillStyle = "rgba(5, 8, 16, 0.34)";
      ctx!.fillRect(0, 0, width, height);

      const radius = Math.min(width, height) * 0.16 + 60;
      const radiusSq = radius * radius;

      for (const p of particles) {
        // Flow field: layered sines give a continuous wave-like drift.
        const angle =
          Math.sin(p.x * 0.0022 + time * 0.35 + p.phase) * 1.6 +
          Math.cos(p.y * 0.0025 - time * 0.28) * 1.6;
        p.vx += Math.cos(angle) * 0.02 * dt;
        p.vy += (Math.sin(angle) * 0.02 + Math.sin(time * 0.9 + p.phase) * 0.006) * dt;

        // Mouse repulsion — instant pop with falloff, scaled by cursor speed.
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < radiusSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const falloff = 1 - dist / radius;
            const force = (falloff * falloff * (1.6 + cursorSpeed * 0.12)) / dist;
            p.vx += dx * force * dt;
            p.vy += dy * force * dt;
          }
        }

        // Damping (viscosity) so scattered particles settle back into flow.
        p.vx *= 0.955;
        p.vy *= 0.955;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Wrap around the edges to keep the field continuous.
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        // Brighter + slightly larger when energetic (just after a scatter).
        const speed = Math.hypot(p.vx, p.vy);
        const energy = Math.min(speed * 0.35, 1);
        const alpha = 0.25 + energy * 0.65;
        const size = p.size * (1 + energy * 0.9);

        const rgb = PALETTE[Math.floor(p.hue * PALETTE.length)];
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx!.fill();
      }

      rafId = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    }

    resize();
    // Solid first paint so the trail fade starts from pure dark.
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, width, height);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    rafId = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 h-full w-full bg-[#050810] pointer-events-none select-none motion-reduce:hidden"
      />
      {/* Reduced-motion / no-JS fallback */}
      <div className="hidden motion-reduce:block fixed inset-0 bg-[radial-gradient(ellipse_at_center,_#0b1220_0%,_#050810_70%)]" />
      {/* Soft vignette so the login card pops */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(5,8,16,0.55)_100%)]" />
    </>
  );
}
