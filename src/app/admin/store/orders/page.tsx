import { getOrders } from "../data";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function StoreOrdersPage() {
  const orders = await getOrders();
  return <OrdersClient initialOrders={orders ?? []} tablesMissing={orders === null} />;
}
