"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Truck, ShieldCheck, MessageCircle } from "lucide-react";
import {
  MAX_LINE_QTY,
  categoryLabel,
  formatIQD,
  isSoldOut,
  priceFor,
  type StoreProduct,
} from "@/lib/store/types";
import { useCart } from "../cart";
import { ProductVisual } from "../ProductVisual";
import { ProductCard } from "../StoreHome";
import { useReveal } from "../useReveal";

export default function ProductShowcase({ product: p, related }: { product: StoreProduct; related: StoreProduct[] }) {
  const { add, settings } = useCart();
  const [size, setSize] = useState<string | null>(p.sizes[0]?.label ?? null);
  const [flavor, setFlavor] = useState<string | null>(p.flavors[0] ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [shot, setShot] = useState(0);
  const gallery = p.images.length > 0 ? p.images : [null];
  /* A feature row shows the next picture along, so a gallery is seen as the page scrolls. */
  const featureImage = (i: number) => (p.images.length > 1 ? p.images[(i + 1) % p.images.length] : p.image_url);
  const heroRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLElement>(null);

  const soldOut = isSoldOut(p);
  const price = priceFor(p, size);
  const basePrice = priceFor(p);
  const compare = p.compare_at_price && p.compare_at_price > basePrice ? p.compare_at_price : null;

  useReveal([p.id]);

  /* The hero picture settles as the page scrolls past it, and the buy bar
     slides in once the hero is gone. `--p` is 0 at the top, 1 when the hero
     has scrolled away; only `transform` and `opacity` read it. */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      if (!reduce) hero.style.setProperty("--p", progress.toFixed(3));
      setShowBar(rect.bottom < 80);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const addToCart = () => {
    if (soldOut) return;
    add(p, { size, flavor, qty });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const scrollToBuy = () => buyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="st-product" style={{ "--accent": p.accent } as React.CSSProperties}>
      {/* Sticky buy bar */}
      <div className={`st-buybar${showBar ? " is-shown" : ""}`} aria-hidden={!showBar} inert={!showBar}>
        <div className="st-buybar-inner">
          <strong>{p.name}</strong>
          <div className="st-buybar-actions">
            <span>{formatIQD(price)}</span>
            <button type="button" className="btn-primary st-btn st-btn--sm" onClick={scrollToBuy}>
              اشترِ الآن
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="st-crumbs" aria-label="مسار التصفح">
        <Link href="/store">المتجر</Link>
        <ChevronLeft aria-hidden="true" />
        <span>{categoryLabel(p.category)}</span>
        <ChevronLeft aria-hidden="true" />
        <span aria-current="page">{p.name}</span>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="st-p-hero">
        <div className="st-p-hero-copy">
          <span className="st-eyebrow st-reveal">{categoryLabel(p.category)}</span>
          <h1 className="st-reveal">{p.name}</h1>
          <p className="st-p-tagline st-reveal">{p.tagline}</p>
          <div className="st-p-hero-price st-reveal">
            <span>يبدأ من</span>
            <strong>{formatIQD(basePrice)}</strong>
            {compare && <s>{formatIQD(compare)}</s>}
          </div>
          <div className="st-hero-actions st-reveal">
            <button type="button" className="btn-primary st-btn" onClick={scrollToBuy} disabled={soldOut}>
              {soldOut ? "نفدت الكمية" : "اشترِ الآن"}
            </button>
            <a href="#overview" className="st-link">
              تعرّف عليه <ChevronLeft aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="st-p-hero-visual">
          <div className="st-p-glow" aria-hidden="true" />
          <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={520} priority />
        </div>
      </section>

      {/* HIGHLIGHTS */}
      {p.highlights.length > 0 && (
        <section id="overview" className="st-p-highlights">
          {p.highlights.map((h, i) => (
            <div key={i} className="st-p-stat st-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <strong dir="ltr">{h.value}</strong>
              <span>{h.label}</span>
            </div>
          ))}
        </section>
      )}

      {/* STORY */}
      {p.description && (
        <section className="st-p-story">
          <p className="st-reveal">{p.description}</p>
        </section>
      )}

      {/* FEATURES */}
      {p.features.length > 0 && (
        <section className="st-p-features">
          {p.features.map((f, i) => (
            <article key={i} className={`st-p-feature st-reveal${i % 2 ? " is-flipped" : ""}`}>
              <div className="st-p-feature-copy">
                <span className="st-p-feature-num">0{i + 1}</span>
                <h2>{f.title}</h2>
                <p>{f.text}</p>
              </div>
              <div className="st-p-feature-visual" aria-hidden="true">
                <div className="st-p-ring" />
                <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={featureImage(i)} size={280} />
              </div>
            </article>
          ))}
        </section>
      )}

      {/* BUY */}
      <section ref={buyRef} id="buy" className="st-p-buy">
        <div className="st-section-head st-reveal">
          <h2>اختر طلبك.</h2>
          <p>{p.name}</p>
        </div>
        <div className="st-p-buy-grid">
          <div className="st-p-buy-visual st-reveal">
            <div className="st-gallery">
              <div className="st-gallery-main">
                <ProductVisual
                  key={shot}
                  name={p.name}
                  category={p.category}
                  accent={p.accent}
                  image_url={gallery[shot] ?? null}
                  size={420}
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="st-gallery-nav st-gallery-nav--prev"
                      onClick={() => setShot((n) => (n - 1 + gallery.length) % gallery.length)}
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="st-gallery-nav st-gallery-nav--next"
                      onClick={() => setShot((n) => (n + 1) % gallery.length)}
                      aria-label="الصورة التالية"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="st-gallery-thumbs" role="tablist" aria-label="صور المنتج">
                  {gallery.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={shot === i}
                      className={`st-gallery-thumb${shot === i ? " is-active" : ""}`}
                      onClick={() => setShot(i)}
                      aria-label={`الصورة ${i + 1}`}
                    >
                      <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={url} size={64} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="st-p-buy-panel st-reveal">
            {p.sizes.length > 0 && (
              <fieldset className="st-option">
                <legend>الحجم</legend>
                <div className="st-option-grid">
                  {p.sizes.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className={`st-option-btn${size === s.label ? " is-active" : ""}`}
                      aria-pressed={size === s.label}
                      onClick={() => setSize(s.label)}
                    >
                      <strong>{s.label}</strong>
                      <span>{formatIQD(s.price)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {p.flavors.length > 0 && (
              <fieldset className="st-option">
                <legend>النكهة</legend>
                <div className="st-option-grid st-option-grid--pills">
                  {p.flavors.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`st-option-btn st-option-btn--pill${flavor === f ? " is-active" : ""}`}
                      aria-pressed={flavor === f}
                      onClick={() => setFlavor(f)}
                    >
                      {flavor === f && <Check aria-hidden="true" />}
                      {f}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="st-option">
              <legend>الكمية</legend>
              <div className="st-qty st-qty--lg" role="group" aria-label="الكمية">
                <button type="button" onClick={() => setQty((q) => Math.min(MAX_LINE_QTY, q + 1))} aria-label="زيادة">
                  <Plus aria-hidden="true" />
                </button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص" disabled={qty <= 1}>
                  <Minus aria-hidden="true" />
                </button>
              </div>
            </fieldset>

            <div className="st-p-buy-total">
              <span>الإجمالي</span>
              <strong>{formatIQD(price * qty)}</strong>
            </div>

            <button
              type="button"
              className="btn-primary st-btn st-btn--block st-btn--lg"
              onClick={addToCart}
              disabled={soldOut}
            >
              {soldOut ? "نفدت الكمية" : added ? <><Check aria-hidden="true" /> أُضيف للسلة</> : <><ShoppingBag aria-hidden="true" /> أضف إلى السلة</>}
            </button>

            {p.stock !== null && p.stock > 0 && p.stock <= 5 && (
              <p className="st-low-stock">باقي {p.stock} قطع فقط</p>
            )}

            <ul className="st-p-perks">
              <li><Truck aria-hidden="true" />{settings.free_delivery_over > 0 ? `توصيل مجاني فوق ${formatIQD(settings.free_delivery_over)}` : "توصيل لكل المحافظات"}</li>
              <li><ShieldCheck aria-hidden="true" />منتج أصلي مضمون</li>
              <li><MessageCircle aria-hidden="true" />تأكيد الطلب عبر واتساب والدفع عند الاستلام</li>
            </ul>
          </div>
        </div>
      </section>

      {/* DETAILS */}
      {(p.nutrition.length > 0 || p.ingredients || p.usage.length > 0) && (
        <section className="st-p-details">
          {p.nutrition.length > 0 && (
            <div className="st-p-panel st-reveal">
              <h2>القيم الغذائية</h2>
              <dl className="st-facts">
                {p.nutrition.map((n, i) => (
                  <div key={i}>
                    <dt>{n.label}</dt>
                    <dd>{n.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {p.usage.length > 0 && (
            <div className="st-p-panel st-reveal">
              <h2>طريقة الاستخدام</h2>
              <ol className="st-steps">
                {p.usage.map((u, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    <p>{u}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {p.ingredients && (
            <div className="st-p-panel st-p-panel--wide st-reveal">
              <h2>المكونات</h2>
              <p>{p.ingredients}</p>
            </div>
          )}
        </section>
      )}

      {/* RELATED */}
      {related.length > 0 && (
        <section className="st-catalog st-related">
          <div className="st-section-head st-reveal">
            <h2>قد يعجبك أيضاً</h2>
          </div>
          <div className="st-grid">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
