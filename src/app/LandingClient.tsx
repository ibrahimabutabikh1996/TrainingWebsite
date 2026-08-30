"use client";
import type { JsonRecord, Testimonial } from "@/types";
import "./landing.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getLandingContent } from "./admin/cms/actions";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUsername, useCurrentUsername } from "@/lib/clientSession";
import { RICH_TEXT_KEYS, safeMediaUrl, setRichText, setText } from "@/lib/richText";
import { optimizedCssUrl, optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import { useParallax } from "@/hooks/useParallax";
import { normalizeLegacyName } from "@/lib/planNames";
import { PromotionalPopup } from "@/components/PromotionalPopup";
import { PreviewBar } from "@/components/ui/PreviewBar";
import { usePreviewGuard } from "@/hooks/usePreviewGuard";

/* Baseline copy. Anything the coach edits in the CMS overrides these at runtime
   through the [data-i18n] pass below. */
const defaultContent: JsonRecord = {
  site_title: "Ibrahim Abutabikh – تدرب بقوة، تدرب بذكاء",
  nav_logo_text: "Ibrahim Abutabikh",
  nav_home: "الرئيسية",
  nav_coach: "المدرب",
  nav_membership: "الاشتراكات",
  nav_testimonials: "النتائج",
  nav_offers: "العروض",
  nav_contact: "تواصل معنا",
  nav_cta: "تسجيل الدخول",
  skip_link: "تخطي إلى المحتوى",
  hero_eyebrow: "تدريب شخصي وتغذية",
  hero_title: "تدرب بقوة<br /><em>تدرب بذكاء</em>",
  hero_quote: "شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر",
  hero_sub: "برامج لياقة بدنية مصممة للملتزمين الجادين",
  hero_btn: "تسجيل الدخول",
  hero_btn2: "تصفح الاشتراكات",
  coach_eyebrow: "الملف الشخصي الكامل",
  coach_title: "تعرف على المدرب",
  coach_img_alt: "صورة المدرب",
  coach_badge: "معتمد من ISSA",
  coach_name: "إبراهيم أبو طبيخ",
  coach_cert: "مدرب شخصي وأخصائي تغذية معتمد لنخبة الرياضيين",
  coach_bio1:
    "مع أكثر من ١٠ سنوات من الخبرة في تحويل الأجسام، أتخصص في تصميم أنظمة غذائية وبرامج تدريبية مخصصة بدقة عالية. فلسفتي بسيطة: الانضباط، البرمجة الذكية، ولا أعذار.",
  coach_bio2:
    "لقد نجحت في تدريب مئات العملاء بدءاً من الرياضيين المحترفين إلى المدراء التنفيذيين المشغولين، مساعداً إياهم في الوصول إلى ذروة لياقتهم البدنية.",
  coach_stat1_num: "+١٠",
  coach_stat1_text: "سنوات خبرة",
  coach_stat2_num: "+٥٠٠",
  coach_stat2_text: "تحولات",
  coach_stat3_num: "ISSA",
  coach_stat3_text: "معتمد",
  mem_eyebrow: "اختر مسارك",
  mem_title: "الاشتراكات",
  card1_alt: "خطة ذاتية التوجيه",
  card1_badge: "خطة ذاتية التوجيه",
  card1_desc:
    "مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه الصحيح في التدريب والنظام الغذائي.",
  card1_p1_label: "عرض جدول تدريب + نظام غذائي",
  card1_p1_val: "٢٥,٠٠٠ د.ع",
  card1_p2_label: "جدول تدريب فقط",
  card1_p2_val: "١٥,٠٠٠ د.ع",
  card1_p3_label: "نظام غذائي فقط",
  card1_p3_val: "١٥,٠٠٠ د.ع",
  card1_f1: "جدول تدريب ممتاز",
  card1_f2: "نظام غذائي ممتاز",
  card1_f3: "اعتمد على نفسك",
  card_btn: "اختر الخطة",
  card2_alt: "خطة المتابعة الأسبوعية",
  card2_badge: "خطة المتابعة الأسبوعية",
  card2_desc:
    "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة وخطة المتابعة الأسبوعية للوصول إلى أهدافهم.",
  card2_p1_label: "الشهر الأول",
  card2_p1_val: "٥٠,٠٠٠ د.ع",
  card2_p2_label: "الشهر الثاني (تجديد)",
  card2_p2_val: "٣٠,٠٠٠ د.ع",
  card2_p3_label: "الشهر الثالث (يتضمن دليل ما بعد الدايت)",
  card2_p3_val: "٥٠,٠٠٠ د.ع",
  card2_f1: "قواعد غذائية خاصة",
  card2_f2: "خطة المتابعة الأسبوعية",
  card2_f3: "تنظيم أسلوب حياتك",
  card3_alt: "خطة المتابعة اليومية",
  card3_badge: "خطة المتابعة اليومية",
  card3_desc:
    "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام.",
  card3_p1_label: "خطة نظام غذائي كاملة لمدة ٣ أشهر",
  card3_p1_val: "٣٠٠,٠٠٠ د.ع",
  card3_p2_label: "دفع شهري (شهر واحد)",
  card3_p2_val: "١٢٠,٠٠٠ د.ع",
  card3_note:
    "إذا واصلت بالدفع الشهري، ستحصل على خصم ٦٠,٠٠٠ د.ع في الشهر الثالث.",
  card3_f1: "خطة المتابعة اليومية",
  card3_f2: "التزام مضمون",
  card3_f3: "أضمن طريق للوصول لهدفك",
  testi_eyebrow: "قصص نجاح حقيقية",
  testi_title: "نتائج المشتركين",
  off_eyebrow: "اكتشف العروض",
  off_title: "العروض الخاصة",
  off_card1_alt: "عرض خطة ذاتية التوجيه",
  off_card1_badge: "خطة ذاتية التوجيه",
  off_card1_desc:
    "برنامج تدريبي للمبتدئين يركز أساسيات بناء القوة وتوجيهك خطوة بخطوة في رحلتك الرياضية الأولى.",
  off_card1_p1_label: "نظام غذائي ورياضي + خطة المتابعة اليومية",
  off_card1_p1_val: "30,000 د.ع",
  off_card1_p2_label: "نظام غذائي فقط",
  off_card1_p2_val: "20,000 د.ع",
  off_card1_p3_label: "نظام رياضي فقط",
  off_card1_p3_val: "15,000 د.ع",
  off_card1_f1: "جدول تدريبي مخصص",
  off_card1_f2: "نظام غذائي متكامل",
  off_card1_f3: "متابعة على مدار اليوم",
  off_card_btn: "اشترك الآن",
  off_card2_alt: "عرض المتابعة الأسبوعية",
  off_card2_badge: "خطة المتابعة الأسبوعية",
  off_card2_desc:
    "برنامج تدريبي مكثف مصمم خصيصاً لمن يطمحون للوصول إلى أعلى مستويات اللياقة البدنية وبناء كتل عضلية.",
  off_card2_p1_label: "المبلغ كامل",
  off_card2_p1_val: "40,000 د.ع",
  off_card2_p2_label: "القسط الاول (مقدم)",
  off_card2_p2_val: "25,000 د.ع",
  off_card2_p3_label: "القسط الثاني (يدفع بعد ١٥ يوم من الاشتراك)",
  off_card2_p3_val: "15,000 د.ع",
  off_card2_f1: "تغذية ومكملات غذائية",
  off_card2_f2: "تمارين احترافية",
  off_card2_f3: "متابعة يومية دقيقة",
  off_card3_alt: "عرض المتابعة اليومية",
  off_card3_badge: "خطة المتابعة اليومية",
  off_card3_desc:
    "لمن هم مستعدون لصعود المسرح والمنافسة على الألقاب. تدريبات وبرامج تغذية مصممة خصيصاً للوصول لأفضل نتيجة في وقت قياسي والتفوق بالمرحلة.",
  off_card3_p1_label: "نظام غذائي وتدريب ومتابعة لمدة ٣ شهور",
  off_card3_p1_val: "150,000 د.ع",
  off_card3_p2_label: "نظام تجهيز (لمدة شهرين)",
  off_card3_p2_val: "120,000 د.ع",
  off_card3_note:
    "ملاحظة: السعر المذكور للتجهيز يشمل فقط المتابعة ولا يتضمن المستلزمات.",
  off_card3_f1: "تجهيز بطولات",
  off_card3_f2: "برمجة يومية",
  off_card3_f3: "أنظمة تجهيز لمراحل متقدمة",
  contact_eyebrow: "تواصل معنا",
  contact_title: "معلومات التواصل",
  contact_phone_label: "رقم الهاتف",
  contact_phone: "+964 787 751 1605",
  contact_email_label: "البريد الإلكتروني",
  contact_email: "ibrahim1996.im@gmail.com",
  contact_ig_label: "إنستغرام",
  contact_ig: "@ibrahim-abutabikh",
  contact_img_alt: "صورة المدرب",
  footer_tagline: "شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر",
  footer_brand_text: "Ibrahim Abutabikh",
  footer_links_title: "روابط سريعة",
  footer_copy: "© جميع الحقوق محفوظة 2026",
};

/**
 * Applies preview content to state, but only when it is genuinely different.
 *
 * The effect that reads the preview draft lists `cmsData` in its dependencies
 * and calls `setCmsData` from inside itself. The value it sets is a fresh object
 * every time — `JSON.parse`, then `normalizeContent`, which spreads into a new
 * record — so the reference always changed, the effect always re-ran, and it
 * parsed and set again: an unbounded render loop, thrown at
 * `setCmsData(payload)`.
 *
 * It only bit under `?preview=true` with a draft in storage, which is precisely
 * the content manager's preview window.
 *
 * Returning `prev` unchanged is what stops it: React compares with `Object.is`
 * and skips the re-render when the state is the same object, so the second pass
 * ends the cycle instead of starting another. Comparison is on the serialised
 * form because the two objects are never the same reference by construction.
 */
function sameContent(a: JsonRecord | null, b: JsonRecord): boolean {
  if (!a) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/* The media on a testimonial card, and what happens when it is not there.
 *
 * Two of the pictures the content manager points at are gone from storage — the
 * bucket answers "Object not found" — and a broken <img> still occupies its full
 * 16:9 box, so the card kept a grey hole exactly where a photograph should have
 * been. Nothing here can bring the file back. What it can do is stop the card
 * reserving room for something that is never going to arrive, which is the
 * difference between a card that looks short and a card that looks broken. */
function TestimonialMedia({
  type,
  url,
  alt,
}: {
  type: string;
  url: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className="testimonial-media">
      {type === "image" && (
        /* Uploaded from a phone at full camera resolution and shown in a card a
           third that wide — through the optimiser like every other photograph
           on this page. */
        <img
          className="testimonial-media-img"
          src={optimizedSrc(url, 828)}
          srcSet={optimizedSrcSet(url)}
          sizes="(max-width: 680px) 92vw, 400px"
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {type === "video" && (
        <video
          className="testimonial-video"
          src={url}
          controls
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
      {type === "audio" && (
        <audio
          className="testimonial-audio"
          src={url}
          controls
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function LandingClient({
  initialCmsData,
  /**
   * Rendered for the content manager's preview at `/cms-preview` rather than for
   * a visitor.
   *
   * It arrives as a prop from the server, not read from the address on the
   * client, and that is what makes the navigation below honest: the coach is
   * signed in, so without this the preview would show them the dashboard and
   * sign-out buttons — the one part of the page a visitor never sees. Deciding
   * it during rendering, on both sides, means there is no frame in which the
   * wrong nav is drawn.
   */
  isPreview = false,
}: {
  initialCmsData?: JsonRecord | null;
  isPreview?: boolean;
}) {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Read from the session hint cookie rather than copied into state inside an
     effect. The effect version rendered "sign in" for one frame to a visitor
     who was already signed in — and it read localStorage, which anybody can
     write, so the header was drawn from a value the visitor chose. */
  /* The hook is called unconditionally and the preview flag applied to its
     result — `!isPreview && useCurrentUsername()` would short-circuit the call
     itself, which is a conditional hook. */
  const currentUsername = useCurrentUsername();
  const isLoggedIn = !isPreview && currentUsername !== null;

  /* The coach's panel lives at /admin, the trainee's at /dashboard, and this
     link used to name the second one for everybody. A signed-in coach clicking
     it landed on the trainee dashboard — the proxy has no reason to turn them
     away from it, so the wrong screen simply opened. Which panel to draw is a
     drawing decision, which is exactly what the username hint is for; the
     server still decides what either screen may show. */
  const panelHref = isAdminUsername(currentUsername) ? "/admin" : "/dashboard";

  /* Nothing on a preview may be operated — see @/hooks/usePreviewGuard, which
     is where the effect that used to do this below now lives. The second
     argument keeps the legacy `?preview=true` path armed exactly as it was:
     this page still reads its draft on that flag, and the two have to agree. */
  usePreviewGuard(isPreview, true);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
  };

  // Lock the page behind the mobile drawer, and let Escape close it
  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    return () => document.body.classList.remove("nav-open");
  }, []);

  /* The arrow that travels with the reader.
   *
   * The hero's own cue scrolls away with the hero, and from there down the page
   * says nothing about how much of it is left or how to get back. This one is
   * fixed to the viewport: it takes over once the hero is behind you, points
   * down while there is more to read, and turns around at the end to offer the
   * way back to the top.
   *
   * Three states rather than a boolean, because "not shown" and "pointing up"
   * are different things and the markup needs to say which. */
  const [followerState, setFollowerState] = useState<"hidden" | "down" | "up">("hidden");
  const followerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const viewport = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      /* Nothing while the hero is still on screen — its own arrow is there, and
         two of them saying the same thing is one too many. */
      if (y < viewport * 0.6) {
        setFollowerState("hidden");
        return;
      }

      /* Within 80px of the end there is nothing further down to offer, so the
         arrow turns around. The margin covers the fractional viewport heights
         a phone reports as its address bar collapses. */
      setFollowerState(y + viewport >= documentHeight - 80 ? "up" : "down");
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleFollowerClick = () => {
    /* The ring is driven from here rather than from `:active`, which ends the
       moment the finger lifts and would cut the animation off halfway. Removing
       the class and reading a layout property forces the restart, so a second
       press plays it again instead of doing nothing. */
    const button = followerRef.current;
    if (button) {
      button.classList.remove("is-pressed");
      void button.offsetWidth;
      button.classList.add("is-pressed");
    }

    /* Someone who has asked for less movement is sent there directly rather
       than being taken on the ride. */
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

    if (followerState === "up") {
      window.scrollTo({ top: 0, behavior });
    } else {
      /* Just under a screenful, so the line being read at the fold stays in
         sight instead of being scrolled past. */
      window.scrollBy({ top: window.innerHeight * 0.9, behavior });
    }
  };

  useEffect(() => {
    // Nav scroll effect
    const navbar = document.getElementById("navbar");
    const handleScroll = () => {
      if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /* The hero's own parallax used to live here, writing `transform: scale()`
       straight onto the background element. Two problems: scaling a layer whose
       paint is a `background-size: cover` photograph re-rasterises it every
       frame rather than just recompositing it, and it owned the element's only
       `transform` slot so nothing else could move. It is now one layer among
       several in `useParallax`, which translates on the GPU and leaves the
       stylesheet in charge of composition.

       The `loaded` class that was set alongside it went with it — no rule in
       landing.css, or anywhere else, ever selected on it. */

    // Nav active links
    const sections = document.querySelectorAll<HTMLElement>("section[id]");
    const navLinks = document.querySelectorAll(".nav-links a");
    const scrollSpy = () => {
      let current = "";
      sections.forEach((s) => {
        /* A section switched off in the content manager is `display: none`, and
           `offsetTop` reports 0 for one of those — which reads as "you have
           scrolled past it" from the very top of the page. With a hidden
           section last in the markup, `current` ended up pinned to it and no
           navigation link was ever marked active. `offsetParent` is null for
           exactly the elements that have no box, and for nothing else. */
        if (s.offsetParent === null) return;
        if (window.scrollY >= s.offsetTop - 130) current = s.id;
      });
      navLinks.forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === `#${current}`);
      });
    };
    window.addEventListener("scroll", scrollSpy, { passive: true });

    // Scroll reveal
    const reveals = document.querySelectorAll(".reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("visible"), i * 100);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    reveals.forEach((r) => obs.observe(r));

    // Smooth scroll — delegated so it survives re-renders and CMS DOM swaps
    const handleAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.(
        'a[href^="#"]',
      );
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      // A bare "#" is not a valid selector — treat it as "back to top"
      if (!href || href === "#") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        return;
      }
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    };
    document.addEventListener("click", handleAnchorClick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", scrollSpy);
      document.removeEventListener("click", handleAnchorClick);
      obs.disconnect();
    };
  }, []);

  /* The rules themselves moved to @/lib/planNames. They were written out here
     when this page was the only thing reading those fields; the form, the
     WhatsApp message, the subscriber list and the PDF export read them too now,
     and a second copy of the table is how one of them starts showing a name the
     others stopped using. */
  const normalizeContent = (data: JsonRecord): JsonRecord => {
    const updated = { ...data };
    for (const key in updated) {
      const value = updated[key];
      if (typeof value === "string") updated[key] = normalizeLegacyName(value);
    }
    return updated;
  };

  const [cmsData, setCmsData] = useState<JsonRecord | null>(initialCmsData || null);
  const activeData = { ...defaultContent, ...(cmsData || initialCmsData || {}) };

  /* Written by the content manager's testimonials tab. Narrowed here rather than
     trusted: the column is free-form JSON, so a hand-edited or older row can
     hold anything, and the section below maps over this directly. */
  const testimonials: Testimonial[] = Array.isArray(activeData.testimonials)
    ? (activeData.testimonials as Testimonial[]).filter(
        (t): t is Testimonial => Boolean(t) && typeof t === "object"
      )
    : [];

  /* Every `[data-parallax]` layer in the markup below, driven from one scroll
     pass. Keyed on `cmsData` rather than left to run once: the testimonials
     section only exists once a testimonial has been written, so the set of
     layers on the page changes with the content. */
  useParallax(cmsData);

  useEffect(() => {
    /* Saved content, unless an unsaved draft is being previewed.
     *
     * The effect below reads `cms_preview_data` and applies it, synchronously,
     * on mount. This fetch resolves a moment later and used to overwrite it with
     * whatever is in the database — so the preview window opened by the content
     * manager showed the *saved* page, which is the one thing it is not for. The
     * coach's unsaved edits appeared for an instant and were replaced.
     *
     * The draft the manager writes is the whole document, not a patch, so
     * standing aside here leaves nothing missing. */
    const previewingDraft =
      typeof window !== "undefined" &&
      (isPreview || window.location.search.includes("preview=true")) &&
      !!localStorage.getItem("cms_preview_data");

    if (!previewingDraft) {
      getLandingContent().then((res) => {
        /* The column holds free-form JSON; only an object is usable as content. */
        const asRecord = (v: unknown): JsonRecord =>
          v && typeof v === "object" && !Array.isArray(v)
            ? (v as JsonRecord)
            : {};
        if (res) {
          setCmsData(normalizeContent(asRecord(res.content_ar)));
        }
      });
    }

    /* The blocking that used to sit here moved to `usePreviewGuard`, called at
       the top of this component, so the sign-in preview runs the same code
       rather than a second copy of it. Semantics are unchanged. */
  }, [isPreview]);

  useEffect(() => {
    const content: JsonRecord = { ...defaultContent, ...(cmsData || {}) };

    const applyDOMUpdates = (activeData: JsonRecord) => {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n") as string;
        // Use activeData if available, otherwise fall back to the baseline copy
        const val = activeData[key] || content[key];
        if (val) {
          /* Text as text. These strings come out of a database column, and a
             column is not a trust boundary — `el.innerHTML = val` made every one
             of these forty-odd fields a fragment of the document. `hero_title` is
             the single field written with markup (`<br />` and an `<em>`), so it
             goes through the sanitiser; the rest are sentences and go in as
             text. See @/lib/richText. */
          if (RICH_TEXT_KEYS.has(key)) setRichText(el, String(val));
          else setText(el, String(val));
        }
      });

      /* Fields the coach has switched off.
       *
       * One pass over the same `[data-i18n]` nodes the loop above just filled,
       * because every one of those attributes already names the element that
       * carries the field — `data-i18n="hero_btn"` is on the button itself, not
       * on a span inside it, so hiding the node hides the control rather than
       * leaving an empty one. That is what makes this general instead of
       * thirty-nine special cases.
       *
       * Written on every pass, both ways, never only when the flag is set: a
       * "hide it if false" loop cannot put anything back, so switching a field
       * on again would leave it hidden until a reload. The same reasoning as
       * the `_was` pass below.
       *
       * Absent means shown, so a field nobody has ever touched is untouched. */
      document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n") as string;
        const flag = activeData[`${key}_active`] ?? content[`${key}_active`];
        el.hidden = flag === "false";
      });

      /* The "before the discount" figures on the offers cards.
       *
       * Their own pass, because they are the only optional fields on the page:
       * every other `[data-i18n]` node always has something to show, so the loop
       * above can leave the markup alone when a value is missing. These start
       * `hidden` and must stay that way until the coach fills one in — and go
       * back to hidden when the field is cleared again, which a "set it if
       * truthy" loop cannot do: it would leave the last struck-through price on
       * screen after the discount ended. */
      document.querySelectorAll<HTMLElement>('[data-i18n$="_was"]').forEach((el) => {
        const key = el.getAttribute("data-i18n") as string;
        const raw = activeData[key] ?? content[key];
        const text = typeof raw === "string" ? raw.trim() : "";
        el.textContent = text;
        el.hidden = text === "";
      });

      document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
        const key = el.getAttribute("data-i18n-alt") as string;
        const val = activeData[key] || content[key];
        if (val) {
          el.setAttribute("alt", val);
        }
      });

      if (activeData) {
        /* A stored address interpolated into `url('...')` is a CSS injection:
           a quote and a closing paren end the declaration and everything after
           it is applied to the page as rules. `safeMediaUrl` returns null for
           anything carrying one, and null leaves the stylesheet's own value in
           place. It rejects `javascript:` for the image sources below too. */
        /* The hero fills the screen, so it is asked for at two widths and the
           stylesheet picks between them — a phone has no use for the 1920px
           re-encode and cannot afford it either. The scrim travels as its own
           property because it differs from the stylesheet's default one. */
        const heroBg = safeMediaUrl(activeData.hero_bg_url);
        const heroBgEl = document.getElementById("heroBg");
        if (heroBgEl && heroBg) {
          heroBgEl.style.setProperty("--hero-scrim", "linear-gradient(to bottom, rgba(0,0,0,0.5), var(--bg))");
          heroBgEl.style.setProperty("--hero-image", optimizedCssUrl(heroBg, 1920));
          heroBgEl.style.setProperty("--hero-image-sm", optimizedCssUrl(heroBg, 828));
        }

        /* Every picture here is a photograph the coach uploaded at whatever size
           their camera produced, painted into a box a few hundred pixels wide.
           `sizes` describes that box to the browser, `srcset` gives it the
           widths to choose from, and it downloads exactly one of them. */
        const setImageSrc = (id: string, value: unknown, sizes: string) => {
          const el = document.getElementById(id) as HTMLImageElement | null;
          const src = safeMediaUrl(value);
          if (!el || !src) return;
          /* The plain `src` is the fallback for anything that ignores srcset. */
          el.src = optimizedSrc(src, 828);
          el.srcset = optimizedSrcSet(src);
          el.sizes = sizes;
        };

        /* Three cards across on a desktop, one per row below 680px. */
        const CARD_SIZES = "(max-width: 680px) 92vw, 400px";
        /* A single portrait: beside the text on a desktop, above it on a phone. */
        const PORTRAIT_SIZES = "(max-width: 680px) 92vw, 520px";

        setImageSrc("coach-img-el", activeData.coach_img_url, PORTRAIT_SIZES);
        setImageSrc("card1-img-el", activeData.card1_img_url, CARD_SIZES);
        setImageSrc("card2-img-el", activeData.card2_img_url, CARD_SIZES);
        setImageSrc("card3-img-el", activeData.card3_img_url, CARD_SIZES);
        /* The offers cards' images. They were left pointing at the stock photos
           hard-coded in the markup — three requests to images.unsplash.com on
           every visit, for pictures the coach had no way to replace. */
        setImageSrc("off-card1-img-el", activeData.off_card1_img_url, CARD_SIZES);
        setImageSrc("off-card2-img-el", activeData.off_card2_img_url, CARD_SIZES);
        setImageSrc("off-card3-img-el", activeData.off_card3_img_url, CARD_SIZES);
        setImageSrc("contact-img-el", activeData.contact_img_url, PORTRAIT_SIZES);

        const phoneLink = document.getElementById(
          "contact-phone-link",
        ) as HTMLAnchorElement;
        if (phoneLink && activeData.contact_phone) {
          phoneLink.href = `tel:${activeData.contact_phone.replace(/\\s+/g, "")}`;
        }

        const emailLink = document.getElementById(
          "contact-email-link",
        ) as HTMLAnchorElement;
        if (emailLink && activeData.contact_email) {
          emailLink.href = `mailto:${activeData.contact_email}`;
        }

        const igLink = document.getElementById(
          "contact-ig-link",
        ) as HTMLAnchorElement;
        if (igLink && activeData.contact_ig) {
          igLink.href = `https://instagram.com/${activeData.contact_ig.replace("@", "")}`;
        }

        /* Handle card active/deactivated states.
         *
         * Addressed by `data-plan-card`, not by position.
         *
         * This used to take the nth match of `.membership-grid .membership-card`
         * across the whole document — and the page has two of those grids, the
         * subscriptions and the offers below them. It picked the right three
         * only because the subscriptions happen to come first in the markup. Move
         * the sections, or add a third grid with the same classes, and the
         * subscription switches would silently start deactivating offer cards
         * instead: the coach turns off "الخطة الأولى" and an offer disappears.
         *
         * An attribute the card carries itself cannot be thrown off by either. */
        const handleCardActivation = (
          attribute: string,
          cardIndex: number,
          isActive: boolean,
        ) => {
          const cardEl = document.querySelector(
            `[${attribute}="${cardIndex}"]`,
          ) as HTMLElement | null;
          if (!cardEl) return;

          // Remove existing overlay if any
          const existingOverlay = cardEl.querySelector(
            ".cms-unavailable-overlay",
          );
          if (existingOverlay) existingOverlay.remove();

          if (!isActive) {
            cardEl.classList.add("cms-card-deactivated");

            // Create unavailable overlay screen
            const overlay = document.createElement("div");
            overlay.className = "cms-unavailable-overlay";

            const titleEl = document.createElement("div");
            titleEl.className = "cms-unavailable-title";
            titleEl.innerHTML = `
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #dc3545;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              <span>غير متوفرة حالياً</span>
            `;

            const descEl = document.createElement("div");
            descEl.className = "cms-unavailable-desc";
            descEl.innerText =
              "هذه الباقة متوقفة في الوقت الحالي. يرجى مراجعة الباقات الأخرى أو التواصل مع المدرب لمزيد من التفاصيل.";

            overlay.appendChild(titleEl);
            overlay.appendChild(descEl);
            cardEl.appendChild(overlay);
          } else {
            cardEl.classList.remove("cms-card-deactivated");
          }
        };

        handleCardActivation("data-plan-card", 1, activeData.card1_active !== "false");
        handleCardActivation("data-plan-card", 2, activeData.card2_active !== "false");
        handleCardActivation("data-plan-card", 3, activeData.card3_active !== "false");

        /* The offers cards get the same "غير متوفرة حالياً" treatment as the
           plans, from their own switches in the content manager. */
        handleCardActivation("data-offer-card", 1, activeData.off_card1_active !== "false");
        handleCardActivation("data-offer-card", 2, activeData.off_card2_active !== "false");
        handleCardActivation("data-offer-card", 3, activeData.off_card3_active !== "false");

        // Toggle Sections Visibility
        const sectionToggles = [
          { id: "coach", flag: activeData.section_coach_active },
          { id: "membership", flag: activeData.section_membership_active },
          { id: "offers", flag: activeData.section_offers_active },
          { id: "contact", flag: activeData.section_contact_active },
        ];

        sectionToggles.forEach((s) => {
          const el = document.getElementById(s.id);
          if (el) {
            el.style.display = s.flag === "false" ? "none" : "";
          }
          const navLinks = document.querySelectorAll(`a[href="#${s.id}"]`);
          navLinks.forEach((link) => {
            if (link.parentElement && link.parentElement.tagName === "LI") {
              link.parentElement.style.display =
                s.flag === "false" ? "none" : "";
            } else {
              (link as HTMLElement).style.display =
                s.flag === "false" ? "none" : "";
            }
          });

          if (s.id === "offers") {
            if (s.flag !== "false") {
              document.body.classList.add("offers-active");
            } else {
              document.body.classList.remove("offers-active");
            }
          }
        });
      }
    };

    // Initial Apply
    applyDOMUpdates(content);

    const isPreviewMode =
      isPreview ||
      (typeof window !== "undefined" &&
        window.location.search.includes("preview=true"));

    if (isPreviewMode) {
      /* Draft in, page updated. Three ways in, one thing done with it. */
      const show = (payload: JsonRecord) => {
        applyDOMUpdates(payload);
        setCmsData((prev) => (sameContent(prev, payload) ? prev : payload));
      };

      // 1. Initial load from localStorage
      const savedData = localStorage.getItem("cms_preview_data");
      if (savedData) {
        try {
          const { payload } = JSON.parse(savedData);
          show(normalizeContent(payload));
        } catch {}
      }

      // 2. Listen to storage changes (across tabs)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === "cms_preview_data" && e.newValue) {
          try {
            const { payload } = JSON.parse(e.newValue);
            show(normalizeContent(payload));
          } catch {}
        }
      };

      /* 3. postMessage — how the open panel pushes each edit into this tab as it
         is typed. The origin is checked now: the panel already addresses this
         window by origin rather than "*", and this is the other half of that —
         without it, any page that got a handle on this tab could post a payload
         and have it rendered as the coach's own draft. */
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "CMS_PREVIEW") {
          show(normalizeContent(event.data.payload));
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("message", handleMessage);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [cmsData, isPreview]);

  return (
    <div className="landing-wrapper">
      <a href="#main" className="skip-link" data-i18n="skip_link">
        تخطي إلى المحتوى
      </a>

      {/* NAV */}
      <nav id="navbar">
        {/* One picture where there used to be two things: the mark and a
          wordmark typeset beside it. `hLogo` is the horizontal lockup — icon
          and name drawn together, already used by the intake form and the
          admin sidebar — so the brand name can no longer disagree with the
          image it sits next to.
          The mark is no longer aria-hidden: with the wordmark gone the alt
          text is the only accessible name this link has, and hidden it would
          announce as a link with nothing in it. */}
        <a href="#home" className="nav-logo">
          <span className="nav-logo-mark">
            {/* 5170px wide as a file, 288 on screen. */}
            <img
              src={optimizedSrc("/images/logo/hLogo.png", 384)}
              srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640, 828])}
              sizes="288px"
              alt="Ibrahim Abutabikh Logo"
            />
          </span>
        </a>
        <ul
          id="primaryNav"
          className={`nav-links${menuOpen ? " active" : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          <li>
            <a href="#home" className="active" data-i18n="nav_home">
              الرئيسية
            </a>
          </li>
          <li style={{ display: activeData.section_coach_active === "false" ? "none" : undefined }}>
            <a href="#coach" data-i18n="nav_coach">
              المدرب
            </a>
          </li>
          {/* Hidden with the section itself, and also when there is nothing to
              scroll to — a nav link to an anchor that does not exist goes
              nowhere. */}
          {testimonials.length > 0 && (
            <li style={{ display: activeData.section_testimonials_active === "false" ? "none" : undefined }}>
              <a href="#testimonials" data-i18n="nav_testimonials">
                {activeData.nav_testimonials}
              </a>
            </li>
          )}
          <li style={{ display: activeData.section_membership_active === "false" ? "none" : undefined }}>
            <a href="#membership" data-i18n="nav_membership">
              الاشتراكات
            </a>
          </li>
          <li style={{ display: activeData.section_offers_active === "false" ? "none" : undefined }}>
            <a
              href="#offers"
              className="nav-highlight-btn"
              data-i18n="nav_offers"
            >
              العروض
            </a>
          </li>
          <li style={{ display: activeData.section_contact_active === "false" ? "none" : undefined }}>
            <a href="#contact" data-i18n="nav_contact">
              تواصل معنا
            </a>
          </li>
          <li className="nav-drawer-cta">
            {isLoggedIn ? (
              <div
                style={{ display: "flex", gap: "8px", flexDirection: "column" }}
              >
                <Link
                  href={panelHref}
                  className="nav-cta"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text)",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  الانتقال الى لوحة التحكم
                </Link>
                <button onClick={handleLogout} className="nav-cta">
                  تسجيل الخروج
                </button>
              </div>
            ) : (
              <Link href="/login" className="nav-cta" data-i18n="nav_cta">
                تسجيل الدخول
              </Link>
            )}
          </li>
        </ul>
        <div className="nav-actions">
          {isLoggedIn ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Link
                href={panelHref}
                className="nav-cta"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-strong)",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                الانتقال الى لوحة التحكم
              </Link>
              <button onClick={handleLogout} className="nav-cta">
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <Link href="/login" className="nav-cta" data-i18n="nav_cta">
              تسجيل الدخول
            </Link>
          )}
          <button
            type="button"
            className={`burger-menu${menuOpen ? " active" : ""}`}
            id="burgerMenu"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            aria-controls="primaryNav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>
      <div
        className={`nav-overlay${menuOpen ? " active" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* HERO */}
      <main id="main">
        <section className="hero" id="home">
          {/* The deepest layer on the page. Anchored to the scroll position so
              it sits exactly where it was designed to on arrival, and held to a
              third of the reader's speed — slow enough to read as distance,
              never fast enough to expose the edge of its own box. */}
          <div
            className="hero-bg"
            id="heroBg"
            data-parallax="0.3"
            data-parallax-scroll
            data-parallax-max="400"
            style={safeMediaUrl(activeData.hero_bg_url) ? ({
              "--hero-scrim": "linear-gradient(to bottom, rgba(0,0,0,0.5), var(--bg))",
              "--hero-image": optimizedCssUrl(safeMediaUrl(activeData.hero_bg_url)!, 1920),
              "--hero-image-sm": optimizedCssUrl(safeMediaUrl(activeData.hero_bg_url)!, 828),
            } as React.CSSProperties) : undefined}
          ></div>
          <div className="hero-scrim"></div>
          <div className="hero-accent-line"></div>
          {/* The nearest layer, and the only one that fades. It leaves upward
              slightly faster than the page scrolls, which is what separates it
              from the photograph behind it. */}
          <div
            className="hero-content"
            data-parallax="-0.12"
            data-parallax-scroll
            data-parallax-max="140"
            data-parallax-fade
          >
            <div className="hero-eyebrow" data-i18n="hero_eyebrow">
              تدريب شخصي وتغذية
            </div>
            <h1 data-i18n="hero_title">
              تدرب بقوة
              <br />
              <em>تدرب بذكاء</em>
            </h1>
            <p className="hero-quote" data-i18n="hero_quote">
              شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر
            </p>
            <p className="hero-sub" data-i18n="hero_sub">
              برامج لياقة بدنية مصممة للملتزمين الجادين
            </p>
            <div className="hero-btns">
              {isLoggedIn ? (
                <>
                  <Link href={panelHref} className="btn-secondary">
                    الانتقال الى لوحة التحكم
                  </Link>
                  <button onClick={handleLogout} className="btn-primary">
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="btn-primary"
                  data-i18n="hero_btn"
                >
                  تسجيل الدخول
                </Link>
              )}
              <a
                href="#membership"
                className="btn-secondary"
                data-i18n="hero_btn2"
              >
                تصفح الاشتراكات
              </a>
            </div>
          </div>
          {/* The cue that says the page continues. It used to be the word
              "انزل" above a line, and it was hidden outright below 680px — so
              on the screen where a hero fills the whole viewport and nothing
              else is visible, nothing said there was anything under it.
              An arrow now, no wording: the label stays for screen readers,
              which is where the sentence belongs. */}
          <a href="#coach" className="hero-scroll-cue" aria-label="انزل للأسفل">
            <span className="cue-track" aria-hidden="true"></span>
            <svg
              className="cue-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </a>
        </section>

        {/* MEET THE COACH */}
        <section id="coach" style={{ display: activeData.section_coach_active === "false" ? "none" : undefined }}>
          {/* The soft texture behind the section, and the parallax layer
              furthest from the reader. It replaced an oversized English word —
              COACH here, PLANS, OFFERS and CONTACT in the sections below —
              which was legible enough to read as content on a page that is
              otherwise entirely Arabic. A pattern says the same thing about
              depth without saying a word.

              It carries no meaning at all now, so it stays out of the
              accessibility tree. Empty by design: everything it shows comes
              from `background-image` in landing.css. */}
          <div
            className="section-texture"
            data-parallax="0.07"
            data-parallax-max="70"
            aria-hidden="true"
          />
          <div className="coach-inner">
            <div className="coach-header reveal">
              <div className="section-eyebrow" data-i18n="coach_eyebrow">
                الملف الشخصي الكامل
              </div>
              <div className="section-title" data-parallax="0.05" data-parallax-max="28" data-i18n="coach_title">
                تعرف على المدرب
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="coach-layout reveal">
              <div className="coach-image-wrapper">
                <div className="coach-image-frame"></div>
                <img
                  id="coach-img-el"
                  src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80&fit=crop"
                  alt="صورة المدرب"
                  data-i18n-alt="coach_img_alt"
                  className="coach-img" data-parallax="0.05" data-parallax-max="18"
                />
                <div className="coach-badge" data-i18n="coach_badge">
                  معتمد من ISSA
                </div>
              </div>
              <div className="coach-info">
                <h3 data-i18n="coach_name">إبراهيم أبو طبيخ</h3>
                <p className="coach-cert" data-i18n="coach_cert">
                  مدرب شخصي وأخصائي تغذية معتمد لنخبة الرياضيين
                </p>
                <div className="coach-bio">
                  <p data-i18n="coach_bio1">
                    مع أكثر من ١٠ سنوات من الخبرة في تحويل الأجسام، أتخصص في
                    تصميم أنظمة غذائية وبرامج تدريبية مخصصة بدقة عالية. فلسفتي
                    بسيطة: الانضباط، البرمجة الذكية، ولا أعذار.
                  </p>
                  <p data-i18n="coach_bio2">
                    لقد نجحت في تدريب مئات العملاء بدءاً من الرياضيين المحترفين
                    إلى المدراء التنفيذيين المشغولين، مساعداً إياهم في الوصول
                    إلى ذروة لياقتهم البدنية.
                  </p>
                </div>
                <ul className="coach-stats">
                  <li>
                    <strong data-i18n="coach_stat1_num">+١٠</strong>
                    <span data-i18n="coach_stat1_text">سنوات خبرة</span>
                  </li>
                  <li>
                    <strong data-i18n="coach_stat2_num">+٥٠٠</strong>
                    <span data-i18n="coach_stat2_text">تحولات</span>
                  </li>
                  <li>
                    <strong data-i18n="coach_stat3_num">ISSA</strong>
                    <span data-i18n="coach_stat3_text">معتمد</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS
            The markup for this section was missing while landing.css carried a
            full stylesheet for it — #testimonials, .testimonials-grid,
            .testimonial-card, .testimonial-media and the rest. Rebuilt against
            those existing rules rather than styled afresh, so it matches what
            the section was designed to look like.

            Rendered only when the coach has actually written a testimonial: a
            heading over an empty rail is worse than no section at all. It
            appears on its own as soon as the first one is added in the content
            manager. */}
        {testimonials.length > 0 && (
          <section
            id="testimonials"
            style={{ display: activeData.section_testimonials_active === "false" ? "none" : undefined }}
          >
            <div className="testimonials-inner">
              <div className="testimonials-header reveal">
                <div className="section-eyebrow" data-i18n="testi_eyebrow">
                  {activeData.testi_eyebrow}
                </div>
                <div className="section-title" data-parallax="0.05" data-parallax-max="28" data-i18n="testi_title">
                  {activeData.testi_title}
                </div>
                <div className="primary-divider"></div>
              </div>

              <div className="testimonials-grid">
                {testimonials.map((t, i) => (
                  <article className="testimonial-card reveal" key={i}>
                    <div className="testimonial-content">
                      {t.type && t.type !== "text" && t.media_url && (
                        <TestimonialMedia
                          type={t.type}
                          url={t.media_url}
                          alt={t.author_name || "رأي مشترك"}
                        />
                      )}

                      {t.text && (
                        <>
                          <svg className="quote-icon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H5.17A2 2 0 0 1 7.17 9zm10 0A5.17 5.17 0 0 0 12 11.17V18h6.83v-6.83h-3.66a2 2 0 0 1 2-2.17z" />
                          </svg>
                          <p className="testimonial-text">{t.text}</p>
                        </>
                      )}
                    </div>

                    {(t.author_name || t.author_role) && (
                      <div className="testimonial-author">
                        <div className="author-avatar" aria-hidden="true">
                          {(t.author_name || "؟").trim().charAt(0)}
                        </div>
                        <div className="author-info">
                          <h4>{t.author_name || "مشترك"}</h4>
                          {t.author_role && <p>{t.author_role}</p>}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* MEMBERSHIP */}
        <section id="membership" style={{ display: activeData.section_membership_active === "false" ? "none" : undefined }}>
          <div
            className="section-texture"
            data-parallax="0.07"
            data-parallax-max="70"
            aria-hidden="true"
          />
          <div className="membership-inner">
            <div className="membership-header reveal">
              <div className="section-eyebrow" data-i18n="mem_eyebrow">
                اختر مسارك
              </div>
              <div className="section-title" data-parallax="0.05" data-parallax-max="28" data-i18n="mem_title">
                الاشتراكات
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="membership-grid">
              {/* Card 1 */}
              <div className="membership-card reveal" data-plan-card="1">
                <div className="membership-card-media">
                  <img
                    id="card1-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80&fit=crop"
                    alt="خطة ذاتية التوجيه"
                    data-i18n-alt="card1_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card1_badge">
                    خطة ذاتية التوجيه
                  </div>
                  <p className="membership-desc" data-i18n="card1_desc">
                    مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه
                    الصحيح في التدريب والنظام الغذائي.
                  </p>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card1_p1_label">
                      عرض جدول تدريب + نظام غذائي
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="card1_p1_val"
                    >
                      ٢٥,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card1_p2_label">
                      جدول تدريب فقط
                    </span>
                    <span className="price-amount" data-i18n="card1_p2_val">
                      ١٥,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card1_p3_label">
                      نظام غذائي فقط
                    </span>
                    <span className="price-amount" data-i18n="card1_p3_val">
                      ١٥,٠٠٠ د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="card1_f1">جدول تدريب ممتاز</li>
                    <li data-i18n="card1_f2">نظام غذائي ممتاز</li>
                    <li data-i18n="card1_f3">اعتمد على نفسك</li>
                  </ul>
                  <Link
                    href="/form?plan=plan1"
                    className="btn-card plan1-btn"
                    data-i18n="card_btn"
                  >
                    اختر الخطة
                  </Link>
                </div>
              </div>

              {/* Card 2 */}
              <div className="membership-card featured reveal" data-plan-card="2">
                <div className="membership-card-media">
                  <img
                    id="card2-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80&fit=crop"
                    alt="خطة المتابعة الأسبوعية"
                    data-i18n-alt="card2_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card2_badge">
                    خطة المتابعة الأسبوعية
                  </div>
                  <p className="membership-desc" data-i18n="card2_desc">
                    مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى
                    خطة منظمة وخطة المتابعة الأسبوعية للوصول إلى أهدافهم.
                  </p>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card2_p1_label">
                      الشهر الأول
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="card2_p1_val"
                    >
                      ٥٠,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card2_p2_label">
                      الشهر الثاني (تجديد)
                    </span>
                    <span className="price-amount" data-i18n="card2_p2_val">
                      ٣٠,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-row" style={{ marginBottom: 24 }}>
                    <span
                      className="price-label"
                      style={{ flex: 1, paddingInlineEnd: 12, lineHeight: 1.4 }}
                      data-i18n="card2_p3_label"
                    >
                      الشهر الثالث (يتضمن دليل ما بعد الدايت)
                    </span>
                    <span className="price-amount" data-i18n="card2_p3_val">
                      ٥٠,٠٠٠ د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="card2_f1">قواعد غذائية خاصة</li>
                    <li data-i18n="card2_f2">خطة المتابعة الأسبوعية</li>
                    <li data-i18n="card2_f3">تنظيم أسلوب حياتك</li>
                  </ul>
                  <Link
                    href="/form?plan=plan2"
                    className="btn-card plan2-btn"
                    data-i18n="card_btn"
                  >
                    اختر الخطة
                  </Link>
                </div>
              </div>

              {/* Card 3 */}
              <div className="membership-card reveal" data-plan-card="3">
                <div className="membership-card-media">
                  <img
                    id="card3-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80&fit=crop"
                    alt="خطة المتابعة اليومية"
                    data-i18n-alt="card3_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card3_badge">
                    خطة المتابعة اليومية
                  </div>
                  <p className="membership-desc" data-i18n="card3_desc">
                    هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة
                    اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل
                    شيء ولم يستطيعوا الالتزام.
                  </p>
                  <div className="price-row">
                    <span className="price-label" data-i18n="card3_p1_label">
                      خطة نظام غذائي كاملة لمدة ٣ أشهر
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="card3_p1_val"
                    >
                      ٣٠٠,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-row" style={{ marginBottom: 0 }}>
                    <span className="price-label" data-i18n="card3_p2_label">
                      دفع شهري (شهر واحد)
                    </span>
                    <span className="price-amount" data-i18n="card3_p2_val">
                      ١٢٠,٠٠٠ د.ع
                    </span>
                  </div>
                  <div className="price-note" data-i18n="card3_note">
                    إذا واصلت بالدفع الشهري، ستحصل على خصم ٦٠,٠٠٠ د.ع في الشهر
                    الثالث.
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="card3_f1">خطة المتابعة اليومية</li>
                    <li data-i18n="card3_f2">التزام مضمون</li>
                    <li data-i18n="card3_f3">أضمن طريق للوصول لهدفك</li>
                  </ul>
                  <Link
                    href="/form?plan=plan3"
                    className="btn-card plan3-btn"
                    data-i18n="card_btn"
                  >
                    اختر الخطة
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OFFERS */}
        <section id="offers" style={{ display: activeData.section_offers_active === "false" ? "none" : undefined }}>
          <div
            className="section-texture"
            data-parallax="0.07"
            data-parallax-max="70"
            aria-hidden="true"
          />
          <div className="membership-inner">
            <div className="membership-header reveal">
              <div className="section-eyebrow" data-i18n="off_eyebrow">
                اكتشف العروض
              </div>
              <div className="section-title" data-parallax="0.05" data-parallax-max="28" data-i18n="off_title">
                العروض الخاصة
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="membership-grid reveal">
              {/* Card 1 */}
              <div className="membership-card reveal" data-offer-card="1">
                <div className="membership-card-media">
                  <img
                    id="off-card1-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80&fit=crop"
                    alt="صمم مسيرتك الرياضية"
                    data-i18n-alt="off_card1_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card1_badge">
                    خطة ذاتية التوجيه
                  </div>
                  <p className="membership-desc" data-i18n="off_card1_desc">
                    برنامج تدريبي للمبتدئين يركز أساسيات بناء القوة وتوجيهك خطوة
                    بخطوة في رحلتك الرياضية الأولى.
                  </p>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card1_p1_label"
                    >
                      نظام غذائي ورياضي + خطة المتابعة اليومية
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card1_p1_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card1_p1_was}
                    >
                      {typeof activeData.off_card1_p1_was === "string" ? activeData.off_card1_p1_was : ""}
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="off_card1_p1_val"
                    >
                      30,000 د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card1_p2_label"
                    >
                      نظام غذائي فقط
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card1_p2_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card1_p2_was}
                    >
                      {typeof activeData.off_card1_p2_was === "string" ? activeData.off_card1_p2_was : ""}
                    </span>
                    <span className="price-amount" data-i18n="off_card1_p2_val">
                      20,000 د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card1_p3_label"
                    >
                      نظام رياضي فقط
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card1_p3_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card1_p3_was}
                    >
                      {typeof activeData.off_card1_p3_was === "string" ? activeData.off_card1_p3_was : ""}
                    </span>
                    <span className="price-amount" data-i18n="off_card1_p3_val">
                      15,000 د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="off_card1_f1">جدول تدريبي مخصص</li>
                    <li data-i18n="off_card1_f2">نظام غذائي متكامل</li>
                    <li data-i18n="off_card1_f3">متابعة على مدار اليوم</li>
                  </ul>
                  <Link
                    href="/form?plan=offer1"
                    className="btn-card plan1-btn"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </Link>
                </div>
              </div>
              {/* Card 2 */}
              <div className="membership-card featured reveal" data-offer-card="2">
                <div className="membership-card-media">
                  <img
                    id="off-card2-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&q=80&fit=crop"
                    alt="خطة المتابعة الأسبوعية"
                    data-i18n-alt="off_card2_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card2_badge">
                    خطة المتابعة الأسبوعية
                  </div>
                  <p className="membership-desc" data-i18n="off_card2_desc">
                    برنامج تدريبي مكثف مصمم خصيصاً لمن يطمحون للوصول إلى أعلى
                    مستويات اللياقة البدنية وبناء كتل عضلية.
                  </p>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card2_p1_label"
                    >
                      المبلغ كامل
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card2_p1_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card2_p1_was}
                    >
                      {typeof activeData.off_card2_p1_was === "string" ? activeData.off_card2_p1_was : ""}
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="off_card2_p1_val"
                    >
                      40,000 د.ع
                    </span>
                  </div>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card2_p2_label"
                    >
                      القسط الاول (مقدم)
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card2_p2_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card2_p2_was}
                    >
                      {typeof activeData.off_card2_p2_was === "string" ? activeData.off_card2_p2_was : ""}
                    </span>
                    <span className="price-amount" data-i18n="off_card2_p2_val">
                      25,000 د.ع
                    </span>
                  </div>
                  <div className="price-row" style={{ marginBottom: 24 }}>
                    <span
                      className="price-label"
                      style={{ flex: 1, paddingInlineEnd: 12, lineHeight: 1.4 }}
                      data-i18n="off_card2_p3_label"
                    >
                      القسط الثاني (يدفع بعد ١٥ يوم من الاشتراك)
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card2_p3_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card2_p3_was}
                    >
                      {typeof activeData.off_card2_p3_was === "string" ? activeData.off_card2_p3_was : ""}
                    </span>
                    <span className="price-amount" data-i18n="off_card2_p3_val">
                      15,000 د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="off_card2_f1">تغذية ومكملات غذائية</li>
                    <li data-i18n="off_card2_f2">تمارين احترافية</li>
                    <li data-i18n="off_card2_f3">متابعة يومية دقيقة</li>
                  </ul>
                  <Link
                    href="/form?plan=offer2"
                    className="btn-card plan2-btn"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </Link>
                </div>
              </div>
              {/* Card 3 */}
              <div className="membership-card reveal" data-offer-card="3">
                <div className="membership-card-media">
                  <img
                    id="off-card3-img-el"
                    className="membership-card-img" data-parallax="0.06" data-parallax-max="20"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=500&q=80&fit=crop"
                    alt="خطة المتابعة اليومية"
                    data-i18n-alt="off_card3_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card3_badge">
                    خطة المتابعة اليومية
                  </div>
                  <p className="membership-desc" data-i18n="off_card3_desc">
                    لمن هم مستعدون لصعود المسرح والمنافسة على الألقاب. تدريبات
                    وبرامج تغذية مصممة خصيصاً للوصول لأفضل نتيجة في وقت قياسي
                    والتفوق بالمرحلة.
                  </p>
                  <div className="price-row">
                    <span
                      className="price-label"
                      data-i18n="off_card3_p1_label"
                    >
                      نظام غذائي وتدريب ومتابعة لمدة ٣ شهور
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card3_p1_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card3_p1_was}
                    >
                      {typeof activeData.off_card3_p1_was === "string" ? activeData.off_card3_p1_was : ""}
                    </span>
                    <span
                      className="price-amount highlight"
                      data-i18n="off_card3_p1_val"
                    >
                      150,000 د.ع
                    </span>
                  </div>
                  <div className="price-row" style={{ marginBottom: 0 }}>
                    <span
                      className="price-label"
                      data-i18n="off_card3_p2_label"
                    >
                      نظام تجهيز (لمدة شهرين)
                    </span>
                    <span
                      className="price-was"
                      data-i18n="off_card3_p2_was"
                      aria-label="السعر قبل الخصم"
                      hidden={!activeData.off_card3_p2_was}
                    >
                      {typeof activeData.off_card3_p2_was === "string" ? activeData.off_card3_p2_was : ""}
                    </span>
                    <span className="price-amount" data-i18n="off_card3_p2_val">
                      120,000 د.ع
                    </span>
                  </div>
                  <div className="price-note" data-i18n="off_card3_note">
                    ملاحظة: السعر المذكور للتجهيز يشمل فقط المتابعة ولا يتضمن
                    المستلزمات.
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="off_card3_f1">تجهيز بطولات</li>
                    <li data-i18n="off_card3_f2">برمجة يومية</li>
                    <li data-i18n="off_card3_f3">أنظمة تجهيز لمراحل متقدمة</li>
                  </ul>
                  <Link
                    href="/form?plan=offer3"
                    className="btn-card plan3-btn"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" style={{ display: activeData.section_contact_active === "false" ? "none" : undefined }}>
          <div
            className="section-texture"
            data-parallax="0.07"
            data-parallax-max="70"
            aria-hidden="true"
          />
          <div className="contact-inner">
            <div className="contact-header reveal">
              <div className="section-eyebrow" data-i18n="contact_eyebrow">
                تواصل معنا
              </div>
              <div className="section-title" data-parallax="0.05" data-parallax-max="28" data-i18n="contact_title">
                معلومات التواصل
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="contact-layout reveal">
              <div className="contact-info">
                <a
                  id="contact-phone-link"
                  className="contact-item"
                  href="tel:+9647877511605"
                >
                  <div className="contact-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <h4 data-i18n="contact_phone_label">رقم الهاتف</h4>
                    <p dir="ltr" data-i18n="contact_phone">
                      07877511605
                    </p>
                  </div>
                </a>
                <a
                  id="contact-email-link"
                  className="contact-item"
                  href="mailto:ibrahim1996.im@gmail.com"
                >
                  <div className="contact-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <h4 data-i18n="contact_email_label">البريد الإلكتروني</h4>
                    <p dir="ltr" data-i18n="contact_email">
                      ibrahim1996.im@gmail.com
                    </p>
                  </div>
                </a>
                <a
                  id="contact-ig-link"
                  className="contact-item"
                  href="https://instagram.com/ibrahim-abutabikh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="contact-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </div>
                  <div>
                    <h4 data-i18n="contact_ig_label">إنستغرام</h4>
                    <p dir="ltr" data-i18n="contact_ig">
                      @ibrahim-abutabikh
                    </p>
                  </div>
                </a>
              </div>
              <div className="contact-image-wrapper">
                <img
                  id="contact-img-el"
                  src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80&fit=crop"
                  alt="صورة المدرب"
                  data-i18n-alt="contact_img_alt"
                  loading="lazy"
                  className="trainer-image" data-parallax="0.05" data-parallax-max="18"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top reveal">
            <div>
              {/* The same horizontal lockup the nav carries, for the same
                  reason — one drawing of the brand rather than a mark and a
                  wordmark that have to be kept in agreement. Not aria-hidden
                  now that the text beside it is gone. */}
              <div className="footer-brand">
                <span className="footer-brand-mark">
                  <img
                    src={optimizedSrc("/images/logo/hLogo.png", 384)}
                    srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640, 828])}
                    sizes="350px"
                    alt="Ibrahim Abutabikh Logo"
                  />
                </span>
              </div>
              <p className="footer-tagline" data-i18n="footer_tagline">
                شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر
              </p>
            </div>
            <div className="footer-grid">
              <div className="footer-col">
                <h4 data-i18n="footer_links_title">روابط سريعة</h4>
                <ul>
                  <li>
                    <a href="#home" data-i18n="nav_home">
                      الرئيسية
                    </a>
                  </li>
                  <li style={{ display: activeData.section_coach_active === "false" ? "none" : undefined }}>
                    <a href="#coach" data-i18n="nav_coach">
                      المدرب
                    </a>
                  </li>
                  <li style={{ display: activeData.section_membership_active === "false" ? "none" : undefined }}>
                    <a href="#membership" data-i18n="nav_membership">
                      الاشتراكات
                    </a>
                  </li>
                  <li style={{ display: activeData.section_offers_active === "false" ? "none" : undefined }}>
                    <a
                      href="#offers"
                      className="nav-highlight-btn"
                      data-i18n="nav_offers"
                    >
                      العروض
                    </a>
                  </li>
                  <li style={{ display: activeData.section_contact_active === "false" ? "none" : undefined }}>
                    <a href="#contact" data-i18n="nav_contact">
                      تواصل معنا
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p data-i18n="footer_copy">© جميع الحقوق محفوظة 2026</p>
            <div className="footer-socials">
              <a
                href="https://instagram.com/ibrahim-abutabikh"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="إنستغرام"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="tel:+9647877511605" aria-label="الهاتف">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
              <a
                href="mailto:ibrahim1996.im@gmail.com"
                aria-label="البريد الإلكتروني"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Two switches, not one. `section_offers_active` decides whether the
          offers exist on the page at all; `promo_popup_active` decides whether
          they announce themselves in a modal on arrival. The second is read
          under the first because this window's button points at #offers — with
          the section hidden it would send the visitor nowhere.
          Both default to on when absent, so a row saved before the pop-up had
          its own switch keeps behaving as it did. */}
      {/* Kept out of the tab order and away from screen readers while hidden:
          a button nobody can see is not one anybody should land on. */}
      <button
        type="button"
        ref={followerRef}
        className="scroll-follower"
        data-state={followerState}
        onAnimationEnd={(e) => {
          if (e.animationName.startsWith("followerRipple")) {
            e.currentTarget.classList.remove("is-pressed");
          }
        }}
        aria-hidden={followerState === "hidden"}
        tabIndex={followerState === "hidden" ? -1 : 0}
        aria-label={followerState === "up" ? "العودة إلى أعلى الصفحة" : "متابعة النزول"}
        onClick={handleFollowerClick}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {cmsData &&
        cmsData.section_offers_active !== "false" &&
        cmsData.promo_popup_active !== "false" && (
        <PromotionalPopup
          title={cmsData.promo_title || "🔥 عروض حصرية لفترة محدودة!"}
          description={
            cmsData.promo_desc ||
            "لدينا عروض مميزة متاحة الآن لفترة محدودة، لا تفوت الفرصة واكتشف باقاتنا الجديدة بأسعار لا تقبل المنافسة."
          }
          imageUrl={
            cmsData.promo_img_url ||
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80&fit=crop"
          }
          ctaText={cmsData.promo_cta || "تصفح العروض الآن"}
          ctaLink="#offers"
        />
      )}

      {/* Shared with the sign-in preview — see @/components/ui/PreviewBar. */}
      {isPreview && <PreviewBar />}
    </div>
  );
}
