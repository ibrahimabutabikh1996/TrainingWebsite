"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon";
import "./CustomSelect.css";

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="custom-select-label" style={{ opacity: !selectedOption ? 0.6 : 1 }}>
          {selectedOption ? selectedOption.label : placeholder || "اختر..."}
        </span>
        <Icon name="expand_more" className="custom-select-icon" />
      </button>

      {isOpen && !disabled && (
        <div className="custom-select-dropdown">
          {options.length === 0 ? (
            <div style={{ padding: "10px", color: "var(--text-muted)", textAlign: "center", fontSize: "0.9rem" }}>
              لا توجد خيارات
            </div>
          ) : (
            options.map((opt) => (
              <button
                type="button"
                key={opt.value}
                disabled={opt.disabled}
                className={`custom-select-option ${opt.value === value ? "selected" : ""} ${opt.disabled ? "disabled" : ""}`}
                style={{ opacity: opt.disabled ? 0.5 : 1, cursor: opt.disabled ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
                  <span className="custom-select-dot">•</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
