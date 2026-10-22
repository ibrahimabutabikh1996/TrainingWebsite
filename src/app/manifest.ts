import type { MetadataRoute } from "next";

/**
 * Gives Android something to put on the home screen. Without a manifest,
 * "Add to home screen" fell back to a letter or a generic icon, because the
 * only icon on offer was the tab favicon. `display: "standalone"`, together
 * with the service worker in `public/sw.js`, makes the site installable as an
 * app that opens in its own window without the address bar; iOS ignores this
 * file and reads `apple-icon.png` instead.
 *
 * The two colours are `--bg` from `globals.css`, written out because a manifest
 * cannot read a CSS variable. Change them together.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ibrahim Abutabikh",
    short_name: "Ibrahim Abutabikh",
    description: "خطط تدريب وأنظمة غذائية مخصصة مع متابعة كاملة",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
    background_color: "#0A121A",
    theme_color: "#0A121A",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
