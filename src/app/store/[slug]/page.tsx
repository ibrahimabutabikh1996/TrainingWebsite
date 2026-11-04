import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProducts } from "@/lib/store/catalog";
import ProductShowcase from "./ProductShowcase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getActiveProducts()).find((p) => p.slug === slug);
  if (!product) return { title: "المنتج غير موجود | متجر المكملات" };
  return {
    title: `${product.name} | متجر المكملات الغذائية`,
    description: product.tagline || product.description.slice(0, 150),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getActiveProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();

  /* Same category first, then the rest, never the product itself. */
  const related = [
    ...products.filter((p) => p.id !== product.id && p.category === product.category),
    ...products.filter((p) => p.id !== product.id && p.category !== product.category),
  ].slice(0, 4);

  return <ProductShowcase product={product} related={related} />;
}
