"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSeasonalFlags } from "@/app/seasonal-actions";
import { rememberSeason } from "./season-memory";

/* The Christmas effect for every page but the landing page: falling snow,
 * nothing else — the panels are places people work. (The Santa hat on the
 * logo was taken off and deleted at the owner's request.)
 *
 * Mounted once in the root layout, so it survives client navigations and asks
 * for the switch once per visit. With the switch off, nothing below is
 * downloaded at all.
 *
 * Left out:
 *  - "/" and /cms-preview — ChristmasEffect draws the landing page's own,
 *    following the content manager's unsaved switch so the preview is live;
 *  - /export-* — those pages are photographed into PDFs. */

const SnowCanvas = dynamic(() => import("./SnowCanvas"), { ssr: false });
/* The store's dressing (lights, snow on the buttons and cards, Santa's sleigh):
   fetched only on /store, and only with the switch on. */
const StoreChristmasDecor = dynamic(
  () => import("@/components/landing/ChristmasDecor").then((m) => m.StoreChristmasDecor),
  { ssr: false }
);

function isExcluded(path: string) {
  return path === "/" || path.startsWith("/cms-preview") || path.startsWith("/export-");
}

export default function SeasonalLayer() {
  const pathname = usePathname() ?? "/";
  const excluded = isExcluded(pathname);
  const [on, setOn] = useState(false);

  /* Asked on every page, excluded ones too, because the answer is also kept
     for the loading screens (SeasonalLoader), which draw before any data. */
  useEffect(() => {
    /* No "ask only once" guard: in development React runs this twice, and the
       guard kept the second run from asking while the first run's answer was
       thrown away by `alive` — so the snow never came on outside the landing
       page. In production this runs once per visit (the layout persists). */
    let alive = true;
    getSeasonalFlags()
      .then((f) => {
        rememberSeason(f.christmas);
        if (alive) setOn(f.christmas);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!on || excluded) return null;
  return (
    <>
      <SnowCanvas />
      {pathname.startsWith("/store") && <StoreChristmasDecor />}
    </>
  );
}
