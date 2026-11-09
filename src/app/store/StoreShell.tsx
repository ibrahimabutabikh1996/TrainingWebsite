"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight, CircleCheck, House, Minus, Plus, ShoppingBag, Trash2, Truck, X, MessageCircle, ShieldCheck, Star,
} from "lucide-react";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import {
  IRAQ_GOVERNORATES,
  buildWhatsAppMessage,
  formatIQD,
  isInIraq,
  makeOrderReference,
  normalizeIraqiPhone,
  pointsFor,
  whatsAppUrl,
  type GeoPoint,
  type StoreSettings,
} from "@/lib/store/types";
import { CustomSelect } from "@/components/CustomSelect";
import { LocationPicker } from "./LocationPicker";
import { CartProvider, useCart } from "./cart";
import { ProductVisual } from "./ProductVisual";

export default function StoreShell({ settings, children }: { settings: StoreSettings; children: React.ReactNode }) {
  return (
    <CartProvider settings={settings}>
      <div className="st-root" dir="rtl">
        {settings.announcement && <div className="st-announce">{settings.announcement}</div>}
        <StoreHeader />
        <main className="st-main">{children}</main>
        <StoreFooter settings={settings} />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}

function StoreHeader() {
  const { count, open } = useCart();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`st-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="st-header-inner">
        <Link href="/store" className="st-header-logo" aria-current={pathname === "/store" ? "page" : undefined}>
          <img
            src={optimizedSrc("/images/logo/hLogo.png", 384)}
            srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640])}
            sizes="170px"
            alt="Ibrahim Abutabikh"
          />
          <span className="st-header-tag">STORE</span>
        </Link>

        <nav className="st-header-nav" aria-label="المتجر">
          <Link href="/store#catalog">المنتجات</Link>
          <Link href="/">الموقع الرئيسي</Link>
        </nav>

        <div className="st-header-actions">
          <Link href="/" className="ui-btn ui-btn--icon st-header-home" aria-label="العودة للموقع الرئيسي">
            <House aria-hidden="true" />
          </Link>
          <button type="button" className="st-cart-btn" onClick={open} aria-label={`السلة، ${count} منتج`}>
            <ShoppingBag aria-hidden="true" />
            {count > 0 && <span className="st-cart-badge">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function StoreFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="st-footer">
      <div className="st-footer-perks">
        <div><Truck aria-hidden="true" /><span>توصيل لكل المحافظات</span></div>
        <div><ShieldCheck aria-hidden="true" /><span>منتجات أصلية مضمونة</span></div>
        <div><MessageCircle aria-hidden="true" /><span>طلب مباشر عبر واتساب</span></div>
      </div>
      <p className="st-footer-note">
        {settings.free_delivery_over > 0
          ? `توصيل مجاني للطلبات فوق ${formatIQD(settings.free_delivery_over)}`
          : `أجور التوصيل ${formatIQD(settings.delivery_fee)}`}
      </p>
      <p className="st-footer-copy">© {new Date().getFullYear()} Ibrahim Abutabikh · متجر المكملات الغذائية</p>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * The cart drawer: lines → details → sent
 * ------------------------------------------------------------------ */

type Step = "cart" | "details" | "sent";

interface Details {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  location: GeoPoint | null;
}

const EMPTY_DETAILS: Details = { name: "", phone: "", city: "", address: "", notes: "", location: null };
const DETAILS_KEY = "store-checkout-details";

function CartDrawer() {
  const cart = useCart();
  const { isOpen, close, lines, subtotal, deliveryFee, total, settings } = cart;
  const [step, setStep] = useState<Step>("cart");
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const points = pointsFor(subtotal, settings);
  const [sent, setSent] = useState<{ reference: string; url: string } | null>(null);

  /* Close on Escape, and hold the page still behind the drawer. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("st-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("st-lock");
    };
  }, [isOpen, close]);

  /* A returning customer does not type their address twice. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DETAILS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of stored data on mount
      if (saved) setDetails({ ...EMPTY_DETAILS, ...JSON.parse(saved), notes: "" });
    } catch {}
  }, []);

  const closeDrawer = () => {
    close();
    if (step === "sent") {
      setStep("cart");
      setSent(null);
    }
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (details.name.trim().length < 2) next.name = "اكتب اسمك";
    if (!normalizeIraqiPhone(details.phone)) next.phone = "رقم عراقي صحيح، مثل 07XXXXXXXXX";
    if (!details.city) next.city = "اختر المحافظة";
    if (details.address.trim().length < 4) next.address = "اكتب العنوان بالتفصيل";
    if (!isInIraq(details.location)) next.location = "حدّد موقع التوصيل على الخريطة";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /* WhatsApp is opened inside the click — a window opened after an awaited
     request is one a browser may block. The order is recorded alongside it,
     and the server works the money out again for the panel. */
  const placeOrder = () => {
    if (!validate() || lines.length === 0) return;
    const phone = normalizeIraqiPhone(details.phone)!;
    const reference = makeOrderReference();
    const items = lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      size: l.size,
      flavor: l.flavor,
      unitPrice: l.unitPrice,
      qty: l.qty,
    }));
    const message = buildWhatsAppMessage({
      reference,
      customer_name: details.name.trim(),
      customer_phone: phone,
      city: details.city,
      address: details.address.trim(),
      notes: details.notes,
      items,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      location: details.location,
      points,
    });
    const url = whatsAppUrl(settings.whatsapp, message);

    fetch("/api/store/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        reference,
        customer_name: details.name,
        customer_phone: phone,
        city: details.city,
        address: details.address,
        notes: details.notes,
        location: details.location,
        items: items.map(({ productId, size, flavor, qty }) => ({ productId, size, flavor, qty })),
      }),
    }).catch(() => {});

    try {
      localStorage.setItem(DETAILS_KEY, JSON.stringify({ ...details, notes: "" }));
    } catch {}

    window.open(url, "_blank", "noopener");
    setSent({ reference, url });
    setStep("sent");
    cart.clear();
  };

  const field = (key: Exclude<keyof Details, "location">) => ({
    value: details[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDetails((d) => ({ ...d, [key]: e.target.value }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    },
    "aria-invalid": errors[key] ? true : undefined,
  });

  return (
    <>
      <div className={`st-scrim${isOpen ? " is-open" : ""}`} onClick={closeDrawer} aria-hidden="true" />
      <aside
        className={`st-drawer${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="سلة المشتريات"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="st-drawer-head">
          {step === "details" ? (
            <button type="button" className="st-icon-btn" onClick={() => setStep("cart")} aria-label="رجوع للسلة">
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <span className="st-drawer-icon"><ShoppingBag aria-hidden="true" /></span>
          )}
          <h2>{step === "cart" ? "سلتك" : step === "details" ? "معلومات التوصيل" : "تم إرسال الطلب"}</h2>
          <button type="button" className="st-icon-btn" onClick={closeDrawer} aria-label="إغلاق السلة">
            <X aria-hidden="true" />
          </button>
        </div>

        {step === "cart" && (
          <>
            {lines.length === 0 ? (
              <div className="st-drawer-empty">
                <ShoppingBag aria-hidden="true" />
                <p>سلتك فارغة</p>
                <span>ابدأ بإضافة منتجاتك المفضلة</span>
                <Link href="/store" className="btn-secondary st-btn st-btn--ghost" onClick={closeDrawer}>
                  تصفح المنتجات
                </Link>
              </div>
            ) : (
              <ul className="st-lines">
                {lines.map((line) => (
                  <li key={line.key} className="st-line">
                    <Link href={`/store/${line.slug}`} className="st-line-visual" onClick={closeDrawer} tabIndex={-1}>
                      <ProductVisual
                        name={line.name}
                        category={line.category}
                        accent={line.accent}
                        image_url={line.image_url}
                        size={88}
                      />
                    </Link>
                    <div className="st-line-body">
                      <Link href={`/store/${line.slug}`} className="st-line-name" onClick={closeDrawer}>
                        {line.name}
                      </Link>
                      {(line.size || line.flavor) && (
                        <span className="st-line-variant">{[line.size, line.flavor].filter(Boolean).join(" · ")}</span>
                      )}
                      <div className="st-line-row">
                        <div className="st-qty" role="group" aria-label="الكمية">
                          <button type="button" className="ui-btn ui-btn--icon" onClick={() => cart.setQty(line.key, line.qty + 1)} aria-label="زيادة">
                            <Plus aria-hidden="true" />
                          </button>
                          <span aria-live="polite">{line.qty}</span>
                          <button
                            type="button"
                            className="ui-btn ui-btn--icon"
                            onClick={() => (line.qty > 1 ? cart.setQty(line.key, line.qty - 1) : cart.remove(line.key))}
                            aria-label={line.qty > 1 ? "إنقاص" : "حذف"}
                          >
                            {line.qty > 1 ? <Minus aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                          </button>
                        </div>
                        <strong className="st-line-price">{formatIQD(line.unitPrice * line.qty)}</strong>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {lines.length > 0 && (
              <div className="st-drawer-foot">
                {settings.free_delivery_over > 0 && subtotal < settings.free_delivery_over && (
                  <div className="st-free-ship">
                    <span>
                      أضف {formatIQD(settings.free_delivery_over - subtotal)} واحصل على توصيل مجاني
                    </span>
                    <div className="st-free-ship-track">
                      <div style={{ width: `${Math.min(100, (subtotal / settings.free_delivery_over) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <Totals subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
                {points > 0 && <PointsNote points={points} />}
                {settings.store_open ? (
                  <button type="button" className="btn-primary st-btn st-btn--block" onClick={() => setStep("details")}>
                    إتمام الطلب
                  </button>
                ) : (
                  <p className="st-closed-note">المتجر لا يستقبل طلبات حالياً</p>
                )}
              </div>
            )}
          </>
        )}

        {step === "details" && (
          <form
            className="st-checkout"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              placeOrder();
            }}
          >
            <div className="st-checkout-fields">
              <label className="st-field">
                <span>الاسم الكامل</span>
                <input type="text" autoComplete="name" placeholder="مثال: علي حسين" {...field("name")} />
                {errors.name && <em>{errors.name}</em>}
              </label>
              <label className="st-field">
                <span>رقم الهاتف</span>
                <input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXXX" {...field("phone")} />
                {errors.phone && <em>{errors.phone}</em>}
              </label>
              <div className="st-field">
                <span id="st-city-label">المحافظة</span>
                <CustomSelect
                  className={`st-select${errors.city ? " is-invalid" : ""}`}
                  value={details.city}
                  onChange={(city) => {
                    setDetails((d) => ({ ...d, city }));
                    if (errors.city) setErrors((er) => ({ ...er, city: undefined }));
                  }}
                  placeholder="اختر المحافظة"
                  searchable
                  searchPlaceholder="ابحث عن محافظة…"
                  options={IRAQ_GOVERNORATES.map((g) => ({ value: g, label: g }))}
                />
                {errors.city && <em>{errors.city}</em>}
              </div>
              <div className="st-field">
                <span>موقع التوصيل على الخريطة</span>
                <LocationPicker
                  value={details.location}
                  city={details.city}
                  invalid={!!errors.location}
                  onChange={(location) => {
                    setDetails((d) => ({ ...d, location }));
                    if (errors.location) setErrors((er) => ({ ...er, location: undefined }));
                  }}
                />
                {errors.location && <em>{errors.location}</em>}
              </div>
              <label className="st-field">
                <span>العنوان بالتفصيل</span>
                <textarea rows={2} autoComplete="street-address" placeholder="المنطقة، الشارع، أقرب نقطة دالة" {...field("address")} />
                {errors.address && <em>{errors.address}</em>}
              </label>
              <label className="st-field">
                <span>ملاحظات <small>(اختياري)</small></span>
                <textarea rows={2} placeholder="وقت التوصيل المناسب، أي تفاصيل أخرى…" {...field("notes")} />
              </label>
            </div>

            <div className="st-drawer-foot">
              <div className="st-summary-mini">
                {lines.map((l) => (
                  <div key={l.key}>
                    <span>{l.qty} × {l.name}</span>
                    <span>{formatIQD(l.qty * l.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <Totals subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
              {points > 0 && <PointsNote points={points} />}
              <button type="submit" className="btn-primary st-btn st-btn--block st-btn--whatsapp">
                <MessageCircle aria-hidden="true" />
                تثبيت الطلب عبر واتساب
              </button>
              <p className="st-pay-note">الدفع نقداً عند الاستلام. سيتواصل معك الكابتن لتأكيد الطلب.</p>
            </div>
          </form>
        )}

        {step === "sent" && sent && (
          <div className="st-sent">
            <CircleCheck aria-hidden="true" className="st-sent-icon" />
            <h3>شكراً لطلبك!</h3>
            <p>رقم طلبك</p>
            <strong className="st-sent-ref" dir="ltr">{sent.reference}</strong>
            <p className="st-sent-hint">
              فُتحت محادثة واتساب مع الكابتن وفيها تفاصيل طلبك كاملة — فقط اضغط إرسال.
              إذا لم تُفتح، استخدم الزر أدناه.
            </p>
            <a href={sent.url} target="_blank" rel="noopener noreferrer" className="btn-primary st-btn st-btn--block st-btn--whatsapp">
              <MessageCircle aria-hidden="true" />
              فتح واتساب وإرسال الطلب
            </a>
            <button type="button" className="btn-secondary st-btn st-btn--ghost st-btn--block" onClick={closeDrawer}>
              متابعة التسوق
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function PointsNote({ points }: { points: number }) {
  return (
    <p className="st-points-note">
      <Star aria-hidden="true" /> ستكسب <strong>{points}</strong> نقطة مع هذا الطلب
    </p>
  );
}

function Totals({ subtotal, deliveryFee, total }: { subtotal: number; deliveryFee: number; total: number }) {
  return (
    <dl className="st-totals">
      <div><dt>المجموع</dt><dd>{formatIQD(subtotal)}</dd></div>
      <div><dt>التوصيل</dt><dd>{deliveryFee === 0 ? <span className="st-free">مجاني</span> : formatIQD(deliveryFee)}</dd></div>
      <div className="st-totals-grand"><dt>الإجمالي</dt><dd>{formatIQD(total)}</dd></div>
    </dl>
  );
}
