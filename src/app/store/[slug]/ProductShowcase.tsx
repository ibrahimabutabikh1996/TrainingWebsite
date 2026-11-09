"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Truck, ShieldCheck, MessageCircle } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import {
  MAX_LINE_QTY,
  categoryLabel,
  firstAvailable,
  flavorsFor,
  formatIQD,
  priceFor,
  variantQty,
  type StoreProduct,
} from "@/lib/store/types";
import { useCart } from "../cart";
import { ProductVisual } from "../ProductVisual";
import { ProductCard } from "../StoreHome";
import { useReveal } from "../useReveal";

export default function ProductShowcase({ product: p, related }: { product: StoreProduct; related: StoreProduct[] }) {
  const { add, settings } = useCart();
  /* A visitor lands on something that can be bought. */
  const start = firstAvailable(p);
  const [size, setSize] = useState<string | null>(start ? start.size : (p.sizes[0]?.label ?? null));
  const [flavor, setFlavor] = useState<string | null>(start ? start.flavor : (p.flavors[0] ?? null));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  /* The flavours offered at this size that have their own photo. Those photos
     are the gallery, and picking a flavour or a photo moves the other. */
  const shotsFor = (s: string | null) => {
    const offered = flavorsFor(p, s);
    return p.flavor_images.filter((f) => offered.includes(f.label));
  };
  const flavorShots = shotsFor(size);
  const [shot, setShot] = useState(() => Math.max(0, flavorShots.findIndex((f) => f.label === flavor)));
  const gallery = flavorShots.length > 0 ? [...flavorShots.map((f) => f.src), ...p.images.filter((src) => !p.flavor_images.some((f) => f.src === src))] : p.images.length > 0 ? p.images : [null];
  const offered = flavorsFor(p, size);
  const inStock = (s: string | null, f: string | null) => {
    const left = variantQty(p, s, f);
    return left === null || left > 0;
  };
  /* A flavour that is out at the new size gives way to one that is not. */
  const pickSize = (label: string) => {
    const options = flavorsFor(p, label);
    const next = flavor !== null && options.includes(flavor) && inStock(label, flavor) ? flavor : (options.find((f) => inStock(label, f)) ?? options[0] ?? null);
    setSize(label);
    setFlavor(next);
    setShot(Math.max(0, shotsFor(label).findIndex((f) => f.label === next)));
  };
  const pickFlavor = (label: string) => {
    setFlavor(label);
    const at = flavorShots.findIndex((f) => f.label === label);
    if (at >= 0) setShot(at);
  };
  const pickShot = (i: number) => {
    setShot(i);
    if (flavorShots[i]) setFlavor(flavorShots[i].label);
  };

  const left = variantQty(p, size, flavor);
  const soldOut = left !== null && left <= 0;
  const maxQty = Math.max(1, Math.min(MAX_LINE_QTY, left ?? MAX_LINE_QTY));
  const shownQty = Math.min(qty, maxQty);
  const price = priceFor(p, size);
  const basePrice = priceFor(p);
  const compare = p.compare_at_price && p.compare_at_price > basePrice ? p.compare_at_price : null;

  useReveal([p.id]);

  const addToCart = () => {
    if (soldOut) return;
    add(p, { size, flavor, qty: shownQty, image_url: flavorShots.find((f) => f.label === flavor)?.src });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="st-product" style={{ "--accent": p.accent } as React.CSSProperties}>
      <section className="st-p-buy">
        <div className="st-p-buy-grid">
          <div className="st-p-buy-visual">
            <div className="st-gallery">
              <div className="st-gallery-main">
                <ProductVisual
                  key={shot}
                  name={p.name}
                  category={p.category}
                  accent={p.accent}
                  image_url={gallery[shot] ?? null}
                  size={420}
                  priority
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="ui-btn ui-btn--icon st-gallery-nav st-gallery-nav--prev"
                      onClick={() => pickShot((shot - 1 + gallery.length) % gallery.length)}
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn--icon st-gallery-nav st-gallery-nav--next"
                      onClick={() => pickShot((shot + 1) % gallery.length)}
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
                      onClick={() => pickShot(i)}
                      aria-label={`الصورة ${i + 1}`}
                    >
                      <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={url} size={64} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="st-p-buy-panel">
            <div className="st-p-buy-head">
              <nav className="st-crumbs" aria-label="مسار التصفح">
                <Link href="/store">المتجر</Link>
                <ChevronLeft aria-hidden="true" />
                <span>{categoryLabel(p.category)}</span>
                <ChevronLeft aria-hidden="true" />
                <span aria-current="page">{p.name}</span>
              </nav>
              <h1>{p.name}</h1>
              <div className="st-p-price">
                <strong>{formatIQD(price)}</strong>
                {compare && price === basePrice && <s>{formatIQD(compare)}</s>}
              </div>
              {p.tagline && <p className="st-p-tagline">{p.tagline}</p>}
            </div>

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
                      onClick={() => pickSize(s.label)}
                    >
                      <strong>{s.label}</strong>
                      <span>{formatIQD(s.price)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {offered.length > 0 && (
              <div className="st-option">
                <label className="st-option-label" htmlFor="st-flavor">النكهة</label>
                <CustomSelect
                  id="st-flavor"
                  className="st-select"
                  value={flavor ?? ""}
                  onChange={pickFlavor}
                  options={offered.map((f) => (inStock(size, f) ? { value: f, label: f } : { value: f, label: `${f} — نفدت`, disabled: true }))}
                />
              </div>
            )}

            <div className="st-p-buy-row">
              <div className="st-qty st-qty--lg" role="group" aria-label="الكمية">
                <button type="button" className="ui-btn ui-btn--icon" onClick={() => setQty(Math.min(maxQty, shownQty + 1))} aria-label="زيادة" disabled={shownQty >= maxQty}>
                  <Plus aria-hidden="true" />
                </button>
                <span aria-live="polite">{shownQty}</span>
                <button type="button" className="ui-btn ui-btn--icon" onClick={() => setQty(Math.max(1, shownQty - 1))} aria-label="إنقاص" disabled={shownQty <= 1}>
                  <Minus aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className="btn-primary st-btn st-btn--lg"
                onClick={addToCart}
                disabled={soldOut}
              >
                {soldOut ? "نفدت الكمية" : added ? <><Check aria-hidden="true" /> أُضيف للسلة</> : <><ShoppingBag aria-hidden="true" /> أضف إلى السلة</>}
              </button>
            </div>

            {shownQty > 1 && (
              <div className="st-p-buy-total">
                <span>الإجمالي</span>
                <strong>{formatIQD(price * shownQty)}</strong>
              </div>
            )}

            {left !== null && left > 0 && left <= 5 && (
              <p className="st-low-stock">{left === 1 ? "باقي قطعة واحدة فقط" : `باقي ${left} قطع فقط`}</p>
            )}

            <div className="st-p-accordion">
              {(p.description || p.features.length > 0) && (
                <details className="st-p-acc" open>
                  <summary>الوصف<ChevronDown aria-hidden="true" /></summary>
                  <div className="st-p-acc-body">
                    {p.description && <p>{p.description}</p>}
                    {p.features.length > 0 && (
                      <ul>
                        {p.features.map((f, i) => (
                          <li key={i}><strong>{f.title}:</strong> {f.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )}
              {p.nutrition.length > 0 && (
                <details className="st-p-acc">
                  <summary>القيم الغذائية<ChevronDown aria-hidden="true" /></summary>
                  <div className="st-p-acc-body">
                    <dl className="st-facts">
                      {p.nutrition.map((n, i) => (
                        <div key={i}>
                          <dt>{n.label}</dt>
                          <dd>{n.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
              )}
              {p.usage.length > 0 && (
                <details className="st-p-acc">
                  <summary>طريقة الاستخدام<ChevronDown aria-hidden="true" /></summary>
                  <div className="st-p-acc-body">
                    <ol className="st-steps">
                      {p.usage.map((u, i) => (
                        <li key={i}>
                          <span>{i + 1}</span>
                          <p>{u}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              )}
              {p.ingredients && (
                <details className="st-p-acc">
                  <summary>المكونات<ChevronDown aria-hidden="true" /></summary>
                  <div className="st-p-acc-body">
                    <p>{p.ingredients}</p>
                  </div>
                </details>
              )}
            </div>

            <ul className="st-p-perks">
              <li><Truck aria-hidden="true" />{settings.free_delivery_over > 0 ? `توصيل مجاني فوق ${formatIQD(settings.free_delivery_over)}` : "توصيل لكل المحافظات"}</li>
              {settings.perk_original && <li><ShieldCheck aria-hidden="true" />{settings.perk_original}</li>}
              {settings.perk_order && <li><MessageCircle aria-hidden="true" />{settings.perk_order}</li>}
            </ul>
          </div>
        </div>
      </section>

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
