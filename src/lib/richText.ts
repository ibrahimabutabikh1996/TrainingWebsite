"use client";

/* Putting content-managed text on the page without handing it the page.
 *
 * The landing page applies the coach's copy by walking `[data-i18n]` nodes and
 * assigning `el.innerHTML = value`. That makes every stored string a fragment of
 * the document: `<img src=x onerror=...>` in any one of forty-odd fields runs on
 * every visitor. Locking the content manager down (it is the coach's alone now)
 * removes the easy way in, but it does not make the value trusted — it lives in
 * a database column that a SQL injection, a restored backup, a mistaken import
 * or a future endpoint could all write to. Content out of storage is input.
 *
 * So: text goes in as text. Exactly one field is allowed markup, and only the
 * handful of tags it actually uses.
 */

/** The only elements content may bring with it, and only for `RICH_TEXT_KEYS`. */
const ALLOWED_TAGS = new Set(["BR", "EM", "STRONG", "B", "I"]);

/** Dropped whole, children and all — their text content *is* the payload. */
const DROP_ENTIRELY = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED", "LINK", "META",
]);

/**
 * The `[data-i18n]` keys whose value may contain markup.
 *
 * One entry, and it should stay that way: the headline is written as
 * `تدرب بقوة<br /><em>تدرب بذكاء</em>`, so stripping its tags would collapse it
 * onto one line and lose the emphasis. Every other field is a sentence.
 */
export const RICH_TEXT_KEYS = new Set(["hero_title"]);

/**
 * Rebuilds `value` out of allowed elements and text, and nothing else.
 *
 * Parsed with DOMParser, which produces an inert document: nothing in it loads,
 * and no handler in it fires — so `<img src=x onerror=alert(1)>` is only ever an
 * element to be examined and discarded. Elements are never moved across;
 * allowed ones are recreated from scratch, which drops every attribute with
 * them, event handlers included.
 */
export function setRichText(el: Element, value: string): void {
  const parsed = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  el.replaceChildren(sanitizeChildren(parsed.body));
}

function sanitizeChildren(source: Node): DocumentFragment {
  const fragment = document.createDocumentFragment();

  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      fragment.appendChild(document.createTextNode(node.nodeValue ?? ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (DROP_ENTIRELY.has(element.tagName)) return;

    if (ALLOWED_TAGS.has(element.tagName)) {
      /* Created fresh, so no attribute survives — not `onerror`, not `style`,
         not `href`. Only the tag name and what is inside it. */
      const clean = document.createElement(element.tagName.toLowerCase());
      clean.appendChild(sanitizeChildren(element));
      fragment.appendChild(clean);
      return;
    }

    /* An element nobody allowed: keep what it said, lose the element itself. */
    fragment.appendChild(sanitizeChildren(element));
  });

  return fragment;
}

/** Plain text, always — the safe default for the other forty-odd fields. */
export function setText(el: Element, value: string): void {
  el.textContent = value;
}

/**
 * A stored address, if it is one this page should follow.
 *
 * `http(s)` and same-origin relative paths only. It exists because these values
 * are interpolated into a CSS `url(...)`, where a quote and a closing paren turn
 * a background image into arbitrary rules on the page, and because `javascript:`
 * has no business in any of them. Returns null for anything else, and the caller
 * leaves whatever was already there.
 */
export function safeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  /* Quotes, parentheses, backslash and whitespace would each break out of
     `url('...')`. Hyphens and percent-escapes are ordinary in these addresses —
     the bucket holds percent-encoded Arabic filenames — so they stay allowed. */
  if (/["'()\\\s]/.test(trimmed)) return null;

  /* Control characters, written as codes rather than as a literal range so no
     raw control byte ends up in this file. */
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed.charCodeAt(i) < 0x20 || trimmed.charCodeAt(i) === 0x7f) return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  try {
    /* The base is only consulted for a relative input, and those returned on the
       line above — so it needs to be a valid absolute URL and nothing more. It
       used to be `window.location.origin`, which made this function return null
       for every address during server rendering: the landing page is a client
       component, and a client component still renders once on the server. The
       hero background would have been absent from the server's HTML and appeared
       on hydration. */
    const parsed = new URL(trimmed, "https://placeholder.invalid");
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}
