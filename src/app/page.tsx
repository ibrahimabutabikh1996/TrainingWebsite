'use client';
import './landing.css';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { getLandingContent } from './admin/cms/actions';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';


const translations: any = {
        en: {
          site_title: "GYM – Train Hard. Train Smart.",
          nav_logo: `<div class="nav-logo-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        Training Tracking Website`,
          nav_home: "Home",
          nav_coach: "Meet the Coach",
          nav_membership: "Membership",
          nav_contact: "Contact",
          nav_cta: "Sign In",
          hero_title: "Train Hard<br /><em>Train Smart</em>",
          hero_quote: "My diet rule is to never let it last for more than 3 months",
          hero_sub: "Elite fitness programs built for serious achievers",
          hero_btn: "Sign In",
          coach_eyebrow: "Complete Profile",
          coach_title: "MEET THE COACH",
          coach_img_alt: "Coach Profile",
          coach_badge: "ISSA Certified",
          coach_name: "Ibrahim Abutabikh",
          coach_cert: "Certified Elite Personal Trainer & Nutritionist",
          coach_bio1: "With over 10 years of experience in transforming bodies and lives, I specialize in highly customized diet and workout regimes. My philosophy is simple: discipline, smart programming, and no excuses.",
          coach_bio2: "I have successfully coached hundreds of clients ranging from professional athletes to busy executives, helping them achieve peak physical condition.",
          coach_stat1_num: "10+",
          coach_stat1_text: "Years Experience",
          coach_stat2_num: "500+",
          coach_stat2_text: "Transformations",
          coach_stat3_num: "ISSA",
          coach_stat3_text: "Certified",
          mem_eyebrow: "Choose Your Path",
          mem_title: "MEMBERSHIP",
          card1_alt: "Self-Guided Plans",
          card1_badge: "Self-Guided Plans",
          card1_desc: "Good for people who are committed and just need the right workout and diet guide.",
          card1_p1_label: "Workout + Diet Plan Offer",
          card1_p1_val: "25,000 IQD",
          card1_p2_label: "Workout Plan Only",
          card1_p2_val: "15,000 IQD",
          card1_p3_label: "Diet Plan Only",
          card1_p3_val: "15,000 IQD",
          card1_f1: "Good workout guide",
          card1_f2: "Good diet guide",
          card1_f3: "Do it yourself",
          card_btn: "Choose Plan",
          card2_alt: "Weekly Check-ins",
          card2_badge: "Monthly Plan (Weekly Check-ins)",
          card2_desc: "Good for people who struggle to stay committed and need a structured plan, special rules, and weekly checks to reach their goals.",
          card2_p1_label: "First Month",
          card2_p1_val: "50,000 IQD",
          card2_p2_label: "Second Month (Renewal)",
          card2_p2_val: "30,000 IQD",
          card2_p3_label: "Third Month (Includes end-of-diet guide)",
          card2_p3_val: "50,000 IQD",
          card2_f1: "Special diet rules",
          card2_f2: "Weekly check-ins",
          card2_f3: "Organize your lifestyle",
          card3_alt: "Daily Check-ins",
          card3_badge: "Monthly Plan (Daily Check-ins)",
          card3_desc: "This is the surest way to reach your goal. Daily check-ins will help you stick to the plan. Good for people who tried everything but couldn't stay committed.",
          card3_p1_label: "Full 3-Month Diet Plan",
          card3_p1_val: "300,000 IQD",
          card3_p2_label: "Monthly Payment (1 Month)",
          card3_p2_val: "120,000 IQD",
          card3_note: "If you continue with the monthly payment, you get a 60,000 IQD discount on the third month.",
          card3_f1: "Daily check-ins",
          card3_f2: "Guaranteed commitment",
          card3_f3: "Sure way to reach your goal",
          contact_eyebrow: "Get In Touch",
          contact_title: "CONTACT INFO",
          contact_phone: "Phone Number",
          contact_email: "Email",
          contact_ig: "Instagram",
          contact_img_alt: "Male Trainer Image",
          footer_tagline: "My diet rule is to never let it last for more than 3 months",
          footer_brand: `<div class="footer-brand-mark">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              Training Tracking Website`,
          footer_copy: "© 2026 All rights reserved"
        },
        ar: {
          site_title: "موقع تتبع التدريب – تدرب بقوة، تدرب بذكاء",
          nav_logo: `<div class="nav-logo-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        موقع تتبع التدريب`,
          nav_home: "الرئيسية",
          nav_coach: "المدرب",
          nav_membership: "الاشتراكات",
          nav_contact: "تواصل معنا",
          nav_cta: "تسجيل الدخول",
          hero_title: "تدرب بقوة<br /><em>تدرب بذكاء</em>",
          hero_quote: "شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر",
          hero_sub: "برامج لياقة بدنية مصممة للملتزمين الجادين",
          hero_btn: "تسجيل الدخول",
          coach_eyebrow: "الملف الشخصي الكامل",
          coach_title: "تعرف على المدرب",
          coach_img_alt: "صورة المدرب",
          coach_badge: "معتمد من ISSA",
          coach_name: "إبراهيم أبو طبيخ",
          coach_cert: "مدرب شخصي وأخصائي تغذية معتمد لنخبة الرياضيين",
          coach_bio1: "مع أكثر من ١٠ سنوات من الخبرة في تحويل الأجسام، أتخصص في تصميم أنظمة غذائية وبرامج تدريبية مخصصة بدقة عالية. فلسفتي بسيطة: الانضباط، البرمجة الذكية، ولا أعذار.",
          coach_bio2: "لقد نجحت في تدريب مئات العملاء بدءاً من الرياضيين المحترفين إلى المدراء التنفيذيين المشغولين، مساعداً إياهم في الوصول إلى ذروة لياقتهم البدنية.",
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
          card1_desc: "مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه الصحيح في التدريب والنظام الغذائي.",
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
          card2_desc: "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة ومتابعة أسبوعية للوصول إلى أهدافهم.",
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
          card3_desc: "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام.",
          card3_p1_label: "خطة نظام غذائي كاملة لمدة ٣ أشهر",
          card3_p1_val: "٣٠٠,٠٠٠ د.ع",
          card3_p2_label: "دفع شهري (شهر واحد)",
          card3_p2_val: "١٢٠,٠٠٠ د.ع",
          card3_note: "إذا واصلت بالدفع الشهري، ستحصل على خصم ٦٠,٠٠٠ د.ع في الشهر الثالث.",
          card3_f1: "متابعة يومية",
          card3_f2: "التزام مضمون",
          card3_f3: "أضمن طريق للوصول لهدفك",
          contact_eyebrow: "تواصل معنا",
          contact_title: "معلومات التواصل",
          contact_phone: "رقم الهاتف",
          contact_email: "البريد الإلكتروني",
          contact_ig: "إنستغرام",
          contact_img_alt: "صورة المدرب",
          footer_tagline: "شعاري بالدايت بأن ما اخلي يستمر لأكثر من 3 اشهر",
          footer_brand: `<div class="footer-brand-mark">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              موقع تتبع التدريب`,
          footer_copy: "© جميع الحقوق محفوظة 2026"
        }
      };

