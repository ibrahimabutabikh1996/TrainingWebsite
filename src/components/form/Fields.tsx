"use client";

/* Shared building blocks for the subscription form steps. Each step used to
   repeat the same label/wrapper/input markup by hand, which is how the layout
   drifted between steps — these keep it in one place. Styling lives in
   src/app/form/form.css under the .form-page scope. */

import { useEffect, useId, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

/* ─── Icons ─── */

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export { IconCheck, IconUpload, IconFile, IconX };

/* ─── Layout ─── */

export function FormGrid({
  children,
  tight,
}: {
  children: React.ReactNode;
  /* Narrower tracks, for rows of short values like meal windows or cm measurements. */
  tight?: boolean;
}) {
  return <div className={`form-grid${tight ? " form-grid--tight" : ""}`}>{children}</div>;
}

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="form-fieldset">
      <legend>{title}</legend>
      {hint && <p className="form-fieldset-hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

/* ─── Field shell ─── */

interface FieldShellProps {
  /* Omit when the enclosing FormSection legend already names the control —
     repeating it just doubles the same line on screen. */
  label?: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, required, optional, hint, full, children }: FieldShellProps) {
  const { t } = useLanguage();
  return (
    <div className={`field${full ? " field--full" : ""}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          <span>{label}</span>
          {required && (
            <span className="field-req" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="field-optional">({t("form_optional")})</span>}
        </label>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* ─── Inputs ─── */

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "tel";
  unit?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  full?: boolean;
  min?: number;
  max?: number;
  inputMode?: "numeric" | "decimal" | "tel" | "text";
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  unit,
  placeholder,
  required,
  optional,
  hint,
  full,
  min,
  max,
  inputMode,
}: TextInputProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} required={required} optional={optional} hint={hint} full={full}>
      <div className={`control${unit ? " control--unit" : ""}`}>
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          className="form-input"
          required={required}
          value={value}
          min={min}
          max={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span className="control-unit">{unit}</span>}
      </div>
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  required,
  optional,
  hint,
  full = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  full?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} required={required} optional={optional} hint={hint} full={full}>
      <div className="control">
        <textarea
          id={id}
          className="form-input"
          rows={rows}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /* Option values double as translation keys unless an explicit label is given. */
  options: readonly (TranslationKey | { value: string; label: string })[];
  required?: boolean;
  optional?: boolean;
  hint?: string;
  full?: boolean;
  disabled?: boolean;
  /* Omit the leading "Select…" entry (e.g. gender, which always has a value). */
  noPlaceholder?: boolean;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  optional,
  hint,
  full,
  disabled,
  noPlaceholder,
}: SelectFieldProps) {
  const id = useId();
  const { t } = useLanguage();
  return (
    <Field label={label} htmlFor={id} required={required} optional={optional} hint={hint} full={full}>
      <div className="control control--select">
        <select
          id={id}
          className="form-input"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!noPlaceholder && <option value="">{t("opt_select")}</option>}
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const text = typeof opt === "string" ? t(opt) : opt.label;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
      </div>
    </Field>
  );
}

/* ─── Multi-select chips ─── */

export function ChipGroup({
  label,
  options,
  values,
  onToggle,
  hint,
  optional,
}: {
  label: string;
  options: readonly TranslationKey[];
  values: string[];
  onToggle: (value: string) => void;
  hint?: string;
  optional?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <Field label={label} hint={hint} optional={optional} full>
      <div className="chip-group">
        {options.map((opt) => {
          const checked = values.includes(opt);
          return (
            <label key={opt} className="chip" data-checked={checked}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(opt)} />
              <span className="chip-box" aria-hidden="true">
                <IconCheck />
              </span>
              <span>{t(opt)}</span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

/* ─── Upload dropzone ─── */

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Object URLs for image previews, revoked when the file set changes so the
   blobs don't leak across re-selections. Callers rebuild the `files` array on
   every render, so the effect keys off a stable signature of its contents
   rather than the array identity — otherwise it would re-run forever. */
function usePreviews(files: File[], enabled: boolean) {
  const signature = enabled
    ? files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|")
    : "";

  const urls = useMemo(
    () => (enabled ? files.map((f) => URL.createObjectURL(f)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, enabled]
  );

  /* Release the blobs once this set is replaced or the field unmounts. */
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return urls;
}

interface DropzoneProps {
  /* Optional — skip it when the section legend already says the same thing. */
  label?: string;
  /* Text inside the dashed area. */
  prompt: string;
  files: File[];
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /* Show image thumbnails instead of a filename list. */
  preview?: boolean;
  hint?: string;
  sectionHint?: string;
  optional?: boolean;
}

export function Dropzone({
  label,
  prompt,
  files,
  onFiles,
  accept,
  multiple,
  preview,
  hint,
  optional,
}: DropzoneProps) {
  const id = useId();
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);
  const previews = usePreviews(files, Boolean(preview));

  const accepted = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    onFiles(multiple ? [...files, ...incoming] : [incoming[0]]);
  };

  const removeAt = (index: number) => onFiles(files.filter((_, i) => i !== index));

  return (
    <Field label={label} optional={optional} full>
      <div
        className="dropzone"
        data-dragging={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accepted(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
          onChange={(e) => {
            accepted(e.target.files);
            /* Reset so picking the same file twice still fires a change. */
            e.target.value = "";
          }}
        />
        <span className="dropzone-icon">
          <IconUpload />
        </span>
        <span className="dropzone-text">{prompt}</span>
        <span className="dropzone-hint">{hint ?? t(preview ? "form_dropzone_hint_img" : "form_dropzone_hint")}</span>
      </div>

      {preview && files.length > 0 && (
        <div className="thumb-grid">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="thumb">
              {/* Local blob preview — next/image would need the blob host allowlisted. */}
              <img src={previews[i]} alt={file.name} />
              <button
                type="button"
                className="file-remove"
                aria-label={`${t("form_remove_file")}: ${file.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}

      {!preview && files.length > 0 && (
        <div className="file-list">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="file-item">
              <span className="file-item-icon">
                <IconFile />
              </span>
              <span className="file-item-name" title={file.name}>
                {file.name}
              </span>
              <span className="file-item-size">{formatSize(file.size)}</span>
              <button
                type="button"
                className="file-remove"
                aria-label={`${t("form_remove_file")}: ${file.name}`}
                onClick={() => removeAt(i)}
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}
