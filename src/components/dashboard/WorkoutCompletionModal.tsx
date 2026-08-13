"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

interface WorkoutCompletionModalProps {
  isOpen: boolean;
  dayNumber: number;
  onClose: () => void;
}

interface ConfettiPiece {
  id: number;
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  shape: "circle" | "rect" | "star";
}

const CONFETTI_COLORS = [
  "#C9A84C", // Primary Gold
  "#E8C96A", // Gold Hover
  "#22c55e", // Success Green
  "#f97316", // Vibrant Orange
  "#38bdf8", // Bright Blue
  "#ec4899", // Pink Sparkle
  "#ffffff", // White
];

export function WorkoutCompletionModal({ isOpen, dayNumber, onClose }: WorkoutCompletionModalProps) {
  const [mounted, setMounted] = useState(false);

  const handleClose = React.useCallback(() => {
    onClose();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") handleClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleClose]);

  const confetti = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.floor(Math.random() * 10) + 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 0.6,
      duration: Math.random() * 2 + 2.2,
      rotation: Math.random() * 720 - 360,
      shape: i % 3 === 0 ? "star" : i % 2 === 0 ? "circle" : "rect",
    }));
  }, []);

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        backdropFilter: "blur(3px)",
        pointerEvents: "none",
        animation: "wlFadeIn 0.25s ease-out forwards",
      }}
    >
      <style jsx global>{`
        @keyframes wlFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wlPopUp {
          0% { transform: scale(0.85) translateY(20px); opacity: 0; }
          80% { transform: scale(1.03) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes wlConfettiFall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
        @keyframes wlBounceTrophy {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.06); }
        }
      `}</style>

      {/* Confetti Animation Layer */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {confetti.map((c) => (
          <div
            key={c.id}
            style={{
              position: "absolute",
              top: "-40px",
              left: `${c.left}%`,
              width: c.size,
              height: c.shape === "rect" ? c.size * 1.8 : c.size,
              borderRadius: c.shape === "circle" ? "50%" : c.shape === "star" ? "2px" : "3px",
              background: c.color,
              clipPath:
                c.shape === "star"
                  ? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
                  : undefined,
              boxShadow: "0 0 6px rgba(255, 255, 255, 0.3)",
              animation: `wlConfettiFall ${c.duration}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Compact Celebratory Popup Dialog */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          pointerEvents: "auto",
          width: "100%",
          maxWidth: "400px",
          background: "var(--bg2)",
          border: "1.5px solid color-mix(in srgb, var(--primary) 55%, var(--border))",
          borderRadius: "var(--radius-xl)",
          padding: "26px 24px 22px 24px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.65), 0 0 35px color-mix(in srgb, var(--primary) 25%, transparent)",
          animation: "wlPopUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "14px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            fontSize: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
          }}
          title="إغلاق"
        >
          <Icon name="close" />
        </button>

        {/* Compact Trophy & Glowing Header */}
        <div
          style={{
            width: "70px",
            height: "70px",
            margin: "0 auto 14px auto",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--bg3) 0%, color-mix(in srgb, var(--primary) 22%, var(--bg2)) 100%)",
            border: "1.5px solid var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            fontSize: "36px",
            animation: "wlBounceTrophy 2.5s infinite ease-in-out",
            boxShadow: "0 8px 25px color-mix(in srgb, var(--primary) 30%, transparent)",
          }}
        >
          🏆
        </div>

        {/* Concise Title */}
        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--text)",
            margin: "0 0 8px 0",
            lineHeight: 1.3,
          }}
        >
          ألف مبروك يا بطل! 🔥 💪
        </h3>

        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 18px 0",
            padding: "0 10px",
          }}
        >
          تم إنهاء يومك التدريبي بنجاح! انضباطك واستمرارتك اليوم هما دليلك الحقيقي نحو بناء الجسد المثالي والوصول لهدفه.
        </p>

        {/* Compact Achievement Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "22px",
          }}
        >
          <span
            style={{
              background: "color-mix(in srgb, var(--primary) 12%, var(--bg3))",
              color: "var(--primary)",
              border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
              padding: "5px 12px",
              borderRadius: "var(--radius-pill)",
              fontSize: "0.84rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Icon name="verified" style={{ fontSize: "16px" }} />
            <span>اليوم {dayNumber} مكتمل</span>
          </span>

          <span
            style={{
              background: "color-mix(in srgb, var(--success, #22c55e) 15%, var(--bg3))",
              color: "var(--success, #22c55e)",
              border: "1px solid color-mix(in srgb, var(--success, #22c55e) 30%, transparent)",
              padding: "5px 12px",
              borderRadius: "var(--radius-pill)",
              fontSize: "0.84rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Icon name="bolt" style={{ fontSize: "16px" }} />
            <span>الهمة: 100% 🦍</span>
          </span>
        </div>

        {/* Compact Primary Action */}
        <button
          type="button"
          onClick={handleClose}
          className="dash-primary-btn"
          style={{
            width: "100%",
            padding: "12px 20px",
            fontSize: "1rem",
            fontWeight: 800,
            justifyContent: "center",
            gap: "10px",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
          }}
        >
          <span>استمر في العظمة (إغلاق)</span>
          <Icon name="check" style={{ fontSize: "20px" }} />
        </button>
      </div>
    </div>,
    document.body
  );
}