export default function LandingPage() {
  const { lang, toggleLang } = useLanguage();
  const { toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const burgerMenu = document.getElementById("burgerMenu");
    const navLinksContainer = document.querySelector(".nav-links");

    if (burgerMenu && navLinksContainer) {
      const newBurger = burgerMenu.cloneNode(true) as HTMLElement;
      if (burgerMenu.parentNode) burgerMenu.parentNode.replaceChild(newBurger, burgerMenu);
      
      newBurger.addEventListener("click", () => {
        newBurger.classList.toggle("active");
        navLinksContainer.classList.toggle("active");
      });

      document.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
          newBurger.classList.remove("active");
          navLinksContainer.classList.remove("active");
        });
      });
    }

    // Nav scroll effect
    const navbar = document.getElementById("navbar");
    const handleScroll = () => {
      if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Hero parallax & load
    const heroBg = document.getElementById("heroBg");
    if (heroBg) {
      setTimeout(() => heroBg.classList.add("loaded"), 100);
      const parallax = () => {
        heroBg.style.transform = `scale(${1.06 + window.scrollY * 0.0005})`;
      };
      window.addEventListener("scroll", parallax, { passive: true });
    }

    // Nav active links
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-links a");
    const scrollSpy = () => {
      let current = "";
      sections.forEach((s) => {
        if (window.scrollY >= (s as HTMLElement).offsetTop - 130) current = s.id;
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
      { threshold: 0.1 }
    );
    reveals.forEach((r) => obs.observe(r));
    
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const t = document.querySelector(a.getAttribute("href") || "");
        if (t) t.scrollIntoView({ behavior: "smooth" });
      });
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", scrollSpy);
    };
  }, []);

  const [cmsData, setCmsData] = useState<{en: any, ar: any} | null>(null);

  useEffect(() => {
    getLandingContent().then(res => {
      if (res) {
        setCmsData({ en: res.content_en, ar: res.content_ar });
      }
    });

    // Disable all clicks in preview mode
    if (typeof window !== "undefined" && window.location.search.includes("preview=true")) {
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
    const tr = {
      en: { ...translations.en, ...(cmsData?.en || {}) },
      ar: { ...translations.ar, ...(cmsData?.ar || {}) }
    } as any;
    
    const applyDOMUpdates = (activeData: any, currentLang: string, allTr: any) => {
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n") as string;
        // Use activeData if available, otherwise fallback to translations
        const val = activeData[key] || allTr[currentLang]?.[key];
        if (val) {
          el.innerHTML = val;
        }
      });

      document.querySelectorAll("[data-i18n-alt]").forEach(el => {
        const key = el.getAttribute("data-i18n-alt") as string;
        const val = activeData[key] || allTr[currentLang]?.[key];
        if (val) {
          el.setAttribute("alt", val);
        }
      });

      if (activeData) {
        const heroBgEl = document.getElementById("heroBg");
        if (heroBgEl && activeData.hero_bg_url) {
          heroBgEl.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.5), var(--bg)), url('${activeData.hero_bg_url}')`;
        }
        
        const coachImgEl = document.getElementById("coach-img-el") as HTMLImageElement;
        if (coachImgEl && activeData.coach_img_url) { coachImgEl.src = activeData.coach_img_url; }
        
        const card1ImgEl = document.getElementById("card1-img-el") as HTMLImageElement;
        if (card1ImgEl && activeData.card1_img_url) { card1ImgEl.src = activeData.card1_img_url; }

        const card2ImgEl = document.getElementById("card2-img-el") as HTMLImageElement;
        if (card2ImgEl && activeData.card2_img_url) { card2ImgEl.src = activeData.card2_img_url; }

        const card3ImgEl = document.getElementById("card3-img-el") as HTMLImageElement;
        if (card3ImgEl && activeData.card3_img_url) { card3ImgEl.src = activeData.card3_img_url; }

        // Handle card active/deactivated states
        const handleCardActivation = (cardIndex: number, isActive: boolean) => {
          const cardEl = document.querySelectorAll(".membership-grid .membership-card")[cardIndex - 1] as HTMLElement;
          if (!cardEl) return;
          
          // Remove existing overlay if any
          const existingOverlay = cardEl.querySelector(".cms-unavailable-overlay");
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
              <span>${currentLang === "ar" ? "غير متوفرة حالياً" : "Unavailable"}</span>
            `;
            
            const descEl = document.createElement("div");
            descEl.className = "cms-unavailable-desc";
            descEl.innerText = currentLang === "ar" 
              ? "هذه الباقة متوقفة في الوقت الحالي. يرجى مراجعة الباقات الأخرى أو التواصل مع المدرب لمزيد من التفاصيل." 
              : "This plan is currently not accepting new subscribers. Please check other plans or contact the coach.";
            
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
    applyDOMUpdates(tr[lang], lang, tr);

    const isPreview = typeof window !== "undefined" && window.location.search.includes("preview=true");

    if (isPreview) {
      // 1. Initial load from localStorage
      const savedData = localStorage.getItem("cms_preview_data");
      if (savedData) {
        try {
          const { lang: previewLang, payload } = JSON.parse(savedData);
          applyDOMUpdates(payload, previewLang, tr);
        } catch (e) {}
      }

      // 2. Listen to storage changes (across tabs)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === "cms_preview_data" && e.newValue) {
          try {
            const { lang: previewLang, payload } = JSON.parse(e.newValue);
            applyDOMUpdates(payload, previewLang, tr);
          } catch (err) {}
        }
      };

      // 3. Listen to postMessage (iframe preview fallback)
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "CMS_PREVIEW") {
          const previewLang = event.data.lang || lang;
          const previewData = event.data.payload;
          applyDOMUpdates(previewData, previewLang, tr);
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [lang, cmsData]);

  return (
    <div className="landing-wrapper">
      {/* NAV */}
    <nav id="navbar">
      <a href="#" className="nav-logo" data-i18n="nav_logo">
        <div className="nav-logo-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        Training Tracking Website
      </a>
      <ul className="nav-links">
        <li><a href="#home" className="active" data-i18n="nav_home">Home</a></li>
        <li><a href="#coach" data-i18n="nav_coach">Meet the Coach</a></li>
        <li><a href="#membership" data-i18n="nav_membership">Membership</a></li>
        <li><a href="#contact" data-i18n="nav_contact">Contact</a></li>
      </ul>
      <div className="nav-actions">
        <button className="theme-toggle" id="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">
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
        <button className="lang-toggle" id="langToggle" onClick={toggleLang} aria-label="Switch Language">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </button>
        <div id="headerControlsContainer"></div>
        <Link href="/login" className="nav-cta" dangerouslySetInnerHTML={{ __html: translations[lang]?.[ "nav_cta" ] || "" }}></Link>
        <div className="burger-menu" id="burgerMenu">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </nav>

    {/* HERO */}
    <section className="hero" id="home">
      <div className="hero-bg" id="heroBg"></div>
      <div className="hero-accent-line"></div>
      <div className="hero-content">
        <h1 data-i18n="hero_title">Train Hard<br /><em>Train Smart</em></h1>
        <p className="hero-quote" data-i18n="hero_quote">
          My diet rule is to never let it last for more than 3 months
        </p>
        <p className="hero-sub" data-i18n="hero_sub">
          Elite fitness programs built for serious achievers
        </p>
        <div className="hero-btns">
          <Link href="/login" className="btn-primary" data-i18n="hero_btn">Join Now</Link>
        </div>
      </div>
    </section>

    {/* MEET THE COACH */}
    <section id="coach">
      <div className="coach-inner">
        <div className="coach-header reveal">
          <div className="section-eyebrow" data-i18n="coach_eyebrow">Complete Profile</div>
          <div className="section-title" data-i18n="coach_title">MEET THE COACH</div>
          <div className="primary-divider"></div>
        </div>
        <div className="coach-layout reveal">
          <div className="coach-image-wrapper">
            <div className="coach-image-frame"></div>
            <img
              id="coach-img-el"
              src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80&fit=crop"
              alt="Coach Profile" data-i18n-alt="coach_img_alt"
              className="coach-img"
            />
            <div className="coach-badge" data-i18n="coach_badge">ISSA Certified</div>
          </div>
          <div className="coach-info">
            <h3 data-i18n="coach_name">Ibrahim Abutabikh</h3>
            <p className="coach-cert" data-i18n="coach_cert">
              Certified Elite Personal Trainer &amp; Nutritionist
            </p>
            <div className="coach-bio">
              <p data-i18n="coach_bio1">
                With over 10 years of experience in transforming bodies and
                lives, I specialize in highly customized diet and workout
                regimes. My philosophy is simple: discipline, smart programming,
                and no excuses.
              </p>
              <p data-i18n="coach_bio2">
                I have successfully coached hundreds of clients ranging from
                professional athletes to busy executives, helping them achieve
                peak physical condition.
              </p>
            </div>
            <ul className="coach-stats">
              <li><strong data-i18n="coach_stat1_num">10+</strong><span data-i18n="coach_stat1_text">Years Experience</span></li>
              <li><strong data-i18n="coach_stat2_num">500+</strong><span data-i18n="coach_stat2_text">Transformations</span></li>
              <li><strong data-i18n="coach_stat3_num">ISSA</strong><span data-i18n="coach_stat3_text">Certified</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    {/* MEMBERSHIP */}
    <section id="membership">
      <div className="membership-inner">
        <div className="membership-header reveal">
          <div className="section-eyebrow" data-i18n="mem_eyebrow">Choose Your Path</div>
          <div className="section-title" data-i18n="mem_title">MEMBERSHIP</div>
          <div className="primary-divider"></div>
        </div>
        <div className="membership-grid reveal">
          {/* Card 1 */}
          <div className="membership-card">
            <img
              id="card1-img-el"
              className="membership-card-img"
              src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80&fit=crop"
              alt="Self-Guided Plans" data-i18n-alt="card1_alt"
            />
            <div className="membership-card-body">
              <div className="membership-badge" data-i18n="card1_badge">Self-Guided Plans</div>
              <p className="membership-desc" data-i18n="card1_desc">
                Good for people who are committed and just need the right
                workout and diet guide.
              </p>
              <div className="price-row">
                <span className="price-label" data-i18n="card1_p1_label">Workout + Diet Plan Offer</span>
                <span className="price-amount highlight" data-i18n="card1_p1_val">25,000 IQD</span>
              </div>
              <div className="price-row">
                <span className="price-label" data-i18n="card1_p2_label">Workout Plan Only</span>
                <span className="price-amount" data-i18n="card1_p2_val">15,000 IQD</span>
              </div>
              <div className="price-row">
                <span className="price-label" data-i18n="card1_p3_label">Diet Plan Only</span>
                <span className="price-amount" data-i18n="card1_p3_val">15,000 IQD</span>
              </div>
              <ul className="membership-features">
                <li data-i18n="card1_f1">Good workout guide</li>
                <li data-i18n="card1_f2">Good diet guide</li>
                <li data-i18n="card1_f3">Do it yourself</li>
              </ul>
              <button className="btn-card" data-i18n="card_btn">Choose Plan</button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="membership-card">
            <img
              id="card2-img-el"
              className="membership-card-img"
              src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80&fit=crop"
              alt="Weekly Check-ins" data-i18n-alt="card2_alt"
            />
            <div className="membership-card-body">
              <div className="membership-badge" data-i18n="card2_badge">
                Monthly Plan (Weekly Check-ins)
              </div>
              <p className="membership-desc" data-i18n="card2_desc">
                Good for people who struggle to stay committed and need a
                structured plan, special rules, and weekly checks to reach their
                goals.
              </p>
              <div className="price-row">
                <span className="price-label" data-i18n="card2_p1_label">First Month</span>
                <span className="price-amount highlight" data-i18n="card2_p1_val">50,000 IQD</span>
              </div>
              <div className="price-row">
                <span className="price-label" data-i18n="card2_p2_label">Second Month (Renewal)</span>
                <span className="price-amount" data-i18n="card2_p2_val">30,000 IQD</span>
              </div>
              <div className="price-row" style={{marginBottom: 24}}>
                <span
                  className="price-label"
                  style={{flex: 1, paddingInlineEnd: 12, lineHeight: 1.4}}
                   data-i18n="card2_p3_label">Third Month (Includes end-of-diet guide)</span
                >
                <span className="price-amount" data-i18n="card2_p3_val">50,000 IQD</span>
              </div>
              <ul className="membership-features">
                <li data-i18n="card2_f1">Special diet rules</li>
                <li data-i18n="card2_f2">Weekly check-ins</li>
                <li data-i18n="card2_f3">Organize your lifestyle</li>
              </ul>
              <button className="btn-card" data-i18n="card_btn">Choose Plan</button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="membership-card">
            <img
              id="card3-img-el"
              className="membership-card-img"
              src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80&fit=crop"
              alt="Daily Check-ins" data-i18n-alt="card3_alt"
            />
            <div className="membership-card-body">
              <div className="membership-badge" data-i18n="card3_badge">Monthly Plan (Daily Check-ins)</div>
              <p className="membership-desc" data-i18n="card3_desc">
                This is the surest way to reach your goal. Daily check-ins will
                help you stick to the plan. Good for people who tried everything
                but couldn't stay committed.
              </p>
              <div className="price-row">
                <span className="price-label" data-i18n="card3_p1_label">Full 3-Month Diet Plan</span>
                <span className="price-amount highlight" data-i18n="card3_p1_val">300,000 IQD</span>
              </div>
              <div className="price-row" style={{marginBottom: 0}}>
                <span className="price-label" data-i18n="card3_p2_label">Monthly Payment (1 Month)</span>
                <span className="price-amount" data-i18n="card3_p2_val">120,000 IQD</span>
              </div>
              <div className="price-note" data-i18n="card3_note">
                If you continue with the monthly payment, you get a 60,000 IQD
                discount on the third month.
              </div>
              <ul className="membership-features">
                <li data-i18n="card3_f1">Daily check-ins</li>
                <li data-i18n="card3_f2">Guaranteed commitment</li>
                <li data-i18n="card3_f3">Sure way to reach your goal</li>
              </ul>
              <button className="btn-card" data-i18n="card_btn">Choose Plan</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* CONTACT */}
    <section id="contact">
      <div className="contact-inner">
        <div className="contact-header reveal">
          <div className="section-eyebrow" data-i18n="contact_eyebrow">Get In Touch</div>
          <div className="section-title" data-i18n="contact_title">CONTACT INFO</div>
          <div className="primary-divider"></div>
        </div>
        <div className="contact-layout reveal">
          <div className="contact-info">
            <div className="contact-item">
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
                  <path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                  />
                </svg>
              </div>
              <div>
                <h4 data-i18n="contact_phone">Phone Number</h4>
                <p>07877511605</p>
              </div>
            </div>
            <div className="contact-item">
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
                  <path
                    d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <h4 data-i18n="contact_email">Email</h4>
                <p>ibrahim1996.im@gmail.com</p>
              </div>
            </div>
            <div className="contact-item">
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
                <h4 data-i18n="contact_ig">Instagram</h4>
                <p>@ibrahim-abutabikh</p>
              </div>
            </div>
          </div>
          <div className="contact-image-wrapper">
            <img
              src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80&fit=crop"
              alt="Male Trainer Image" data-i18n-alt="contact_img_alt"
              className="trainer-image"
            />
          </div>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer>
      <div className="footer-inner">
        <div className="footer-top reveal">
          <div>
            <div className="footer-brand" data-i18n="footer_brand">
              <div className="footer-brand-mark">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              Training Tracking Website
            </div>
            <p className="footer-tagline" data-i18n="footer_tagline">
              My diet rule is to never let it last for more than 3 months
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p data-i18n="footer_copy">© 2026 All rights reserved</p>
        </div>
      </div>
    </footer>

    
    </div>
  );
}
