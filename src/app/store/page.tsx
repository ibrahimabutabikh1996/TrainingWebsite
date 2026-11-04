import { getActiveProducts, getStoreSettings } from "@/lib/store/catalog";
import StoreHome from "./StoreHome";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [products, settings] = await Promise.all([getActiveProducts(), getStoreSettings()]);
  return <StoreHome products={products} settings={settings} />;
}
