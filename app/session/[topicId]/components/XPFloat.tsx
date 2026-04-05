"use client";

import { useEffect, useState } from "react";

interface XPFloatProps {
  xpDelta: number;
  trigger: number; // increment to re-trigger
}

export function XPFloat({ xpDelta, trigger }: XPFloatProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1100);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: "38%",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 100,
        animation: "xpFloat 1s ease-out forwards",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--color-accent-amber)",
          textShadow: "0 0 20px rgba(245,158,11,0.6)",
          whiteSpace: "nowrap",
        }}
      >
        +{xpDelta} XP
      </span>

      <style>{`
        @keyframes xpFloat {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0px) scale(0.7); }
          20%  { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1.1); }
          70%  { opacity: 1; transform: translateX(-50%) translateY(-32px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-56px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
