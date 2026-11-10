"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import "./store-showcase.css";

/* The store button in the hero, with the same way in as the store card
 * further down the page (StoreShowcase): the edge turns on its own, a press
 * flares it, a green light opens from the point pressed until it fills the
 * screen, and then the store opens.
 *
 * It is a real link to /store, so a middle-click, a ⌘-click, a screen reader
 * and a browser without JS all just go to the store. Only a plain click is
 * held for the animation, and not for anyone who has asked for reduced motion.
 *
 * The light goes to <body> through a portal because `.hero-content` carries
 * the parallax transform, and `position: fixed` inside a transformed element
 * is measured against that element rather than the screen. */

/** How long the way-in plays before the store opens, in ms. */
const LAUNCH_MS = 620;

/** `hidden` is the content manager's store button switch (`store_button_active`). */
export function StoreHeroButton({ hidden = false }: { hidden?: boolean }) {
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
    timer.current = window.setTimeout(() => router.push("/store"), LAUNCH_MS);
  };

  return (
    <>
      <Link
        href="/store"
        className={`nav-store-btn hero-store-btn${launch ? " is-launching" : ""}`}
        style={{ display: hidden ? "none" : undefined }}
        onMouseEnter={() => router.prefetch("/store")}
        onClick={onClick}
      >
        <ShoppingBag aria-hidden="true" className="nav-store-btn-icon" />
        <span className="nav-store-btn-full">متجر المكملات الغذائية</span>
        <span className="nav-store-btn-short">المتجر</span>
        <ArrowLeft aria-hidden="true" className="nav-store-btn-icon hero-store-btn-arrow" />
      </Link>

      {launch &&
        createPortal(
          <span
            className="ssc-wipe hero-store-wipe"
            aria-hidden="true"
            style={{ "--wx": `${launch.x}px`, "--wy": `${launch.y}px` } as CSSProperties}
          />,
          document.body,
        )}
    </>
  );
}
