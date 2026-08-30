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
  /** How tall the player may grow once it takes the shape of a portrait clip.
   *  A dialog opened to watch one video can afford most of the screen; a list
   *  with an exercise under every row cannot, or the day becomes unscrollable. */
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
  /* Width over height, once something has said what it is. */
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

  /* 16/9 until something says otherwise: a YouTube or Vimeo frame has no still
     to measure and is that shape anyway. `max-width` is what keeps a portrait
     clip inside `maxHeight` — capping the height directly would leave the box
     its full width and put the bars straight back. */
  const ratio = aspect ?? 16 / 9;

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
