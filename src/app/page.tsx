"use client";
import type { JsonRecord } from "@/types";
import "./landing.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLandingContent } from "./admin/cms/actions";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { PromotionalPopup } from "@/components/PromotionalPopup";

/* Baseline copy. Anything the coach edits in the CMS overrides these at runtime
   through the [data-i18n] pass below. */
const defaultContent: JsonRecord = {
  site_title: "Ibrahim Abutabikh – تدرب بقوة، تدرب بذكاء",
  nav_logo_text: "Ibrahim Abutabikh",
  nav_home: "الرئيسية",
  nav_coach: "المدرب",
  nav_membership: "الاشتراكات",
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
  hero_scroll: "انزل",
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
  card1_alt: "خطط التوجيه الذاتي",
  card1_badge: "خطط التوجيه الذاتي",
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
  card2_alt: "متابعة أسبوعية",
  card2_badge: "خطة شهرية (متابعة أسبوعية)",
  card2_desc:
    "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة ومتابعة أسبوعية للوصول إلى أهدافهم.",
  card2_p1_label: "الشهر الأول",
  card2_p1_val: "٥٠,٠٠٠ د.ع",
  card2_p2_label: "الشهر الثاني (تجديد)",
  card2_p2_val: "٣٠,٠٠٠ د.ع",
  card2_p3_label: "الشهر الثالث (يتضمن دليل ما بعد الدايت)",
  card2_p3_val: "٥٠,٠٠٠ د.ع",
  card2_f1: "قواعد غذائية خاصة",
  card2_f2: "متابعة أسبوعية",
  card2_f3: "تنظيم أسلوب حياتك",
  card3_alt: "متابعة يومية",
  card3_badge: "خطة شهرية (متابعة يومية)",
  card3_desc:
    "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام.",
  card3_p1_label: "خطة نظام غذائي كاملة لمدة ٣ أشهر",
  card3_p1_val: "٣٠٠,٠٠٠ د.ع",
  card3_p2_label: "دفع شهري (شهر واحد)",
  card3_p2_val: "١٢٠,٠٠٠ د.ع",
  card3_note:
    "إذا واصلت بالدفع الشهري، ستحصل على خصم ٦٠,٠٠٠ د.ع في الشهر الثالث.",
  card3_f1: "متابعة يومية",
  card3_f2: "التزام مضمون",
  card3_f3: "أضمن طريق للوصول لهدفك",
  off_eyebrow: "اكتشف العروض",
  off_title: "العروض الخاصة",
  off_card1_alt: "عرض التوجيه الذاتي",
  off_card1_badge: "عرض التوجيه الذاتي",
  off_card1_desc:
    "مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه الصحيح في التدريب والنظام الغذائي.",
  off_card1_p1_label: "عرض جدول تدريب + نظام غذائي",
  off_card1_p1_val: "٢٠,٠٠٠ د.ع",
  off_card1_p2_label: "جدول تدريب فقط",
  off_card1_p2_val: "١٠,٠٠٠ د.ع",
  off_card1_p3_label: "نظام غذائي فقط",
  off_card1_p3_val: "١٠,٠٠٠ د.ع",
  off_card1_f1: "جدول تدريب ممتاز",
  off_card1_f2: "نظام غذائي ممتاز",
  off_card1_f3: "اعتمد على نفسك",
  off_card_btn: "اختر العرض",
  off_card2_alt: "عرض المتابعة الأسبوعية",
  off_card2_badge: "عرض المتابعة الأسبوعية",
  off_card2_desc:
    "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة ومتابعة أسبوعية للوصول إلى أهدافهم.",
  off_card2_p1_label: "الشهر الأول",
  off_card2_p1_val: "٤٠,٠٠٠ د.ع",
  off_card2_p2_label: "الشهر الثاني (تجديد)",
  off_card2_p2_val: "٢٥,٠٠٠ د.ع",
  off_card2_p3_label: "الشهر الثالث (يتضمن دليل ما بعد الدايت)",
  off_card2_p3_val: "٤٠,٠٠٠ د.ع",
  off_card2_f1: "قواعد غذائية خاصة",
  off_card2_f2: "متابعة أسبوعية",
  off_card2_f3: "تنظيم أسلوب حياتك",
  off_card3_alt: "عرض المتابعة اليومية",
  off_card3_badge: "عرض المتابعة اليومية",
  off_card3_desc:
    "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام.",
  off_card3_p1_label: "خطة نظام غذائي كاملة لمدة ٣ أشهر",
  off_card3_p1_val: "٢٥٠,٠٠٠ د.ع",
  off_card3_p2_label: "دفع شهري (شهر واحد)",
  off_card3_p2_val: "١٠٠,٠٠٠ د.ع",
  off_card3_note:
    "إذا واصلت بالدفع الشهري، ستحصل على خصم إضافي في الشهر الثالث.",
  off_card3_f1: "متابعة يومية",
  off_card3_f2: "التزام مضمون",
  off_card3_f3: "أضمن طريق للوصول لهدفك",
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

export default function LandingPage() {
  const { toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("loggedInUsername"));
  }, []);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
    setIsLoggedIn(false);
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

  useEffect(() => {
    // Nav scroll effect
    const navbar = document.getElementById("navbar");
    const handleScroll = () => {
      if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Hero parallax & load
    const heroBg = document.getElementById("heroBg");
    let parallax: (() => void) | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (heroBg) {
      loadTimer = setTimeout(() => heroBg.classList.add("loaded"), 100);
      if (!reduceMotion) {
        let ticking = false;
        parallax = () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            heroBg.style.transform = `scale(${1.06 + window.scrollY * 0.0005})`;
            ticking = false;
          });
        };
        window.addEventListener("scroll", parallax, { passive: true });
      }
    }

    // Nav active links
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-links a");
    const scrollSpy = () => {
      let current = "";
      sections.forEach((s) => {
        if (window.scrollY >= (s as HTMLElement).offsetTop - 130)
          current = s.id;
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
      if (parallax) window.removeEventListener("scroll", parallax);
      if (loadTimer) clearTimeout(loadTimer);
      document.removeEventListener("click", handleAnchorClick);
      obs.disconnect();
    };
  }, []);

  const [cmsData, setCmsData] = useState<JsonRecord | null>(null);

  useEffect(() => {
    getLandingContent().then((res) => {
      /* The column holds free-form JSON; only an object is usable as content. */
      const asRecord = (v: unknown): JsonRecord =>
        v && typeof v === "object" && !Array.isArray(v)
          ? (v as JsonRecord)
          : {};
      if (res) {
        setCmsData(asRecord(res.content_ar));
      }
    });

    // Disable all clicks in preview mode
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("preview=true")
    ) {
      const blockClicks = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      // Capture phase to intercept before any other listener
      document.addEventListener("click", blockClicks, true);
      return () => document.removeEventListener("click", blockClicks, true);
    }
  }, []);

  useEffect(() => {
    const content: JsonRecord = { ...defaultContent, ...(cmsData || {}) };

    const applyDOMUpdates = (activeData: JsonRecord) => {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n") as string;
        // Use activeData if available, otherwise fall back to the baseline copy
        const val = activeData[key] || content[key];
        if (val) {
          el.innerHTML = val;
        }
      });

      document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
        const key = el.getAttribute("data-i18n-alt") as string;
        const val = activeData[key] || content[key];
        if (val) {
          el.setAttribute("alt", val);
        }
      });

      if (activeData) {
        const heroBgEl = document.getElementById("heroBg");
        if (heroBgEl && activeData.hero_bg_url) {
          heroBgEl.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.5), var(--bg)), url('${activeData.hero_bg_url}')`;
        }

        const coachImgEl = document.getElementById(
          "coach-img-el",
        ) as HTMLImageElement;
        if (coachImgEl && activeData.coach_img_url) {
          coachImgEl.src = activeData.coach_img_url;
        }

        const card1ImgEl = document.getElementById(
          "card1-img-el",
        ) as HTMLImageElement;
        if (card1ImgEl && activeData.card1_img_url) {
          card1ImgEl.src = activeData.card1_img_url;
        }

        const card2ImgEl = document.getElementById(
          "card2-img-el",
        ) as HTMLImageElement;
        if (card2ImgEl && activeData.card2_img_url) {
          card2ImgEl.src = activeData.card2_img_url;
        }

        const card3ImgEl = document.getElementById(
          "card3-img-el",
        ) as HTMLImageElement;
        if (card3ImgEl && activeData.card3_img_url) {
          card3ImgEl.src = activeData.card3_img_url;
        }

        const contactImgEl = document.getElementById(
          "contact-img-el",
        ) as HTMLImageElement;
        if (contactImgEl && activeData.contact_img_url) {
          contactImgEl.src = activeData.contact_img_url;
        }

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

        // Handle card active/deactivated states
        const handleCardActivation = (cardIndex: number, isActive: boolean) => {
          const cardEl = document.querySelectorAll(
            ".membership-grid .membership-card",
          )[cardIndex - 1] as HTMLElement;
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

        handleCardActivation(1, activeData.card1_active !== "false");
        handleCardActivation(2, activeData.card2_active !== "false");
        handleCardActivation(3, activeData.card3_active !== "false");
      }
    };

    // Initial Apply
    applyDOMUpdates(content);

    const isPreview =
      typeof window !== "undefined" &&
      window.location.search.includes("preview=true");

    if (isPreview) {
      // 1. Initial load from localStorage
      const savedData = localStorage.getItem("cms_preview_data");
      if (savedData) {
        try {
          const { payload } = JSON.parse(savedData);
          applyDOMUpdates(payload);
        } catch {}
      }

      // 2. Listen to storage changes (across tabs)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === "cms_preview_data" && e.newValue) {
          try {
            const { payload } = JSON.parse(e.newValue);
            applyDOMUpdates(payload);
          } catch {}
        }
      };

      // 3. Listen to postMessage (iframe preview fallback)
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "CMS_PREVIEW") {
          applyDOMUpdates(event.data.payload);
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [cmsData]);

  return (
    <div className="landing-wrapper">
      <a href="#main" className="skip-link" data-i18n="skip_link">
        تخطي إلى المحتوى
      </a>

      {/* NAV */}
      <nav id="navbar">
        {/* The mark is structure, not copy — only the wordmark is translatable.
          Feeding the whole logo through data-i18n let a malformed CMS string
          wipe out the icon and the brand name. */}
        <a href="#home" className="nav-logo">
          <span className="nav-logo-mark" aria-hidden="true">
            <img src="/images/logo/mainLogo.png" alt="Ibrahim Abutabikh Logo" />
          </span>
          <span className="nav-logo-text" data-i18n="nav_logo_text">
            Ibrahim Abutabikh
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
          <li>
            <a href="#coach" data-i18n="nav_coach">
              المدرب
            </a>
          </li>
          <li>
            <a href="#membership" data-i18n="nav_membership">
              الاشتراكات
            </a>
          </li>
          <li>
            <a
              href="#offers"
              className="nav-highlight-btn"
              data-i18n="nav_offers"
            >
              العروض
            </a>
          </li>
          <li>
            <a href="#contact" data-i18n="nav_contact">
              تواصل معنا
            </a>
          </li>
          <li className="nav-drawer-cta">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="nav-cta">
                تسجيل الخروج
              </button>
            ) : (
              <Link href="/login" className="nav-cta" data-i18n="nav_cta">
                تسجيل الدخول
              </Link>
            )}
          </li>
        </ul>
        <div className="nav-actions">
          <button
            className="theme-toggle"
            id="themeToggle"
            onClick={toggleTheme}
            aria-label="تبديل المظهر"
          >
            <svg
              className="sun-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg
              className="moon-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <div id="headerControlsContainer"></div>
          {isLoggedIn ? (
            <button onClick={handleLogout} className="nav-cta">
              تسجيل الخروج
            </button>
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
          <div className="hero-bg" id="heroBg"></div>
          <div className="hero-scrim"></div>
          <div className="hero-accent-line"></div>
          <div className="hero-content">
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
                <button onClick={handleLogout} className="btn-primary">
                  تسجيل الخروج
                </button>
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
          <a href="#coach" className="hero-scroll-cue" aria-label="انزل للأسفل">
            <span data-i18n="hero_scroll">انزل</span>
            <span className="cue-track" aria-hidden="true"></span>
          </a>
        </section>

        {/* MEET THE COACH */}
        <section id="coach">
          <div className="coach-inner">
            <div className="coach-header reveal">
              <div className="section-eyebrow" data-i18n="coach_eyebrow">
                الملف الشخصي الكامل
              </div>
              <div className="section-title" data-i18n="coach_title">
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
                  className="coach-img"
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

        {/* MEMBERSHIP */}
        <section id="membership">
          <div className="membership-inner">
            <div className="membership-header reveal">
              <div className="section-eyebrow" data-i18n="mem_eyebrow">
                اختر مسارك
              </div>
              <div className="section-title" data-i18n="mem_title">
                الاشتراكات
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="membership-grid">
              {/* Card 1 */}
              <div className="membership-card reveal">
                <div className="membership-card-media">
                  <img
                    id="card1-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80&fit=crop"
                    alt="خطط التوجيه الذاتي"
                    data-i18n-alt="card1_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card1_badge">
                    خطط التوجيه الذاتي
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
                    className="btn-card"
                    data-i18n="card_btn"
                  >
                    اختر الخطة
                  </Link>
                </div>
              </div>

              {/* Card 2 */}
              <div className="membership-card featured reveal">
                <div className="membership-card-media">
                  <img
                    id="card2-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80&fit=crop"
                    alt="متابعة أسبوعية"
                    data-i18n-alt="card2_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card2_badge">
                    خطة شهرية (متابعة أسبوعية)
                  </div>
                  <p className="membership-desc" data-i18n="card2_desc">
                    مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى
                    خطة منظمة ومتابعة أسبوعية للوصول إلى أهدافهم.
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
                    <li data-i18n="card2_f2">متابعة أسبوعية</li>
                    <li data-i18n="card2_f3">تنظيم أسلوب حياتك</li>
                  </ul>
                  <Link
                    href="/form?plan=plan2"
                    className="btn-card"
                    data-i18n="card_btn"
                  >
                    اختر الخطة
                  </Link>
                </div>
              </div>

              {/* Card 3 */}
              <div className="membership-card reveal">
                <div className="membership-card-media">
                  <img
                    id="card3-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80&fit=crop"
                    alt="متابعة يومية"
                    data-i18n-alt="card3_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="card3_badge">
                    خطة شهرية (متابعة يومية)
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
                    <li data-i18n="card3_f1">متابعة يومية</li>
                    <li data-i18n="card3_f2">التزام مضمون</li>
                    <li data-i18n="card3_f3">أضمن طريق للوصول لهدفك</li>
                  </ul>
                  <Link
                    href="/form?plan=plan3"
                    className="btn-card"
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
        <section id="offers">
          <div className="membership-inner">
            <div className="membership-header reveal">
              <div className="section-eyebrow" data-i18n="off_eyebrow">
                اكتشف العروض
              </div>
              <div className="section-title" data-i18n="off_title">
                العروض الخاصة
              </div>
              <div className="primary-divider"></div>
            </div>
            <div className="membership-grid reveal">
              {/* Card 1 */}
              <div className="membership-card reveal">
                <div className="membership-card-media">
                  <img
                    id="off-card1-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80&fit=crop"
                    alt="صمم مسيرتك الرياضية"
                    data-i18n-alt="off_card1_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card1_badge">
                    باقة الانطلاقة الذكية
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
                      نظام غذائي ورياضي + متابعة يومية
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
                    <span className="price-amount" data-i18n="off_card1_p3_val">
                      15,000 د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="off_card1_f1">جدول تدريبي مخصص</li>
                    <li data-i18n="off_card1_f2">نظام غذائي متكامل</li>
                    <li data-i18n="off_card1_f3">متابعة على مدار اليوم</li>
                  </ul>
                  <a
                    href="https://wa.me/9647877511605"
                    className="btn-card"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </a>
                </div>
              </div>
              {/* Card 2 */}
              <div className="membership-card featured reveal">
                <div className="membership-card-media">
                  <img
                    id="off-card2-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&q=80&fit=crop"
                    alt="باقة المحترفين المتكاملة"
                    data-i18n-alt="off_card2_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card2_badge">
                    باقة المحترفين المتكاملة
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
                    <span className="price-amount" data-i18n="off_card2_p3_val">
                      15,000 د.ع
                    </span>
                  </div>
                  <ul className="membership-features">
                    <li data-i18n="off_card2_f1">تغذية ومكملات غذائية</li>
                    <li data-i18n="off_card2_f2">تمارين احترافية</li>
                    <li data-i18n="off_card2_f3">متابعة يومية دقيقة</li>
                  </ul>
                  <a
                    href="https://wa.me/9647877511605"
                    className="btn-card"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </a>
                </div>
              </div>
              {/* Card 3 */}
              <div className="membership-card reveal">
                <div className="membership-card-media">
                  <img
                    id="off-card3-img-el"
                    className="membership-card-img"
                    loading="lazy"
                    src="https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=500&q=80&fit=crop"
                    alt="باقة التجهيز للبطولات"
                    data-i18n-alt="off_card3_alt"
                  />
                </div>
                <div className="membership-card-body">
                  <div className="membership-badge" data-i18n="off_card3_badge">
                    باقة التجهيز للبطولات
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
                  <a
                    href="https://wa.me/9647877511605"
                    className="btn-card"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-i18n="off_card_btn"
                  >
                    اشترك الآن
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact">
          <div className="contact-inner">
            <div className="contact-header reveal">
              <div className="section-eyebrow" data-i18n="contact_eyebrow">
                تواصل معنا
              </div>
              <div className="section-title" data-i18n="contact_title">
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
                  className="trainer-image"
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
              <div className="footer-brand">
                <span className="footer-brand-mark" aria-hidden="true">
                  <img
                    src="/images/logo/mainLogo.png"
                    alt="Ibrahim Abutabikh Logo"
                  />
                </span>
                <span data-i18n="footer_brand_text">Ibrahim Abutabikh</span>
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
                  <li>
                    <a href="#coach" data-i18n="nav_coach">
                      المدرب
                    </a>
                  </li>
                  <li>
                    <a href="#membership" data-i18n="nav_membership">
                      الاشتراكات
                    </a>
                  </li>
                  <li>
                    <a
                      href="#offers"
                      className="nav-highlight-btn"
                      data-i18n="nav_offers"
                    >
                      العروض
                    </a>
                  </li>
                  <li>
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

      {cmsData && cmsData.section_offers_active !== "false" && (
        <PromotionalPopup
          title="🔥 عروض حصرية لفترة محدودة!"
          description="لدينا عروض مميزة متاحة الآن لفترة محدودة، لا تفوت الفرصة واكتشف باقاتنا الجديدة بأسعار لا تقبل المنافسة."
          imageUrl="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80&fit=crop"
          ctaText="تصفح العروض الآن"
          ctaLink="#offers"
          durationHours={24}
        />
      )}
    </div>
  );
}
