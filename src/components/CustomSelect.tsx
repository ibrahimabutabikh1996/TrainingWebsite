"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Icon } from "./Icon";
import { arabicIncludes, normalizeArabic } from "@/lib/arabicSearch";
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
  /* Goes on the trigger, so a `<label htmlFor>` still reaches the control after
     a native <select> is replaced by this. Without it the label points at an id
     that no longer exists, which is worse for a screen reader than no label. */
  id?: string;
  /**
   * Puts a filter box at the top of the open list.
   *
   * Off unless asked for, and that is the point: most of the sixteen selects in
   * this app offer two to six fixed choices — a search box over "ثانية /
   * دقيقة" is furniture, not help. It is worth having where the list is as long
   * as the subscriber roll, and those are named one by one.
   */
  searchable?: boolean;
  /** What the filter box says while empty. */
  searchPlaceholder?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
  id,
  searchable = false,
  searchPlaceholder = "ابحث...",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* A filter is a way of looking, not a setting — it should not still be there
     the next time the list is opened, showing three names out of forty with no
     sign of why. Every path that shuts the panel goes through here, so there is
     one place that decides it rather than an effect watching `isOpen` and
     setting state back at it. */
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [close]);

  /* The point of opening a searchable list is usually to type into it. Focus
     only — nothing here sets state.
   *
     And bring the list into view. This control is used inside dialogs whose
     body is the scroller, and a dropdown is absolutely positioned: it extends
     past the body's box and is clipped by it. Measured in the assign dialog at
     1280x900 — the panel is 240px tall and 99px of it was visible, which after
     the filter box leaves about a name and a half. Nothing was unreachable
     (the body scrolls exactly the 141px that were cut), but a search you have
     to scroll to read is a search that has not helped.

     `block: "nearest"` scrolls the least it can to fit, so a list already fully
     visible does not move at all — which is every other select in the app,
     since none of them ask for this. */
  useEffect(() => {
    if (!isOpen || !searchable) return;
    searchRef.current?.focus();
    dropdownRef.current?.scrollIntoView({ block: "nearest" });
  }, [isOpen, searchable]);

  const selectedOption = options.find((o) => o.value === value);

  /* `arabicIncludes` rather than `toLowerCase().includes()`: one Arabic word has
     several correct spellings and nobody types the harakat. Searching "احمد"
     has to find "أحمد", and "حمزه" has to find "حمزة". See @/lib/arabicSearch.
   *
     The needle is normalised HERE, not inside `arabicIncludes` — that function
     folds only the haystack and takes the needle already folded, once per
     query instead of once per option. Passing the raw text is a bug that hides
     itself: "احمد" still finds "أحمد", because the stored side is folded, and
     only the reverse fails. Measured before it was fixed. */
  const shown = useMemo(() => {
    const needle = normalizeArabic(query);
    if (!searchable || needle === "") return options;
    return options.filter((o) => arabicIncludes(o.label, needle));
  }, [options, query, searchable]);

  const commit = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Enter") {
      /* Always prevented, match or no match. This control is used inside modals
         that have their own submit button, and an un-prevented Enter in a text
         field submits the form around it — assigning whoever happened to be
         selected, from a box the coach was still typing into. */
      e.preventDefault();
      const first = shown.find((o) => !o.disabled);
      if (first) commit(first);
    }
  };

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (disabled) return;
          if (isOpen) close();
          else setIsOpen(true);
        }}
      >
        <span className="custom-select-label" style={{ opacity: !selectedOption ? 0.6 : 1 }}>
          {selectedOption ? selectedOption.label : placeholder || "اختر..."}
        </span>
        <Icon name="expand_more" className="custom-select-icon" />
      </button>

      {isOpen && !disabled && (
        <div className="custom-select-dropdown" ref={dropdownRef}>
          {searchable && (
            /* Sticky rather than a sibling above the scroller: the panel's own
               `max-height` and `overflow-y` are what every other select in the
               app already relies on, and moving them onto an inner list would
               change all sixteen to serve one. */
            <div className="custom-select-search">
              <Icon name="search" className="custom-select-search-icon" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
              />
            </div>
          )}

          {options.length === 0 ? (
            <div className="custom-select-empty">لا توجد خيارات</div>
          ) : shown.length === 0 ? (
            /* Distinct from "لا توجد خيارات" on purpose: one says the list is
               empty, the other says the search emptied it, and the way out of
               the two is not the same. */
            <div className="custom-select-empty">لا توجد نتائج مطابقة</div>
          ) : (
            shown.map((opt) => (
              <button
                type="button"
                key={opt.value}
                disabled={opt.disabled}
                className={`custom-select-option ${opt.value === value ? "selected" : ""} ${opt.disabled ? "disabled" : ""}`}
                style={{ opacity: opt.disabled ? 0.5 : 1, cursor: opt.disabled ? "not-allowed" : "pointer" }}
                onClick={() => commit(opt)}
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
