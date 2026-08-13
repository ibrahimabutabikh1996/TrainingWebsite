"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import "./PromotionalPopup.css";

interface PromotionalPopupProps {
  title: string;
  description: string;
  discount?: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  endDate?: string;
  sessionKey?: string;
  durationHours?: number;
}

export const PromotionalPopup: React.FC<PromotionalPopupProps> = ({
  title,
  description,
  discount,
  imageUrl,
  ctaText,
  ctaLink,
  endDate,
  sessionKey = "promo_popup_closed",
  durationHours = 24,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Check if popup should be shown
    const closedTime = localStorage.getItem(sessionKey);
    if (closedTime) {
      const now = new Date().getTime();
      const hideDurationMs = durationHours * 60 * 60 * 1000;
      if (now - parseInt(closedTime, 10) < hideDurationMs) {
        return; // Still hiding
      }
    }
    
    // Add a slight delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    }, 1500);

    return () => clearTimeout(timer);
  }, [sessionKey, durationHours]);

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
    localStorage.setItem(sessionKey, new Date().getTime().toString());
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
            <img src={imageUrl} alt="عرض خاص" loading="lazy" />
          </div>
        )}

        <div className="promo-popup-content">
          {discount && <div className="promo-popup-badge">{discount}</div>}
          
          <h3 id="promo-title" className="promo-popup-title">{title}</h3>
          
          <p className="promo-popup-desc">{description}</p>
          
          {endDate && (
            <div className="promo-popup-timer">
              {isExpired ? (
                <div style={{ color: "var(--error)", fontWeight: "bold" }}>انتهى العرض</div>
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
