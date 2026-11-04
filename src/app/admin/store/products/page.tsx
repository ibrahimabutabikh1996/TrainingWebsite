import { getAllProducts } from "@/lib/store/catalog";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function StoreProductsPage() {
  const { products, isSample } = await getAllProducts();
  return <ProductsClient initialProducts={products} isSample={isSample} />;
}
