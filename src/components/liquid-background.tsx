"use client";

import React, { useEffect, useRef } from "react";

// GPGPU simulation: each texel represents one particle's (x, y, vx, vy).
// Particles drift through a gentle procedural flow field and are pushed by
// cursor proximity, with damping so motion settles smoothly (inertia +
// viscosity), then wrap around the edges to keep the field continuous.
const SIM_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tPos;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uMouseVelocity;
  uniform float uMouseActive;
  varying vec2 vUv;

  void main() {
    vec4 data = texture2D(tPos, vUv);
    vec2 pos = data.xy;
    vec2 vel = data.zw;

    float n1 = sin(pos.x * 5.0 + uTime * 0.25 + vUv.y * 12.0);
    float n2 = cos(pos.y * 5.0 - uTime * 0.22 + vUv.x * 12.0);
    vec2 flow = vec2(n2, -n1) * 0.00075;

    vec2 d = pos - uMouse;
    float dist = length(d);
    float radius = 0.16;
    float falloff = smoothstep(radius, 0.0, dist);
    float speed = length(uMouseVelocity);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0, 0.0);
    vec2 cursorForce = dir * falloff * (0.018 + clamp(speed * 22.0, 0.0, 0.06)) * uMouseActive;

    vel += flow + cursorForce;
    vel *= 0.945;
    pos += vel;

    if (pos.x < -0.06) pos.x += 1.12;
    if (pos.x > 1.06) pos.x -= 1.12;
    if (pos.y < -0.06) pos.y += 1.12;
    if (pos.y > 1.06) pos.y -= 1.12;

    gl_FragColor = vec4(pos, vel);
  }
