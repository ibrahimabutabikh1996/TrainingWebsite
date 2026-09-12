"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { driveFileId, drivePosterUrl, getEmbedUrl, isDirectMediaUrl, safeVideoUrl } from "@/lib/videoEmbed";
import "./VideoPlayer.css";

/**
 * The exercise library's video preview.
 *
 * What this replaces was a bare `<iframe>` pointed at Drive's `/preview`
 * viewer over a `background: #000`. Three things came out of that: the viewer
 * is an application, so it is slow to start; it is an application that can
 * decline to run, so the preview sometimes never appeared at all; and until it
 * did, the black ground behind it was the whole of what a coach saw.
 *
 * So the order here is: the still first, then whichever player can show it.
 *
 *   1. A Drive thumbnail is one small image and lands almost immediately, so
 *      the frame is never empty. This is the black screen's replacement, and it
 *      is shown under both of the routes below.
 *   2. A link to a media file plays in the browser's own `<video>` element —
 *      no viewer, no script, seeking is native.
 *   3. Everything else is framed, which for a Drive file means Drive's viewer.
 *
 * A Drive file does NOT take route 2, however much it looks like it should:
 * Google serves those bytes with a Cross-Origin-Resource-Policy that forbids
 * another site from loading them. The note above `drivePosterUrl` in
 * @/lib/videoEmbed has the detail, including why the address tests clean from
 * a terminal. An earlier version of this component tried route 2 for Drive and
 * fell back when it failed, which cost a round trip before the frame it was
 * always going to need could start.
 *
 * `preload` is the one thing a caller needs to decide, because it depends on
 * how many of these are on the screen at once — see the prop.
 */
export default function VideoPlayer({
  url,
  title,
  preload = "auto",
  maxHeight = "70vh",
}: {
  url: string;
  title?: string;
  /** "auto" for a player the viewer opened on purpose and is about to watch;
   *  "metadata" for one of many sitting in a list, where fetching every video
   *  in full is the cost the list cannot afford. */
  preload?: "auto" | "metadata";
  /** A ceiling on the player's height, published as `--vp-max-h` and spent by
   *  the stylesheet as a width cap at 16/9. At that ratio it works out wider
   *  than any container here and so never binds. The one frame that is not
   *  16/9 — the trainee's list on a phone — deliberately ignores it and takes
   *  the card's full width, carrying its own ceiling instead; see `.wl-video`
   *  in workout-log.css. */
  maxHeight?: string;
}) {
  const embedUrl = getEmbedUrl(url);
  const fileId = driveFileId(url);
  const poster = fileId ? drivePosterUrl(fileId) : null;

  /* A media file is the one thing that can go straight into a `<video>`. */
  const directUrl = isDirectMediaUrl(url) ? safeVideoUrl(url) : null;

  /* Anything else was an iframe already and starts as one. */
  const [useFrame, setUseFrame] = useState(!directUrl);
  const [ready, setReady] = useState(false);
  /* Width over height, once something has said what it is. Published as
     `--vp-ratio` below; which viewport actually spends it is the stylesheet's
     decision — see the note above the style. */
  const [aspect, setAspect] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /* The still is measured rather than merely displayed, because it is the only
     thing that knows the shape of a Drive video before Drive's viewer has
     started — the thumbnail comes back at the clip's own dimensions. These are
     filmed on a phone and are overwhelmingly portrait, so a 16/9 frame spent
     most of itself on bars beside the exercise.

     Loaded through its own Image rather than off the <img> below: that element
     lives inside the loading overlay and is gone the moment the player is
     ready, which on a cached frame can be before its load event is handled.
     Both ask for the same address, so this costs no second request. */
  useEffect(() => {
    if (!poster) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = poster;
    return () => {
      live = false;
    };
  }, [poster]);

  /* A stalled request is the case an `error` event does not cover: no bytes,
     no failure, no end to the waiting. Eight seconds with `readyState` still
     at 0 means not one byte of metadata arrived, which does not improve by
     being waited on — hand it to the viewer instead. Anything past 0 is
     loading normally and is left alone however slow the rest of it is. */
  useEffect(() => {
    if (useFrame) return;
    const timer = setTimeout(() => {
      if (videoRef.current?.readyState === 0) {
        setReady(false);
        setUseFrame(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [useFrame]);

  /* The caller decides what to say about a link that may not be framed; this
     renders nothing rather than an empty stage. */
  if (!embedUrl) return null;

  /* Two numbers are handed to the stylesheet; neither one picks the frame.
   *
   * 16/9 for every clip, whatever shape it was filmed in, is still the default
   * and still the deliberate trade: the library is filmed on a phone and is
   * portrait — six clips sampled from `exercises.video_url` measured 640x1138
   * each — so a uniform frame letterboxes them, Drive's viewer doing it for a
   * Drive file and `object-fit: contain` for a media file. That buys one frame
   * size across the panel and the dashboard, and the alternative, filling the
   * width, is only reachable by cropping away two thirds of a portrait frame.
   *
   * What it does not buy is a phone. There the 16/9 box is the card's width by
   * about 150px tall, and a portrait clip inside it is a strip. So the ratio
   * `aspect` measured is published rather than spent, and a stylesheet rule
   * narrow enough to know which screen it is on may reach for it: the trainee's
   * workout list does, under `.wl-video` in workout-log.css. Nothing else does,
   * which is why the panel's previews are the size they were.
   *
   * These were inline `aspectRatio` and `maxWidth` — the same values the CSS
   * now computes from the pair — and inline is exactly what no media query can
   * override, which is why they are variables instead. */
  const ratio = aspect ?? 16 / 9;

  return (
    <div
      className="vp-stage"
      style={
        {
          "--vp-ratio": ratio.toFixed(4),
          "--vp-max-h": maxHeight,
        } as CSSProperties
      }
    >
      {useFrame ? (
        <iframe
          className="vp-media"
          src={embedUrl}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          /* Costs nothing where one of these is alone in a dialog, and saves a
             whole viewer application per off-screen exercise where a workout
             day renders one under every row. */
          loading="lazy"
          onLoad={() => setReady(true)}
        />
      ) : (
        <video
          ref={videoRef}
          className="vp-media"
          src={directUrl!}
          poster={poster ?? undefined}
          title={title}
          controls
          playsInline
          preload={preload}
          onLoadedMetadata={(e) => {
            /* A media file has no thumbnail to measure, so it says so itself. */
            const el = e.currentTarget;
            if (el.videoWidth > 0 && el.videoHeight > 0) {
              setAspect(el.videoWidth / el.videoHeight);
            }
            setReady(true);
          }}
          onError={() => {
            setReady(false);
            setUseFrame(true);
          }}
        />
      )}

      {/* Sits over whichever of the two is loading, and leaves as soon as it
          has something to show. `pointer-events: none` keeps the player's own
          controls reachable underneath it. */}
      {!ready && (
        <div className="vp-loading">
          {poster && <img className="vp-poster" src={poster} alt="" aria-hidden="true" />}
          <span className="vp-spinner" role="status" aria-label="جاري تحميل الفيديو" />
        </div>
      )}
    </div>
  );
}
