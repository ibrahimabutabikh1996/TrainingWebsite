"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { formatTimestamp } from "@/lib/trainingDates";
import {
  buildChallengeMessage,
  makeChallengeReference,
  whatsAppLink,
  type TraineeChallenge,
  type TraineeChallengesResponse,
} from "@/lib/challenges";
import "./challenges.css";

/* The trainee's challenges tab.
 *
 * Each open challenge has one button. Pressing it opens WhatsApp to the coach
 * with a message carrying a fresh reference — inside the click, because a window
 * opened after an awaited request is one a browser may block — and records a
 * pending submission alongside it. The trainee attaches their video in WhatsApp;
 * the coach watches it there and approves in the panel, which is what adds the
 * points. While it waits, the card keeps a WhatsApp link with the same message,
 * in case the chat was closed before the video went.
 *
 * Reads its own endpoint, like the training calendar: `reloadKey` is bumped by
 * the dashboard's live poller, so an approval appears without a reload. */

type Notice = { tone: "ok" | "error"; text: string } | null;

export default function Challenges({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<TraineeChallengesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/challenges", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch resolves after the effect, as the calendar's does
    load();
  }, [load, reloadKey]);

  const messageFor = (c: TraineeChallenge, reference: string) =>
    buildChallengeMessage({ title: c.title, target: c.target, fullname: data?.fullname ?? "", reference });

  const complete = (c: TraineeChallenge) => {
    if (!data) return;
    const reference = makeChallengeReference();
    const url = whatsAppLink(data.whatsapp, messageFor(c, reference));

    window.open(url, "_blank", "noopener");
    setSending(c.id);
    setNotice(null);

    fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ challengeId: c.id, reference }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "تعذّر تسجيل الطلب، حاول مرة أخرى");
        setNotice({
          tone: "ok",
          text: "انفتح الواتساب — أرفق فيديو التحدي وأرسله للكابتن. راح تنضاف نقاطك بعد ما يراجعه.",
        });
        await load();
      })
      .catch((error: Error) => setNotice({ tone: "error", text: error.message }))
      .finally(() => setSending(null));
  };

  if (failed && !data) {
    return (
      <div className="chl-tr-empty home-stat-card home-stat-card--empty">
        <Icon name="error_outline" />
        <p>تعذّر تحميل التحديات.</p>
        <button type="button" className="dash-primary-btn" onClick={load}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="chl-tr-empty home-stat-card home-stat-card--empty">
        <p>جاري تحميل التحديات...</p>
      </div>
    );
  }

  const open = data.challenges.filter((c) => c.is_open && c.submission?.status !== "approved");
  const done = data.challenges.filter((c) => !open.includes(c));

  const card = (c: TraineeChallenge) => {
    const s = c.submission;
    const status = s?.status;
    return (
      <article key={c.id} className={`home-stat-card chl-tr-card${status ? ` is-${status}` : ""}`}>
        <div className="chl-tr-head">
          <span className="home-card-icon" aria-hidden="true">
            <Icon name="emoji_events" />
          </span>
          <div className="chl-tr-id">
            <h3 className="home-card-title">{c.title}</h3>
            {c.target && <span className="chl-tr-target">{c.target}</span>}
          </div>
          <span className="chl-tr-points">+{c.points}</span>
        </div>

        {c.description && <p className="chl-tr-desc">{c.description}</p>}

        <div className="chl-tr-meta">
          {c.video_url && (
            <a href={c.video_url} target="_blank" rel="noopener noreferrer" className="chl-tr-link">
              <Icon name="play_circle" />
              شاهد الشرح
            </a>
          )}
          {c.ends_at && (
            <span>
              <Icon name="schedule" />
              ينتهي {formatTimestamp(c.ends_at)}
            </span>
          )}
        </div>

        {status === "approved" && (
          <p className="chl-tr-state is-approved">
            <Icon name="check_circle" />
            تم — حصلت على {s!.points_awarded} نقطة
          </p>
        )}

        {status === "pending" && (
          <>
            <p className="chl-tr-state is-pending">
              <Icon name="hourglass" />
              بانتظار مراجعة الكابتن · <span dir="ltr">{s!.reference}</span>
            </p>
            <a
              className="chl-tr-resend"
              href={whatsAppLink(data.whatsapp, messageFor(c, s!.reference))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="chat" />
              ما وصل الفيديو؟ أرسله مرة ثانية على الواتساب
            </a>
          </>
        )}

        {status === "rejected" && (
          <p className="chl-tr-state is-rejected">
            <Icon name="close" />
            <span>
              ما انقبل التحدي{s!.reject_reason ? ` — ${s!.reject_reason}` : ""}. تقدر تعيد المحاولة.
            </span>
          </p>
        )}

        {c.is_open && status !== "approved" && status !== "pending" && (
          <button
            type="button"
            className="dash-primary-btn chl-tr-done"
            onClick={() => complete(c)}
            disabled={sending === c.id}
          >
            <Icon name="photo_camera" />
            {status === "rejected" ? "أعد المحاولة وأرسل الفيديو" : "أتممت التحدي — أرسل الفيديو"}
          </button>
        )}

        {!c.is_open && status !== "approved" && <p className="chl-tr-closed">انتهى وقت هذا التحدي.</p>}
      </article>
    );
  };

  return (
    <div className="chl-tr">
      <div className="chl-tr-top">
        <h2 className="dash-section-heading">التحديات</h2>
        <div className="chl-tr-total" aria-label={`نقاطي ${data.totalPoints}`}>
          <Icon name="military_tech" />
          <div>
            <strong>{data.totalPoints}</strong>
            <span>نقاطي</span>
          </div>
        </div>
      </div>

      <p className="chl-tr-how">
        صوّر نفسك وانت تسوي التحدي، اضغط «أتممت التحدي» حتى ينفتح الواتساب على رقم الكابتن إبراهيم، وأرفق
        الفيديو. من يراجعه الكابتن تنضاف النقاط لرصيدك.
      </p>

      {notice && (
        <p className={`chl-tr-notice is-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {data.unavailable || data.challenges.length === 0 ? (
        <div className="chl-tr-empty home-stat-card home-stat-card--empty">
          <Icon name="emoji_events" />
          <p>ماكو تحديات حالياً. ترقّب التحدي الجاي من الكابتن إبراهيم 💪</p>
        </div>
      ) : (
        <>
          {open.length > 0 && <div className="chl-tr-grid">{open.map(card)}</div>}
          {done.length > 0 && (
            <>
              <h3 className="chl-tr-sub">تحدياتي السابقة</h3>
              <div className="chl-tr-grid">{done.map(card)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