`;

const SIM_VERTEX = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Particle render pass: soft round points, colored from a muted four-tone
// palette (echoing Google's brand hues without the saturation), brighter
// and slightly larger when moving with more energy.
const POINT_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec2 reference;
  uniform sampler2D tPos;
  uniform float uPointSize;
  varying float vSpeed;
  varying vec2 vSeed;

  void main() {
    vec4 data = texture2D(tPos, reference);
    vec2 pos = data.xy;
    vSpeed = length(data.zw);
    vSeed = reference;
    vec2 clip = vec2(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = uPointSize * (0.7 + clamp(vSpeed * 26.0, 0.0, 1.0) * 1.6);
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  varying float vSpeed;
  varying vec2 vSeed;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    float alpha = smoothstep(1.0, 0.0, d);
    if (alpha <= 0.001) discard;

    float hue = fract(vSeed.x * 3.7 + vSeed.y * 5.3);
    vec3 color = hue < 0.25 ? uColor1 : hue < 0.5 ? uColor2 : hue < 0.75 ? uColor3 : uColor4;

    float energy = clamp(vSpeed * 30.0, 0.0, 1.0);
    alpha *= 0.32 + energy * 0.55;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function LiquidBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const host = canvasHostRef.current;
    if (!container || !host) return;

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotionQuery.matches) {
      return;
    }

    let disposed = false;
    let cleanupFns: Array<() => void> = [];

    (async () => {
      const { Renderer, Triangle, Geometry, Program, Mesh, RenderTarget } = await import("ogl");
      if (disposed || !host) return;

      const isLowEnd =
        (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4) ||
        // @ts-expect-error deviceMemory not in all lib.dom typings
        (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, isLowEnd ? 1 : 1.75),
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
      });
      const gl = renderer.gl;
      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("OES_texture_float_linear");
      gl.clearColor(1, 1, 1, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      canvasHostRef.current?.appendChild(gl.canvas);
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      gl.canvas.style.display = "block";

      const simSize = isLowEnd ? 56 : 92;
      const count = simSize * simSize;

      const initial = new Float32Array(count * 4);
      const references = new Float32Array(count * 2);
      for (let j = 0; j < simSize; j++) {
        for (let i = 0; i < simSize; i++) {
          const idx = i + j * simSize;
          const rx = Math.random();
          const ry = Math.random();
          initial[idx * 4 + 0] = rx;
          initial[idx * 4 + 1] = ry;
          initial[idx * 4 + 2] = 0;
          initial[idx * 4 + 3] = 0;
          references[idx * 2 + 0] = (i + 0.5) / simSize;
          references[idx * 2 + 1] = (j + 0.5) / simSize;
        }
      }

      const makeRT = (data: Float32Array | null) => {
        const rt = new RenderTarget(gl, {
          width: simSize,
          height: simSize,
          type: (gl as any).HALF_FLOAT ?? gl.FLOAT,
          internalFormat: (gl as WebGL2RenderingContext).RGBA16F ?? gl.RGBA,
          format: gl.RGBA,
          minFilter: gl.NEAREST,
          magFilter: gl.NEAREST,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          depth: false,
        });
        if (data) {
          gl.bindTexture(gl.TEXTURE_2D, rt.texture.texture);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, simSize, simSize, gl.RGBA, gl.FLOAT, data);
        }
        return rt;
      };

      let rtA = makeRT(initial);
      let rtB = makeRT(null);

      const simGeometry = new Triangle(gl);
      const simProgram = new Program(gl, {
        vertex: SIM_VERTEX,
        fragment: SIM_FRAGMENT,
        uniforms: {
          tPos: { value: rtA.texture },
          uTime: { value: 0 },
          uMouse: { value: [0.5, 0.5] },
          uMouseVelocity: { value: [0, 0] },
          uMouseActive: { value: 1 },
        },
      });
      const simMesh = new Mesh(gl, { geometry: simGeometry, program: simProgram });

      const pointGeometry = new Geometry(gl, {
        reference: { size: 2, data: references },
      });

      const pointProgram = new Program(gl, {
        vertex: POINT_VERTEX,
        fragment: POINT_FRAGMENT,
        uniforms: {
          tPos: { value: rtA.texture },
          uPointSize: { value: 3 },
          uColor1: { value: [0.26, 0.52, 0.96] }, // muted blue
          uColor2: { value: [0.92, 0.4, 0.36] }, // muted red
          uColor3: { value: [0.98, 0.73, 0.28] }, // muted yellow
          uColor4: { value: [0.26, 0.66, 0.42] }, // muted green
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const pointMesh = new Mesh(gl, { geometry: pointGeometry, program: pointProgram, mode: gl.POINTS });

      let width = 0;
      let height = 0;

      function resize() {
        const rect = container!.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        renderer.setSize(width, height);
        pointProgram.uniforms.uPointSize.value = (isLowEnd ? 2.4 : 3.2) * Math.min(window.devicePixelRatio || 1, 1.75);
      }

      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const pointer = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5, vx: 0, vy: 0 };
      let ambientAngle = Math.random() * Math.PI * 2;

      function setPointerFromClient(clientX: number, clientY: number) {
        const rect = container!.getBoundingClientRect();
        pointer.x = (clientX - rect.left) / rect.width;
        pointer.y = (clientY - rect.top) / rect.height;
      }
      function onPointerMove(e: PointerEvent) {
        setPointerFromClient(e.clientX, e.clientY);
      }

      resize();
      window.addEventListener("resize", resize);
      if (!isCoarsePointer) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      } else {
        window.addEventListener(
          "touchmove",
          (e) => {
            const t = e.touches[0];
            if (t) setPointerFromClient(t.clientX, t.clientY);
          },
          { passive: true }
        );
      }

      let running = true;
      let rafId = 0;

      function onVisibility() {
        if (document.hidden) {
          running = false;
          if (rafId) cancelAnimationFrame(rafId);
        } else if (!running) {
          running = true;
          rafId = requestAnimationFrame(tick);
        }
      }
      document.addEventListener("visibilitychange", onVisibility);

      function stepFrame(t: number) {
        const time = t * 0.001;

        if (isCoarsePointer) {
          ambientAngle += 0.0018;
          pointer.x = 0.5 + Math.cos(ambientAngle) * 0.3;
          pointer.y = 0.5 + Math.sin(ambientAngle * 0.85) * 0.3;
        }

        pointer.vx = pointer.x - pointer.prevX;
        pointer.vy = pointer.y - pointer.prevY;
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;

        simProgram.uniforms.uTime.value = time;
        simProgram.uniforms.uMouse.value = [pointer.x, pointer.y];
        simProgram.uniforms.uMouseVelocity.value = [pointer.vx, pointer.vy];
        simProgram.uniforms.tPos.value = rtA.texture;

        renderer.render({ scene: simMesh, target: rtB });
        [rtA, rtB] = [rtB, rtA];

        pointProgram.uniforms.tPos.value = rtA.texture;
        renderer.render({ scene: pointMesh });
      }

      function tick(t: number) {
        if (!running) return;
        stepFrame(t);
        rafId = requestAnimationFrame(tick);
      }

      stepFrame(performance.now());
      if (!document.hidden) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
      }

      cleanupFns.push(() => {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", onVisibility);
        gl.canvas.remove();
        const loseCtx = gl.getExtension("WEBGL_lose_context");
        loseCtx?.loseContext();
      });
    })();

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={containerRef} aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-white">
      <div ref={canvasHostRef} className="absolute inset-0 h-full w-full motion-reduce:hidden" />

      {/* Reduced-motion fallback: static, no WebGL/JS animation loop */}
      <div className="hidden motion-reduce:block absolute inset-0 liquid-fallback-gradient" />

      <style jsx>{`
        .liquid-fallback-gradient {
          background: linear-gradient(120deg, #ffffff 0%, #f3f6ff 30%, #fff5f2 55%, #f3fbf5 80%, #ffffff 100%);
          background-size: 300% 300%;
          animation: liquid-drift 34s ease-in-out infinite;
        }
        @keyframes liquid-drift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
