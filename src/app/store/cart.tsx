"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import {
  MAX_LINE_QTY,
  deliveryFeeFor,
  firstAvailable,
  lineKey,
  priceFor,
  variantQty,
  type CartLine,
  type StoreProduct,
  type StoreSettings,
} from "@/lib/store/types";

/* The cart lives in this browser's storage, so it survives a reload and a
 * return visit. Read through `useSyncExternalStore` so the server renders it
 * empty and hydration fills it without a mismatch. Storage can be unavailable
 * (a private window), so the lines also live in memory for the session. */

const CART_KEY = "store-cart-v1";
const CART_EVENT = "store-cart-change";
const EMPTY: CartLine[] = [];

let memoryLines: CartLine[] = EMPTY;
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;

function readLines(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CART_KEY);
  } catch {
    return memoryLines;
  }
  if (raw === null) return memoryLines;
  if (raw === cachedRaw) return cachedLines;
  try {
    const parsed = JSON.parse(raw);
    cachedLines = Array.isArray(parsed) ? (parsed as CartLine[]).filter((l) => l && typeof l.key === "string") : EMPTY;
  } catch {
    cachedLines = EMPTY;
  }
  cachedRaw = raw;
  return cachedLines;
}

function writeLines(lines: CartLine[]) {
  memoryLines = lines;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  } catch {}
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CART_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CART_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  settings: StoreSettings;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (product: StoreProduct, options?: { size?: string | null; flavor?: string | null; qty?: number; image_url?: string }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ settings, children }: { settings: StoreSettings; children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, readLines, () => EMPTY);
  const [isOpen, setIsOpen] = useState(false);

  const add = useCallback<CartContextValue["add"]>((product, options = {}) => {
    /* The quick add on a card names no size or flavour: it takes one in stock. */
    const pick = options.size === undefined && options.flavor === undefined ? firstAvailable(product) : null;
    const size = options.size ?? pick?.size ?? product.sizes[0]?.label ?? null;
    const flavor = options.flavor ?? pick?.flavor ?? product.flavors[0] ?? null;
    const tracked = product.variant_stock.length > 0 ? (variantQty(product, size, flavor) ?? 0) : null;
    if (tracked === 0) return;
    const max = Math.min(MAX_LINE_QTY, tracked ?? MAX_LINE_QTY);
    const qty = Math.max(1, Math.min(max, options.qty ?? 1));
    const key = lineKey(product.id, size, flavor);
    const current = readLines();
    const existing = current.find((l) => l.key === key);
    const next = existing
      ? current.map((l) => (l.key === key ? { ...l, qty: Math.min(max, l.qty + qty), max } : l))
      : [
          ...current,
          {
            key,
            productId: product.id,
            slug: product.slug,
            name: product.name,
            image_url: options.image_url ?? product.flavor_images.find((f) => f.label === flavor)?.src ?? product.image_url,
            accent: product.accent,
            category: product.category,
            size,
            flavor,
            unitPrice: priceFor(product, size),
            qty,
            max,
          },
        ];
    writeLines(next);
    setIsOpen(true);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    const clamped = Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(qty)));
    writeLines(readLines().map((l) => (l.key === key ? { ...l, qty: Math.min(clamped, l.max ?? MAX_LINE_QTY) } : l)));
  }, []);

  const remove = useCallback((key: string) => {
    writeLines(readLines().filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => writeLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);
    const deliveryFee = deliveryFeeFor(subtotal, settings);
    return {
      lines,
      count,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      settings,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
      clear,
    };
  }, [lines, settings, isOpen, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
