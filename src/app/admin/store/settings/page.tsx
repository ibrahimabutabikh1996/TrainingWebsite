import { getStoreSettings } from "@/lib/store/catalog";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const settings = await getStoreSettings();
  return <SettingsClient initialSettings={settings} />;
}
