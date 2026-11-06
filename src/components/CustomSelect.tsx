"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useId } from "react";
import { createPortal } from "react-dom";
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

/* The list is portalled to <body> and placed from the trigger's rectangle —
   below it when it fits, above it when it does not. It used to be absolutely
   positioned inside the trigger's container, which a dialog's scrolling body
   clips: measured in the assign dialog at 1280x900, 99px of a 240px list was
   visible. Fixed to the viewport, nothing can clip it.

   It sits above every dialog (AdminModal is z-index 9999) and matches the
   site's calendar, @/components/DatePicker. */
const GAP = 6;
const MAX_HEIGHT = 280;
const MIN_WIDTH = 180;

type Place = { top: number; left: number; width: number; maxHeight: number; up: boolean };

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
  /** The option the keyboard is on — an index into `shown`. */
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  /* A filter is a way of looking, not a setting — it should not still be there
     the next time the list is opened, showing three names out of forty with no
     sign of why. Every path that shuts the panel goes through here, so there is
     one place that decides it rather than an effect watching `isOpen` and
     setting state back at it. */
  const close = useCallback((refocus = false) => {
    setIsOpen(false);
    setQuery("");
    setActive(-1);
    if (refocus) triggerRef.current?.focus();
  }, []);

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

  const open = () => {
    if (disabled) return;
    const at = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(at >= 0 ? at : options.findIndex((o) => !o.disabled));
    setPlace(null);
    setIsOpen(true);
  };

  /* Below the trigger when the list fits, above when it does not and there is
     more room there. Read again on scroll and resize, since dialog bodies
     scroll and the trigger moves with them. */
  const reposition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const natural = Math.min(dropdownRef.current?.scrollHeight ?? MAX_HEIGHT, MAX_HEIGHT);
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const up = natural > below && above > below;
    const maxHeight = Math.max(120, Math.min(MAX_HEIGHT, up ? above : below));
    const width = Math.min(Math.max(r.width, MIN_WIDTH), window.innerWidth - 16);
    /* Right edges together, the way the page reads; kept on screen. */
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const height = Math.min(natural, maxHeight);
    setPlace({ top: up ? r.top - GAP - height : r.bottom + GAP, left, width, maxHeight, up });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
  }, [isOpen, shown.length, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    /* The list lives outside the container now, so a press inside it is not an
       outside press. */
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isOpen, close, reposition]);

  /* The point of opening a searchable list is usually to type into it. Focus
     only — nothing here sets state. */
  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus();
  }, [isOpen, searchable]);

  /* Keep the keyboard's option in view as it moves. `nearest` scrolls the list
     the least it can, and never the page — the list is fixed. */
  useEffect(() => {
    if (!isOpen || active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [isOpen, active, listId]);

  /* A disabled control cannot hold an open list. */
  if (disabled && isOpen) {
    setIsOpen(false);
    setQuery("");
    setActive(-1);
  }

  const commit = (opt: CustomSelectOption | undefined) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    close(true);
  };

  /** The next enabled option from `from`, stepping by `dir`; wraps around. */
  const move = (from: number, dir: 1 | -1): number => {
    const n = shown.length;
    if (n === 0) return -1;
    for (let i = 1; i <= n; i++) {
      const at = (((from + dir * i) % n) + n) % n;
      if (!shown[at].disabled) return at;
    }
    return -1;
  };
  const edge = (end: "first" | "last"): number => {
    const list = shown.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    return list.length ? (end === "first" ? list[0] : list[list.length - 1]) : -1;
  };

  /* Arrows, Home/End, Enter and Escape — on the trigger, and in the filter box
     when there is one. */
  const onListKey = (e: React.KeyboardEvent): boolean => {
    switch (e.key) {
      case "ArrowDown":
        setActive((a) => move(a, 1));
        return true;
      case "ArrowUp":
        setActive((a) => move(a < 0 ? 0 : a, -1));
        return true;
      case "Home":
        setActive(edge("first"));
        return true;
      case "End":
        setActive(edge("last"));
        return true;
      case "Escape":
        /* The list's Escape, not the dialog's around it. */
        e.stopPropagation();
        close(true);
        return true;
      case "Tab":
        close();
        return false;
      default:
        return false;
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(shown[active]);
      return;
    }
    if (onListKey(e)) e.preventDefault();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      /* Always prevented, match or no match. This control is used inside modals
         that have their own submit button, and an un-prevented Enter in a text
         field submits the form around it — assigning whoever happened to be
         selected, from a box the coach was still typing into. */
      e.preventDefault();
      commit(shown[active] && !shown[active].disabled ? shown[active] : shown.find((o) => !o.disabled));
      return;
    }
    if (e.key === "Home" || e.key === "End") return; // the caret's, in a text box
    if (onListKey(e)) e.preventDefault();
  };

  const activeId = isOpen && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        onClick={() => {
          if (disabled) return;
          if (isOpen) close();
          else open();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="custom-select-label" style={{ opacity: !selectedOption ? 0.6 : 1 }}>
          {selectedOption ? selectedOption.label : placeholder || "اختر..."}
        </span>
        <Icon name="expand_more" className="custom-select-icon" />
      </button>

      {isOpen &&
        !disabled &&
        createPortal(
          <div
            className={`custom-select-dropdown${place?.up ? " is-up" : ""}`}
            ref={dropdownRef}
            dir="rtl"
            style={{
              top: place?.top ?? 0,
              left: place?.left ?? 0,
              width: place?.width,
              maxHeight: place?.maxHeight ?? MAX_HEIGHT,
              /* Measured once before it is shown, so it never flashes in the
                 wrong place. */
              visibility: place ? "visible" : "hidden",
            }}
          >
            {searchable && (
              /* Sticky rather than a sibling above the scroller: the panel is
                 both the panel and the scroller. */
              <div className="custom-select-search">
                <Icon name="search" className="custom-select-search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  autoComplete="off"
                />
              </div>
            )}

            <div role="listbox" id={listId} className="custom-select-list">
              {options.length === 0 ? (
                <div className="custom-select-empty">لا توجد خيارات</div>
              ) : shown.length === 0 ? (
                /* Distinct from "لا توجد خيارات" on purpose: one says the list is
                   empty, the other says the search emptied it, and the way out of
                   the two is not the same. */
                <div className="custom-select-empty">لا توجد نتائج مطابقة</div>
              ) : (
                shown.map((opt, i) => {
                  const selected = opt.value === value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      disabled={opt.disabled}
                      className={`custom-select-option${selected ? " selected" : ""}${i === active ? " is-active" : ""}${opt.disabled ? " disabled" : ""}`}
                      onMouseMove={() => !opt.disabled && active !== i && setActive(i)}
                      onClick={() => commit(opt)}
                    >
                      <span className="custom-select-option-label">{opt.label}</span>
                      {selected && <Icon name="check" className="custom-select-check" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
