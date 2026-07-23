"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HeaderControls } from "@/components/HeaderControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { StepOneBasicInfo } from "@/components/form/StepOneBasicInfo";

export default function FormPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [formData, setFormData] = useState({
    fullname: "",
    plan: "",
    age: "",
    weight: "",
    height: "",
    activity: "",
    gender: "male"
  });

  const nextStep = () => setCurrentStep((p) => Math.min(totalSteps, p + 1));
  const prevStep = () => setCurrentStep((p) => Math.max(1, p - 1));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < totalSteps) {
      nextStep();
    } else {
      alert(t("form_success_title"));
      router.push("/dashboard");
    }
  };

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <main className="login-container form-layout-main">
      <HeaderControls />
      
      <article className="login-card form-card">
        
        <header className="brand mb-24">
          <div className="brand-logo brand-logo-container mb-16" aria-hidden="true">
            <Image src="/logo.png" alt="Power Logo" className="brand-logo-img" width={60} height={60} />
          </div>
          <h1 className="mt-0" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("form_main_title")}</h1>
          <p style={{ fontSize: "0.85rem" }}>{t("form_main_subtitle")}</p>
        </header>

        <nav className="progress-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, position: "relative", maxWidth: "100%" }} aria-label="خطوات الاستمارة">
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: "var(--input-border)", zIndex: 0, transform: "translateY(-50%)" }}></div>
          <div style={{ position: "absolute", top: "50%", [lang === 'ar' ? 'right' : 'left']: 0, height: 3, background: "var(--primary)", zIndex: 0, transform: "translateY(-50%)", width: `${progressPercentage}%`, transition: "width 0.3s ease" }}></div>
          
          {[1, 2, 3, 4, 5].map((step) => (
            <div 
              key={step} 
              style={{
                width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 700, zIndex: 1, transition: "all 0.3s ease",
                background: currentStep >= step ? "var(--primary)" : "var(--input-bg)",
                borderColor: currentStep >= step ? "var(--primary)" : "var(--input-border)",
                borderWidth: 2, borderStyle: "solid",
                color: currentStep >= step ? "white" : "var(--text-muted)",
                boxShadow: currentStep === step ? "0 0 12px var(--primary-glow)" : "none"
              }}
            >
              {step}
            </div>
          ))}
        </nav>

        <form id="multi-step-form" onSubmit={handleSubmit}>
          
          {currentStep === 1 && (
            <StepOneBasicInfo formData={formData} setFormData={setFormData} />
          )}

          {currentStep > 1 && (
            <div className="form-step active" style={{ animation: "fadeIn 0.4s ease" }}>
              <h2 className="form-step-title section-title">
                {(t as any)(`step${currentStep}_title`) || `الخطوة ${currentStep}`}
              </h2>
              <p className="mb-24" style={{ color: "var(--text-muted)" }}>سيتم إضافة حقول هذه الخطوة لاحقاً...</p>
            </div>
          )}

          <div className="flex-btn-group">
            <button 
              type="button" 
              className="social-btn" 
              onClick={prevStep}
              style={{ display: currentStep === 1 ? "none" : "block", flex: 1 }}
            >
              {t("btn_prev")}
            </button>
            <button 
              type="submit" 
              className="submit-btn mt-0" 
              style={{ flex: 1 }}
            >
              {currentStep === totalSteps ? t("btn_submit") : t("btn_next")}
            </button>
          </div>
        </form>
      </article>
    </main>
  );
}
