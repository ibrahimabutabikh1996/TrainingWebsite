import type { MetadataRoute } from "next";

/**
 * Gives Android something to put on the home screen. Without a manifest,
 * "Add to home screen" fell back to a letter or a generic icon, because the
 * only icon on offer was the tab favicon. `display: "browser"` keeps the
 * shortcut opening in the normal browser with its address bar, as before;
 * iOS ignores this file and reads `apple-icon.png` instead.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ibrahim Abutabikh",
    short_name: "Ibrahim Abutabikh",
    description: "خطط تدريب وأنظمة غذائية مخصصة مع متابعة كاملة",
    start_url: "/",
    display: "browser",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
