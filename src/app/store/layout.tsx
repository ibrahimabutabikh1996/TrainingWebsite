import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store/catalog";
import StoreShell from "./StoreShell";
import "./store.css";

export const metadata: Metadata = {
  title: "متجر المكملات الغذائية",
  description: "بروتين، كرياتين، بري وركاوت وفيتامينات مختارة من الكابتن إبراهيم — اطلب مباشرة عبر واتساب مع توصيل لكل العراق.",
};

/* Settings are read per request so a change in the panel shows at once. */
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings();
  return <StoreShell settings={settings}>{children}</StoreShell>;
}
