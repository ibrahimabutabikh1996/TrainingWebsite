"use client";

import { useId } from "react";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import { shapeFor } from "@/lib/store/types";

/* A product's picture. The coach's photograph when there is one; until then a
 * drawn container — a tub, a jar or a bottle, by category — in the product's
 * own colour, with its name on the label. It is an SVG so it stays sharp at
 * the showcase's hero size and costs nothing to download. */

interface ProductVisualProps {
  name: string;
  category: string;
  accent: string;
  image_url: string | null;
  /** The width it is drawn at, for picking the image size. */
  size?: number;
  className?: string;
  priority?: boolean;
}

export function ProductVisual({ name, category, accent, image_url, size = 400, className = "", priority }: ProductVisualProps) {
  const uid = useId().replace(/:/g, "");

  if (image_url) {
    const isLocal = image_url.startsWith("/");
    return (
      <div className={`st-visual ${className}`} style={{ "--accent": accent } as React.CSSProperties}>
        <img
          src={isLocal ? image_url : optimizedSrc(image_url, Math.min(1200, size * 2))}
          srcSet={isLocal ? undefined : optimizedSrcSet(image_url, [size, Math.min(1600, size * 2)])}
          sizes={`${size}px`}
          alt={name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
    );
  }

  const shape = shapeFor(category);
  const words = name.split(" ");
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
  const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");

  return (
    <div className={`st-visual st-visual--drawn ${className}`} style={{ "--accent": accent } as React.CSSProperties}>
      <svg viewBox="0 0 300 360" role="img" aria-label={name}>
        <defs>
          <linearGradient id={`body-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--bg)" }} />
            <stop offset="0.22" style={{ stopColor: "var(--bg3)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--bg2)" }} />
            <stop offset="0.82" style={{ stopColor: "var(--bg3)" }} />
            <stop offset="1" style={{ stopColor: "var(--bg)" }} />
          </linearGradient>
          <linearGradient id={`label-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="1" />
            <stop offset="1" stopColor={accent} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`lid-${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.55" />
            <stop offset="0.5" stopColor={accent} />
            <stop offset="1" stopColor={accent} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`shine-${uid}`} x1="0" x2="1">
            <stop offset="0" style={{ stopColor: "var(--text)", stopOpacity: 0 }} />
            <stop offset="0.5" style={{ stopColor: "var(--text)", stopOpacity: 0.18 }} />
            <stop offset="1" style={{ stopColor: "var(--text)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        <ellipse cx="150" cy="338" rx="110" ry="12" style={{ fill: "var(--bg)" }} opacity="0.5" />

        {shape === "tub" && (
          <g>
            <rect x="62" y="40" width="176" height="34" rx="10" fill={`url(#lid-${uid})`} />
            <rect x="62" y="66" width="176" height="6" style={{ fill: "var(--bg)" }} opacity="0.3" />
            <path d="M58 78 h184 l-6 250 q0 10 -10 10 h-152 q-10 0 -10 -10 z" fill={`url(#body-${uid})`} />
            <rect x="64" y="128" width="172" height="150" fill={`url(#label-${uid})`} />
            <rect x="64" y="128" width="172" height="150" style={{ fill: "var(--bg)" }} opacity="0.15" />
          </g>
        )}
        {shape === "jar" && (
          <g>
            <rect x="88" y="62" width="124" height="36" rx="8" fill={`url(#lid-${uid})`} />
            <path d="M80 104 h140 q12 0 12 12 v206 q0 12 -12 12 h-140 q-12 0 -12 -12 v-206 q0 -12 12 -12 z" fill={`url(#body-${uid})`} />
            <rect x="68" y="150" width="164" height="130" fill={`url(#label-${uid})`} />
            <rect x="68" y="150" width="164" height="130" style={{ fill: "var(--bg)" }} opacity="0.15" />
          </g>
        )}
        {shape === "bottle" && (
          <g>
            <rect x="112" y="40" width="76" height="40" rx="8" fill={`url(#lid-${uid})`} />
            <path d="M118 80 h64 v16 q46 14 46 52 v176 q0 12 -12 12 h-132 q-12 0 -12 -12 v-176 q0 -38 46 -52 z" fill={`url(#body-${uid})`} />
            <rect x="72" y="170" width="156" height="120" fill={`url(#label-${uid})`} />
            <rect x="72" y="170" width="156" height="120" style={{ fill: "var(--bg)" }} opacity="0.15" />
          </g>
        )}

        <rect x="96" y="70" width="26" height="262" fill={`url(#shine-${uid})`} />

        <g fontFamily="inherit" textAnchor="middle" style={{ fill: "var(--text)" }}>
          <text x="150" y={shape === "tub" ? 178 : shape === "jar" ? 198 : 214} fontSize="22" fontWeight="700">
            {line1}
          </text>
          {line2 && (
            <text x="150" y={shape === "tub" ? 206 : shape === "jar" ? 224 : 240} fontSize="18" fontWeight="600" opacity="0.92">
              {line2}
            </text>
          )}
          <text x="150" y={shape === "tub" ? 258 : shape === "jar" ? 264 : 276} fontSize="10" letterSpacing="3" opacity="0.8">
            ABUTABIKH NUTRITION
          </text>
        </g>
      </svg>
    </div>
  );
}
