"use client";

import { DatePicker } from "@/components/DatePicker";

/* The trainee dashboard's date field — the weight log's measurement day and a
 * workout's day. Kept under its old name and props so neither call site changes;
 * the calendar itself is the site-wide one in @/components/DatePicker.
 *
 * What it used to draw itself (a Sunday-first grid, a popover that a dialog
 * could clip) is gone. Its classes `.custom-date-*` in dashboard.css and
 * training-calendar.css no longer reach this; `.custom-date-nav-btn` is still
 * used by the training calendar on the home tab. */

interface CustomDatePickerProps {
  value: string | null;
  minDate?: string | null;
  maxDate?: string | null;
  onlyToday?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (date: string | null) => void;
  onInvalidSelect?: () => void;
}

export function CustomDatePicker({
  value,
  minDate,
  maxDate,
  onlyToday = false,
  disabled = false,
  fullWidth = false,
  onChange,
  onInvalidSelect,
}: CustomDatePickerProps) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      onlyToday={onlyToday}
      disabled={disabled}
      fullWidth={fullWidth}
      onInvalidSelect={onInvalidSelect}
      label="تاريخ الجلسة"
      placeholder="تحديد تاريخ الجلسة..."
      title={disabled ? "التاريخ غير متاح للتعديل حالياً" : "اضغط لاختيار أو تعديل التاريخ"}
    />
  );
}
