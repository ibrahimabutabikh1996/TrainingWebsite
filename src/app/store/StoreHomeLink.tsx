"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/components/landing/store-showcase.css";

/* The way back to the main site from the store header, with the same way out
 * as the store button on the landing page: a press flares the edge, a light
 * opens from the point pressed until it fills the screen, and then the main
 * site opens. Blue here, from the page's own tokens.
 *
 * It is a real link to /, so a middle-click, a ⌘-click, a screen reader and a
 * browser without JS all just go there. Only a plain click is held for the
 * animation, and not for anyone who has asked for reduced motion.
 *
 * The light goes to <body> through a portal because the header takes a
 * `backdrop-filter` once the page scrolls, and `position: fixed` inside such
 * an element is measured against it rather than the screen. */

/** How long the way out plays before the main site opens, in ms. */
const LAUNCH_MS = 620;

export function StoreHomeLink({
  className,
  ariaLabel,
  children,
}: {
  className: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [launch, setLaunch] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);

  /* Coming back with the browser's back button can restore this page from
     the cache mid-animation; start it clean. */
  useEffect(() => {
    const reset = () => setLaunch(null);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle anything that is not a plain click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    if (launch) return;
    setLaunch({ x: e.clientX, y: e.clientY });
    timer.current = window.setTimeout(() => router.push("/"), LAUNCH_MS);
  };

  return (
    <>
      <Link
        href="/"
        className={`${className}${launch ? " is-launching" : ""}`}
        aria-label={ariaLabel}
        onMouseEnter={() => router.prefetch("/")}
        onClick={onClick}
      >
        {children}
      </Link>

      {launch &&
        createPortal(
          <span
            className="ssc-wipe"
            aria-hidden="true"
            style={{ "--wx": `${launch.x}px`, "--wy": `${launch.y}px` } as CSSProperties}
          />,
          document.body,
        )}
    </>
  );
}
