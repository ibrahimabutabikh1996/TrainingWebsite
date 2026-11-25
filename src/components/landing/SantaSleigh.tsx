"use client";
import { useEffect, useRef } from "react";

/* Santa's sleigh and reindeer: a Lottie animation, "Santa Claus Sleigh Ride"
 * by MJ Mograph on LottieFiles (Lottie Simple License — free, commercial use
 * allowed). Four reindeer on a real run cycle, Santa and the sleigh bobbing,
 * looping in place. Faces right.
 *
 * ChristmasEffect flies this across the hero and mirrors it for the return
 * trip (christmas-effect.css, `.xmas-sleigh-track`); this component only plays
 * the loop. The player is lottie-web's light build — SVG only, no expressions,
 * which this file does not use — imported here on mount, so it is fetched with
 * the rest of the Christmas effect and never while the switch is off.
 *
 * The file's own canvas is 800×600 with the drawing in a band across its
 * middle; VIEWBOX crops to that band so the box on the page is the sleigh. */

const SRC = "/images/christmas/santa-sleigh.json";
/* Measured: the union of the drawing's bounds over one loop is x 109–679,
   y 127–422 of the 800×600 canvas. A few units of margin around that. */
const VIEWBOX = "102 120 584 310";

export default function SantaSleigh({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let anim: { play(): void; pause(): void; destroy(): void } | null = null;

    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled || !ref.current) return;
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: true,
        autoplay: !document.hidden,
        path: SRC,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet", viewBoxSize: VIEWBOX },
      });
    });

    // No reason to run the loop on a tab nobody is looking at.
    const onVisibility = () => (document.hidden ? anim?.pause() : anim?.play());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      anim?.destroy();
    };
  }, []);

  return <div ref={ref} className="xmas-santa" onClick={onClick} aria-hidden="true" />;
}
