"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { confirmDialog } from "@/lib/confirmDialog";
import { CustomSelect } from "@/components/CustomSelect";
import {
  PRODUCT_TEXT_FIELDS,
  STORE_TEXT_FIELDS,
  draftBetween,
  parseFieldId,
  productFieldId,
  writeField,
  type StoreContent,
} from "@/lib/store/content";
import { discardStoreContentDraft, publishStoreContent, saveStoreContentDraft } from "./actions";
import "./store-content.css";

/* The widths the frame lays the storefront out at, then scales to fit — a
   desktop at a desktop's width, not at whatever is left beside the panel. */
const FRAME_WIDTHS = { desktop: 1366, mobile: 390 } as const;

/**
 * The store's copy, edited on the storefront itself.
 *
 * The storefront is framed beside a panel (`/store-preview`, see
 * StorePreviewRoot): a click on any of its texts makes it writable in place,
 * and the panel holds the same fields for anything easier typed than clicked —
 * the pop-up's wording, a long description. Edits are kept as a draft until
 * published; see @/lib/store/content for why the draft holds only what changed.
 *
 * Separate from the gym page's content manager on purpose: its own route, its
 * own draft row, its own preview.
 */
export default function StoreContentClient({
  initial,
  published: initialPublished,
  products,
}: {
  /** Where editing starts: published with the saved draft laid over it. */
  initial: StoreContent;
  /** What visitors see now. */
  published: StoreContent;
  products: { id: string; slug: string }[];
}) {
  const [content, setContent] = useState(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const [published, setPublished] = useState(initialPublished);
  const current = JSON.stringify(content);
  /* Only on this screen, saved as a draft, or in front of visitors. */
  const isDirty = current !== savedSnapshot;
  const isUnpublished = current !== JSON.stringify(published);
  const [busy, setBusy] = useState<null | "draft" | "publish" | "discard">(null);

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [page, setPage] = useState("");
  const [device, setDevice] = useState<keyof typeof FRAME_WIDTHS>("desktop");
  const [mobileView, setMobileView] = useState<"site" | "fields">("site");
  const [locate, setLocate] = useState<{ field: string; at: number } | null>(null);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const contentRef = useRef(content);

  const nameOf = (id: string) => content.products[id]?.name || "منتج";

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const postContent = (value: StoreContent) => {
    frameRef.current?.contentWindow?.postMessage({ type: "STORE_PREVIEW", content: value }, window.location.origin);
  };

  /* Every change goes to the frame, a beat after typing stops. */
  useEffect(() => {
    contentRef.current = content;
    const timer = setTimeout(() => postContent(content), 150);
    return () => clearTimeout(timer);
  }, [content]);

  /* What the framed storefront says. Read only from that frame, on this origin. */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const frameWindow = frameRef.current?.contentWindow;
      if (!frameWindow || e.source !== frameWindow) return;
      const data = e.data;

      if (data?.type === "STORE_FRAME_READY") {
        postContent(contentRef.current);
      } else if (data?.type === "STORE_INLINE_EDIT") {
        if (typeof data.field !== "string" || typeof data.value !== "string" || !parseFieldId(data.field)) return;
        setContent((c) => writeField(c, data.field, data.value));
      } else if (data?.type === "STORE_INLINE_SELECT" && typeof data.field === "string") {
        const at = parseFieldId(data.field);
        if (!at) return;
        if (at.kind === "product") setProductId(at.id);
        setLocate({ field: data.field, at: Date.now() });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* The field a click on the storefront asked for, brought into view. */
  useEffect(() => {
    if (!locate) return;
    const row = document.querySelector<HTMLElement>(`.sc-panel [data-sc-field="${CSS.escape(locate.field)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("is-located");
    void row.offsetWidth;
    row.classList.add("is-located");
    const timer = setTimeout(() => row.classList.remove("is-located"), 1600);
    return () => clearTimeout(timer);
  }, [locate]);

  /* The browser's own warning before leaving with edits that were never kept. */
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const setField = (field: string, value: string) => setContent((c) => writeField(c, field, value));

  const saveDraft = async () => {
    setBusy("draft");
    const attempt = current;
    const res = await saveStoreContentDraft(draftBetween(content, published));
    setBusy(null);
    if (res.success) {
      setSavedSnapshot(attempt);
      toast.success("تم حفظ المسودة — لم تُنشر للزبائن بعد.");
    } else toast.error(res.error);
  };

  const publish = async () => {
    const go = await confirmDialog("ستظهر هذه النصوص لكل زوار المتجر فور النشر.", {
      title: "نشر التحديث للزبائن",
      confirmLabel: "نشر الآن",
      cancelLabel: "ليس الآن",
    });
    if (!go) return;
    setBusy("publish");
    const attempt = content;
    const res = await publishStoreContent(draftBetween(content, published));
    setBusy(null);
    if (res.success) {
      setPublished(attempt);
      setSavedSnapshot(JSON.stringify(attempt));
      toast.success("تم نشر التحديث في المتجر.");
    } else toast.error(res.error);
  };

  const discard = async () => {
    const go = await confirmDialog("ستُحذف المسودة وكل التعديلات غير المنشورة، ويعود المتجر كما يراه الزبائن الآن.", {
      title: "تجاهل التعديلات",
      confirmLabel: "تجاهل",
      cancelLabel: "إلغاء",
      danger: true,
    });
    if (!go) return;
    setBusy("discard");
    const res = await discardStoreContentDraft();
    setBusy(null);
    if (res.success) {
      setContent(published);
      setSavedSnapshot(JSON.stringify(published));
      toast.success("تمت العودة إلى المحتوى المنشور.");
    } else toast.error(res.error);
  };

  const width = FRAME_WIDTHS[device];
  const scale = box.width ? Math.min(1, box.width / width) : 1;
  const src = page ? `/store-preview/${encodeURIComponent(page)}` : "/store-preview";
  const product = content.products[productId];

  return (
    <div className="sc-shell">
      {/* Below a laptop the two cannot sit side by side; this picks which shows. */}
      <div className="ui-segment sc-view-switch" role="tablist" aria-label="طريقة العرض">
        <button type="button" role="tab" className="ui-tab" aria-selected={mobileView === "site"} onClick={() => setMobileView("site")}>
          المتجر
        </button>
        <button type="button" role="tab" className="ui-tab" aria-selected={mobileView === "fields"} onClick={() => setMobileView("fields")}>
          الحقول والنشر
        </button>
      </div>

      <div className="sc-workspace" data-view={mobileView}>
        <aside className="sc-panel">
          <header className="sc-panel-head">
            <h1>محتوى المتجر</h1>
            <p>اضغط على أي نص في المتجر واكتب مباشرة، أو عدّله من الحقول هنا.</p>
          </header>

          <div className="sc-panel-body">
            <section className="sa-fieldset sc-group">
              <h2>نصوص المتجر</h2>
              {STORE_TEXT_FIELDS.map((f) => (
                <label key={f.key} className="sa-field" data-sc-field={f.key}>
                  <span>{f.label}</span>
                  {f.long ? (
                    <textarea rows={3} maxLength={f.max} value={content.texts[f.key]} onChange={(e) => setField(f.key, e.target.value)} />
                  ) : (
                    <input maxLength={f.max} value={content.texts[f.key]} onChange={(e) => setField(f.key, e.target.value)} />
                  )}
                </label>
              ))}
            </section>

            <section className="sa-fieldset sc-group">
              <h2>نصوص المنتجات</h2>
              {products.length === 0 ? (
                <p className="sc-note">لا توجد منتجات معروضة في المتجر حالياً.</p>
              ) : (
                <>
                  <div className="sa-field">
                    <span>المنتج</span>
                    <CustomSelect
                      value={productId}
                      onChange={setProductId}
                      options={products.map((p) => ({ value: p.id, label: nameOf(p.id) }))}
                      searchable={products.length > 8}
                      searchPlaceholder="ابحث عن منتج…"
                    />
                  </div>
                  {product &&
                    PRODUCT_TEXT_FIELDS.map((f) => {
                      const field = productFieldId(productId, f.key);
                      return (
                        <label key={field} className="sa-field" data-sc-field={field}>
                          <span>{f.label}</span>
                          {f.long ? (
                            <textarea rows={5} maxLength={f.max} value={product[f.key]} onChange={(e) => setField(field, e.target.value)} />
                          ) : (
                            <input maxLength={f.max} value={product[f.key]} onChange={(e) => setField(field, e.target.value)} />
                          )}
                        </label>
                      );
                    })}
                  <p className="sc-note">الأسعار والصور والأحجام والمخزون تُعدَّل من صفحة «المنتجات».</p>
                </>
              )}
            </section>
          </div>

          <footer className={`sc-footer${isDirty || isUnpublished ? " is-pending" : ""}`}>
            <div className="sc-status">
              {isDirty ? (
                <span className="sc-state sc-state--dirty">تغييرات غير محفوظة</span>
              ) : isUnpublished ? (
                <span className="sc-state sc-state--draft">مسودة محفوظة — لم تُنشر بعد</span>
              ) : (
                <span className="sc-state">كل التغييرات منشورة</span>
              )}
              {isUnpublished && (
                <button type="button" className="sc-discard" onClick={discard} disabled={busy !== null}>
                  تجاهل التعديلات
                </button>
              )}
            </div>
            <div className="sc-actions">
              <button type="button" className="btn-secondary sa-btn" onClick={saveDraft} disabled={busy !== null || !isDirty}>
                {busy === "draft" ? "جارِ الحفظ…" : "حفظ كمسودة"}
              </button>
              <button type="button" className="btn-primary sa-btn" onClick={publish} disabled={busy !== null || !isUnpublished}>
                {busy === "publish" ? "جارِ النشر…" : "نشر للزبائن"}
              </button>
            </div>
          </footer>
        </aside>

        <section className="sc-stage" aria-label="المتجر كما سيظهر للزبائن">
          <div className="sc-stage-bar">
            <div className="sc-page-pick">
              <CustomSelect
                value={page}
                onChange={setPage}
                options={[
                  { value: "", label: "الصفحة الرئيسية للمتجر" },
                  ...products.map((p) => ({ value: p.slug, label: `صفحة: ${nameOf(p.id)}` })),
                ]}
                searchable={products.length > 8}
                searchPlaceholder="ابحث عن صفحة منتج…"
              />
            </div>
            <div className="ui-segment" role="tablist" aria-label="حجم المعاينة">
              <button type="button" role="tab" className="ui-tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")}>
                كمبيوتر
              </button>
              <button type="button" role="tab" className="ui-tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")}>
                جوال
              </button>
            </div>
          </div>
          <div className="sc-stage-box" ref={boxRef}>
            <iframe
              ref={frameRef}
              src={src}
              title="المتجر كما سيظهر للزبائن"
              className={`sc-frame${width * scale < box.width - 1 ? " is-device" : ""}`}
              onLoad={() => postContent(contentRef.current)}
              style={{
                width,
                height: box.height / scale,
                left: Math.max(0, (box.width - width * scale) / 2),
                transform: `scale(${scale})`,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
