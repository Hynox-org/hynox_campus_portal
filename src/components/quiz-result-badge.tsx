"use client";

import { Trophy, XCircle } from "lucide-react";

// A celebratory (pass) or somber-but-still-alive (fail) animated reveal for
// a quiz result. Pass bursts a small ring pulse + confetti shards around a
// bouncing trophy; fail gets a quick shake-in on an X badge — motion in both
// cases, but tonally distinct so a failed attempt doesn't feel celebratory.
export function QuizResultBadge({ passed }: { passed: boolean }) {
  const confettiPieces = passed
    ? Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const distance = 60 + (i % 3) * 18;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const colors = ["#2FBF71", "#6E79F4", "#F5B04A", "#F0555D", "#0EA5E9"];
        return {
          x,
          y,
          r: (i % 2 === 0 ? 1 : -1) * (180 + i * 20),
          delay: 0.1 + (i % 5) * 0.05,
          color: colors[i % colors.length]
        };
      })
    : [];

  return (
    <div className="relative flex items-center justify-center h-24 mb-1">
      {passed && (
        <>
          <span className="absolute inset-0 m-auto w-16 h-16 rounded-full border-4 border-[#2FBF71]/40 animate-hc-ringPulse" style={{ animationDelay: "0.3s" }} />
          <span className="absolute inset-0 m-auto w-16 h-16 rounded-full border-4 border-[#2FBF71]/30 animate-hc-ringPulse" style={{ animationDelay: "0.7s" }} />
          {confettiPieces.map((p, i) => (
            <span
              key={i}
              className="absolute w-1.5 h-1.5 rounded-sm animate-hc-confetti"
              style={{
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                ["--hc-confetti-x" as any]: `${p.x}px`,
                ["--hc-confetti-y" as any]: `${p.y}px`,
                ["--hc-confetti-r" as any]: `${p.r}deg`
              }}
            />
          ))}
        </>
      )}
      <div
        className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
          passed
            ? "bg-gradient-to-br from-[#2FBF71] to-[#15803D] animate-hc-badgePopIn"
            : "bg-gradient-to-br from-[#F0555D] to-[#B91C1C] animate-hc-badgeShake"
        }`}
      >
        {passed ? (
          <Trophy size={30} className="text-white" fill="currentColor" strokeWidth={1.5} />
        ) : (
          <XCircle size={32} className="text-white" strokeWidth={2} />
        )}
      </div>
    </div>
  );
}
