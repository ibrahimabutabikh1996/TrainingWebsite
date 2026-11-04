import { getAllProducts } from "@/lib/store/catalog";
import { getStockMovements } from "../data";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function StoreInventoryPage() {
  const [{ products, isSample }, movements] = await Promise.all([getAllProducts(), getStockMovements()]);
  return <InventoryClient initialProducts={products} initialMovements={movements ?? []} isSample={isSample || movements === null} />;
}
