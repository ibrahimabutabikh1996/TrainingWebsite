"use client";

import { useEffect, useRef, useState } from "react";
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
  /** A ceiling on the player's height. It bound when the frame took the shape
   *  of a portrait clip; at the fixed 16/9 the frame has now it works out wider
   *  than any container here and so never binds. Kept because it costs nothing
   *  and is what a per-clip frame would need again. */
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
  /* Width over height, once something has said what it is.
     Measured but no longer read: the frame is a fixed 16/9 now — see `ratio`
     below for why, and for why this is kept rather than torn out. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  /* 16/9, for every clip, whatever shape it was filmed in — asked for so that
     the panel and the dashboard show one frame size rather than a different one
     under every exercise.
   *
   * This is a deliberate trade and it is worth naming, because the frame no
   * longer follows the clip. The library is filmed on a phone and is portrait:
   * six clips sampled from `exercises.video_url` measured 640x1138 each. A 9/16
   * clip in a 16/9 frame is letterboxed by whoever is drawing it — Drive's
   * viewer for a Drive file, `object-fit: contain` for a media file — so those
   * play as a strip down the middle with the rest of the width dark. That is
   * the cost of a uniform frame, and it is the choice being made here; the
   * alternative, filling the width, is only reachable by cropping away about
   * two thirds of a portrait frame.
   *
   * `aspect` is still measured and is deliberately not read. It costs nothing —
   * the still it measures is requested anyway for the loading overlay — and
   * leaving it in place keeps going back to a per-clip frame a one-line change
   * rather than a rebuild. `max-width` still caps the height at `maxHeight`,
   * which at this ratio is far wider than any container and so never binds. */
  const ratio = 16 / 9;

  return (
    <div
      className="vp-stage"
      style={{
        aspectRatio: String(ratio.toFixed(4)),
        maxWidth: `calc(${maxHeight} * ${ratio.toFixed(4)})`,
      }}
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
