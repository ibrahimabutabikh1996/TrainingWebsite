"use client";

import StoreHome from "../store/StoreHome";
import ProductShowcase from "../store/[slug]/ProductShowcase";
import { useStorePreview } from "./StorePreviewRoot";

/* The two storefront pages, fed from the preview's live content rather than
   from the server, so an edit shows the moment it is made. */

export function PreviewHome() {
  const { products, settings } = useStorePreview();
  return <StoreHome products={products} settings={settings} />;
}

export function PreviewProduct({ slug }: { slug: string }) {
  const { products } = useStorePreview();
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    return <p style={{ padding: "var(--space-12)", textAlign: "center" }}>هذا المنتج غير معروض حالياً في المتجر.</p>;
  }
  /* Same choice as the real product page: same category first, then the rest. */
  const related = [
    ...products.filter((p) => p.id !== product.id && p.category === product.category),
    ...products.filter((p) => p.id !== product.id && p.category !== product.category),
  ].slice(0, 4);
  return <ProductShowcase product={product} related={related} />;
}
