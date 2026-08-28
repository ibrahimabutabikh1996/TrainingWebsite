"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import "./PromotionalPopup.css";

interface PromotionalPopupProps {
  title: string;
  description: string;
  discount?: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  endDate?: string;
}

export const PromotionalPopup: React.FC<PromotionalPopupProps> = ({
  title,
  description,
  discount,
  imageUrl,
  ctaText,
  ctaLink,
  endDate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    /* Shown on every load of the page, with nothing remembered between them.
     *
     * Closing it used to write the time into `sessionStorage` and the window
     * stayed away for twenty-four hours after that. The offers it announces are
     * the point of turning the section on, so it is meant to be seen on each
     * visit; whether it appears at all is decided by the coach's switch in the
     * content manager, not by whether this browser has met it before.
     *
     * A short delay before it appears, so the first paint of the page lands
     * behind it rather than a modal being the first thing on screen. Long
     * enough for that, short enough that it does not read as a wait. */
    const timer = setTimeout(() => {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    }, 300);

    /* Scrolling is locked while this is open, so it has to be released if the
       window goes away without being closed — the coach turning the switch off
       in a live preview unmounts it exactly like that, and the page underneath
       would be left frozen. */
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!endDate) return;

    const calculateTimeLeft = () => {
      const difference = new Date(endDate).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setIsExpired(true);
        return null;
      }

      return {
        d: Math.floor(difference / (1000 * 60 * 60 * 24)),
        h: Math.floor((difference / (1000 * 60 * 60)) % 24),
        m: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      if (!remaining) {
        clearInterval(timer);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  const handleClose = () => {
    setIsVisible(false);
    document.body.style.overflow = "";
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleCTAClick = () => {
    handleClose(); // Close before navigating
  };

  if (!isVisible) return null;

  return (
    <div className="promo-popup-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="promo-popup-card">
        <button className="promo-popup-close" onClick={handleClose} aria-label="إغلاق النافذة">
          &times;
        </button>
        
        {imageUrl && (
          <div className="promo-popup-banner">
            {/* The window covers the screen on arrival, so its picture is on the
                critical path — it goes through the optimiser rather than
                arriving as whatever came off the camera. Not lazy for the same
                reason: it is the first thing on screen, not the last. */}
            <img
              src={optimizedSrc(imageUrl, 828)}
              srcSet={optimizedSrcSet(imageUrl, [384, 640, 828])}
              sizes="(max-width: 480px) 92vw, 420px"
              alt="عرض خاص"
            />
          </div>
        )}

        <div className="promo-popup-content">
          {discount && <div className="promo-popup-badge">{discount}</div>}
          
          <h3 id="promo-title" className="promo-popup-title">{title}</h3>
          
          <p className="promo-popup-desc">{description}</p>
          
          {endDate && (
            <div className="promo-popup-timer">
              {isExpired ? (
                <div style={{ color: "var(--error-text)", fontWeight: "bold" }}>انتهى العرض</div>
              ) : timeLeft ? (
                <>
                  <div className="promo-timer-box">
                    <span className="promo-timer-num">{timeLeft.d}</span>
                    <span className="promo-timer-label">يوم</span>
                  </div>
                  <div className="promo-timer-box">
                    <span className="promo-timer-num">{String(timeLeft.h).padStart(2, '0')}</span>
                    <span className="promo-timer-label">ساعة</span>
                  </div>
                  <div className="promo-timer-box">
                    <span className="promo-timer-num">{String(timeLeft.m).padStart(2, '0')}</span>
                    <span className="promo-timer-label">دقيقة</span>
                  </div>
                  <div className="promo-timer-box">
                    <span className="promo-timer-num">{String(timeLeft.s).padStart(2, '0')}</span>
                    <span className="promo-timer-label">ثانية</span>
                  </div>
                </>
              ) : null}
            </div>
          )}
          
          <Link href={ctaLink} className="promo-popup-cta" onClick={handleCTAClick}>
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
};
