"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, SearchX } from "lucide-react";
import StoreStage from "./StoreStage";
import {
  STORE_CATEGORIES,
  categoryLabel,
  formatIQD,
  isSoldOut,
  priceFor,
  type StoreProduct,
  type StoreSettings,
} from "@/lib/store/types";
import { useCart } from "./cart";
import { ProductVisual } from "./ProductVisual";
import { useReveal } from "./useReveal";
import { PromotionalPopup } from "@/components/PromotionalPopup";
import { productFieldId } from "@/lib/store/content";
import { Editable } from "./StoreEditable";

export default function StoreHome({ products, settings }: { products: StoreProduct[]; settings: StoreSettings }) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  /* The stage shows every product, one banner each. */
  const stageProducts = products;

  const usedCategories = STORE_CATEGORIES.filter((c) => products.some((p) => p.category === c.key));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || `${p.name} ${p.tagline} ${p.brand} ${categoryLabel(p.category)}`.toLowerCase().includes(q))
    );
  }, [products, category, query]);

  useReveal([visible.map((p) => p.id).join()]);

  return (
    <>
      {/* The store's own pop-up, switched in the store settings — separate
          from the gym page's window. */}
      {settings.promo_active && (
        <PromotionalPopup
          title={settings.promo_title}
          description={settings.promo_desc}
          discount={settings.promo_discount || undefined}
          imageUrl={settings.promo_img_url}
          ctaText={settings.promo_cta || "تسوّق العروض الآن"}
          ctaLink="#catalog"
          endDate={settings.promo_end_date || undefined}
        />
      )}

      {/* STAGE — the featured products, one at a time. */}
      <StoreStage products={stageProducts} />

      {/* CATALOGUE */}
      <section id="catalog" className="st-catalog">
        <div className="st-section-head st-reveal">
          <Editable as="h1" field="catalog_title">{settings.catalog_title}</Editable>
          <Editable as="p" field="catalog_subtitle">{settings.catalog_subtitle}</Editable>
        </div>

        <div className="st-filters">
          <div className="st-chips" role="tablist" aria-label="الأقسام">
            <button
              type="button"
              role="tab"
              aria-selected={category === "all"}
              className={`st-chip${category === "all" ? " is-active" : ""}`}
              onClick={() => setCategory("all")}
            >
              الكل <span>{products.length}</span>
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={category === c.key}
                className={`st-chip${category === c.key ? " is-active" : ""}`}
                onClick={() => setCategory(c.key)}
              >
                {c.label} <span>{products.filter((p) => p.category === c.key).length}</span>
              </button>
            ))}
          </div>
          <label className="st-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن منتج…"
              aria-label="ابحث عن منتج"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="st-empty">
            <SearchX aria-hidden="true" />
            <p>لا توجد منتجات مطابقة</p>
            <button type="button" className="btn-secondary st-btn st-btn--ghost st-btn--sm" onClick={() => { setQuery(""); setCategory("all"); }}>
              عرض كل المنتجات
            </button>
          </div>
        ) : (
          <div className="st-grid">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function ProductCard({ product: p }: { product: StoreProduct }) {
  const { add } = useCart();
  const soldOut = isSoldOut(p);
  const price = priceFor(p);
  const compare = p.compare_at_price && p.compare_at_price > price ? p.compare_at_price : null;

  return (
    <article className="st-card st-reveal" style={{ "--accent": p.accent } as React.CSSProperties}>
      <Link href={`/store/${p.slug}`} className="st-card-link" aria-label={p.name}>
        <div className="st-card-visual">
          <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={260} />
          {soldOut ? (
            <span className="st-badge st-badge--muted">نفدت الكمية</span>
          ) : compare ? (
            <span className="st-badge">خصم {Math.round((1 - price / compare) * 100)}%</span>
          ) : p.is_featured ? (
            <span className="st-badge st-badge--soft">الأكثر طلباً</span>
          ) : null}
        </div>
        <div className="st-card-body">
          <span className="st-card-cat">{categoryLabel(p.category)}</span>
          <Editable as="h3" field={productFieldId(p.id, "name")}>{p.name}</Editable>
          <Editable as="p" field={productFieldId(p.id, "tagline")}>{p.tagline}</Editable>
        </div>
      </Link>
      <div className="st-card-foot">
        <div className="st-price">
          <strong>{formatIQD(price)}</strong>
          {compare && <s>{formatIQD(compare)}</s>}
        </div>
        <button
          type="button"
          className="st-add-btn"
          onClick={() => add(p)}
          disabled={soldOut}
          aria-label={soldOut ? `${p.name} — نفدت الكمية` : `أضف ${p.name} للسلة`}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
