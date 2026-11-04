import { getCustomers } from "../data";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function StoreCustomersPage() {
  const customers = await getCustomers();
  return <CustomersClient initialCustomers={customers ?? []} tablesMissing={customers === null} />;
}
