"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShoppingBag, Truck, Wallet } from "lucide-react";
import { ProductVisual } from "@/app/store/ProductVisual";
import { SEED_PRODUCTS } from "@/lib/store/seed";
import {
  pickShowcaseProducts,
  storePromoShown,
  storePromoText,
  toShowcaseProduct,
  type ShowcaseProduct,
  type StorePromoTextKey,
} from "@/lib/storePromo";
import "./store-showcase.css";

/* The landing page's way into the supplements store: one card, green-lit,
 * with three products standing in it.
 *
 * Under the cursor the products drift against the pointer and a light
 * follows it across the glass. A click plays the way in — the edge flares,
 * the products rise towards you, and a green light opens from the point
 * clicked until it fills the screen — and then the store opens.
 *
 * It is a real link to /store underneath, so a middle-click, a ⌘-click, a
 * screen reader and a browser without JS all just go to the store. Only a
 * plain click is held for the animation, and not for anyone who has asked
 * for reduced motion.
 *
 * The texts and the three products are the coach's, from the content
 * manager's "قسم المتجر" tab — see @/lib/storePromo for the keys, the
 * defaults and how the products are picked. The products come from the
 * store's active list the page reads; the seed catalogue stands in only if a
 * caller passes none. */

const SEED_SHOWCASE: ShowcaseProduct[] = SEED_PRODUCTS.map(toShowcaseProduct);

/** How long the way-in plays before the store opens, in ms. */
const LAUNCH_MS = 620;

/** `hidden` is the content manager's "قسم المتجر" switch (`section_store_active`);
 *  `content` is the landing content the texts and picks are read from. */
export function StoreShowcase({
  hidden = false,
  content = {},
  products,
}: {
  hidden?: boolean;
  content?: Record<string, unknown>;
  products?: ShowcaseProduct[];
}) {
  const router = useRouter();
  const shown = pickShowcaseProducts(content, products && products.length > 0 ? products : SEED_SHOWCASE);
  const text = (key: StorePromoTextKey) => storePromoText(content, key);
  const on = (key: StorePromoTextKey) => storePromoShown(content, key);
  const cardRef = useRef<HTMLAnchorElement>(null);
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

  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0 → 1
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
    el.style.setProperty("--dx", (px - 0.5).toFixed(3));
    el.style.setProperty("--dy", (py - 0.5).toFixed(3));
  };

  const onPointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--dx", "0");
    el.style.setProperty("--dy", "0");
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle anything that is not a plain click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (launch) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    setLaunch({ x: e.clientX, y: e.clientY });
    timer.current = window.setTimeout(() => router.push("/store"), LAUNCH_MS);
  };

  return (
    <section id="store-promo" className="ssc-section" style={{ display: hidden ? "none" : undefined }}>
      {/* The outline behind the products. `-webkit-text-stroke` strokes each
          Arabic letter on its own, so the joins between letters showed as
          lines across the word. This draws the word filled, grows it by the
          line's width and cuts the original out — one outline around the
          whole word. */}
      <svg className="ssc-defs" aria-hidden="true" focusable="false">
        <filter id="ssc-word-outline" x="-5%" y="-10%" width="110%" height="120%">
          <feMorphology in="SourceGraphic" operator="dilate" radius="1.5" result="grown" />
          <feComposite in="grown" in2="SourceGraphic" operator="out" />
        </filter>
      </svg>
      <div className="ssc-inner">
        {/* `reveal` is on a wrapper, not the card: the landing page's scroll
            reveal adds `visible` to it from outside React, and the card's own
            class changes when it launches — on the same element React would
            write the class back without `visible` and the card would vanish. */}
        <div className="reveal">
          <Link
            ref={cardRef}
            href="/store"
            className={`ssc-card${launch ? " is-launching" : ""}`}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onMouseEnter={() => router.prefetch("/store")}
            onClick={onClick}
            aria-label="ادخل متجر المكملات الغذائية"
          >
            <span className="ssc-spot" aria-hidden="true" />
            {on("store_promo_word") && <span className="ssc-word" aria-hidden="true">{text("store_promo_word")}</span>}

            <div className="ssc-text">
              {on("store_promo_badge") && (
                <span className="ssc-badge">
                  <ShoppingBag aria-hidden="true" />
                  {text("store_promo_badge")}
                </span>
              )}
              {on("store_promo_title") && <h3 className="ssc-title">{text("store_promo_title")}</h3>}
              {on("store_promo_desc") && <p className="ssc-desc">{text("store_promo_desc")}</p>}
              {(on("store_promo_perk1") || on("store_promo_perk2") || on("store_promo_perk3")) && (
                <ul className="ssc-perks">
                  {on("store_promo_perk1") && <li><Truck aria-hidden="true" /> {text("store_promo_perk1")}</li>}
                  {on("store_promo_perk2") && <li><Wallet aria-hidden="true" /> {text("store_promo_perk2")}</li>}
                  {on("store_promo_perk3") && <li><BadgeCheck aria-hidden="true" /> {text("store_promo_perk3")}</li>}
                </ul>
              )}
              {on("store_promo_cta") && (
                <span className="ssc-cta">
                  {text("store_promo_cta")}
                  <ArrowLeft aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="ssc-stage" aria-hidden="true">
              <span className="ssc-halo" />
              {shown.map((p, i) => (
                <span key={p.slug} className={`ssc-product ssc-product--${i}`}>
                  <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={260} />
                </span>
              ))}
            </div>
          </Link>
        </div>
      </div>

      {/* The light that opens from the click and fills the screen. */}
      {launch && (
        <span
          className="ssc-wipe"
          aria-hidden="true"
          style={{ "--wx": `${launch.x}px`, "--wy": `${launch.y}px` } as CSSProperties}
        />
      )}
    </section>
  );
}
