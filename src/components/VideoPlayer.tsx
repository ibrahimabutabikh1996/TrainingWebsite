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
}: {
  url: string;
  title?: string;
  /** "auto" for a player the viewer opened on purpose and is about to watch;
   *  "metadata" for one of many sitting in a list, where fetching every video
   *  in full is the cost the list cannot afford. */
  preload?: "auto" | "metadata";
}) {
  const embedUrl = getEmbedUrl(url);
  const fileId = driveFileId(url);
  const poster = fileId ? drivePosterUrl(fileId) : null;

  /* A media file is the one thing that can go straight into a `<video>`. */
  const directUrl = isDirectMediaUrl(url) ? safeVideoUrl(url) : null;

  /* Anything else was an iframe already and starts as one. */
  const [useFrame, setUseFrame] = useState(!directUrl);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <div className="vp-stage">
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
          onLoadedMetadata={() => setReady(true)}
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
