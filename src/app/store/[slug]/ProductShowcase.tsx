"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Truck, ShieldCheck, MessageCircle } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import {
  MAX_LINE_QTY,
  categoryLabel,
  formatIQD,
  isSoldOut,
  priceFor,
  type StoreProduct,
} from "@/lib/store/types";
import { FLAVOR_IMAGES } from "@/lib/store/flavorImages";
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
  /* The flavours on sale that have their own photo. With two or more, those
     photos are the gallery, and picking a flavour or a photo moves the other. */
  const listed = (FLAVOR_IMAGES[p.slug] ?? []).filter((f) => p.flavors.includes(f.label));
  const flavorShots = listed.length > 1 ? listed : [];
  const [shot, setShot] = useState(() => Math.max(0, flavorShots.findIndex((f) => f.label === p.flavors[0])));
  const gallery = flavorShots.length > 0 ? flavorShots.map((f) => f.src) : p.images.length > 0 ? p.images : [null];
  const pickFlavor = (label: string) => {
    setFlavor(label);
    const at = flavorShots.findIndex((f) => f.label === label);
    if (at >= 0) setShot(at);
  };
  const pickShot = (i: number) => {
    setShot(i);
    if (flavorShots[i]) setFlavor(flavorShots[i].label);
  };

  const soldOut = isSoldOut(p);
  const price = priceFor(p, size);
  const basePrice = priceFor(p);
  const compare = p.compare_at_price && p.compare_at_price > basePrice ? p.compare_at_price : null;

  useReveal([p.id]);

  const addToCart = () => {
    if (soldOut) return;
    add(p, { size, flavor, qty, image_url: flavorShots.find((f) => f.label === flavor)?.src });
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
              <div className="st-option">
                <label className="st-option-label" htmlFor="st-flavor">النكهة</label>
                <CustomSelect
                  id="st-flavor"
                  className="st-select"
                  value={flavor ?? ""}
                  onChange={pickFlavor}
                  options={p.flavors.map((f) => ({ value: f, label: f }))}
                />
              </div>
            )}

            <div className="st-p-buy-row">
              <div className="st-qty st-qty--lg" role="group" aria-label="الكمية">
                <button type="button" className="ui-btn ui-btn--icon" onClick={() => setQty((q) => Math.min(MAX_LINE_QTY, q + 1))} aria-label="زيادة">
                  <Plus aria-hidden="true" />
                </button>
                <span aria-live="polite">{qty}</span>
                <button type="button" className="ui-btn ui-btn--icon" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص" disabled={qty <= 1}>
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

            {qty > 1 && (
              <div className="st-p-buy-total">
                <span>الإجمالي</span>
                <strong>{formatIQD(price * qty)}</strong>
              </div>
            )}

            {p.stock !== null && p.stock > 0 && p.stock <= 5 && (
              <p className="st-low-stock">باقي {p.stock} قطع فقط</p>
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
              <li><ShieldCheck aria-hidden="true" />منتج أصلي مضمون</li>
              <li><MessageCircle aria-hidden="true" />تأكيد الطلب عبر واتساب والدفع عند الاستلام</li>
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
