"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface StepOneProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepOneBasicInfo({ formData, setFormData }: StepOneProps) {
  const { t } = useLanguage();

  return (
    <div className="form-step active" style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 className="form-step-title section-title">
        {t("step1_title")}
      </h2>
      
      <div className="form-grid-2">
        <div className="form-group">
          <label className="field-label"><span>{t("lbl_fullname")}</span></label>
          <div className="input-wrapper">
            <input 
              type="text" 
              className="form-input" 
              required 
              value={formData.fullname} 
              onChange={(e) => setFormData({...formData, fullname: e.target.value})} 
            />
          </div>
        </div>
        
        <div className="form-group">
          <label className="field-label"><span>{t("lbl_plan")}</span></label>
          <div className="input-wrapper">
            <select 
              className="form-input" 
              required 
              value={formData.plan} 
              onChange={(e) => setFormData({...formData, plan: e.target.value})}
            >
              <option value="">{t("opt_select")}</option>
              <option value="bronze">{t("opt_plan_bronze")}</option>
              <option value="silver">{t("opt_plan_silver")}</option>
              <option value="primary">{t("opt_plan_gold")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="field-label"><span>{t("lbl_gender")}</span></label>
          <div className="input-wrapper">
            <select 
              className="form-input" 
              required 
              value={formData.gender} 
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
            >
              <option value="male">{t("opt_gender_male")}</option>
              <option value="female">{t("opt_gender_female")}</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="field-label"><span>{t("lbl_age")}</span></label>
          <div className="input-wrapper">
            <input 
              type="number" 
              className="form-input" 
              required 
              value={formData.age} 
              onChange={(e) => setFormData({...formData, age: e.target.value})} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
