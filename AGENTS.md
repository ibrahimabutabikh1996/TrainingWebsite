<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global Design System

Use this design system consistently across every page, section, and component — landing, authentication, trainee dashboard, coach admin panel — and in future projects, unless I explicitly request otherwise.

**The tokens in `src/app/globals.css` are the source of truth.** Everything below documents what is defined there. If the two ever disagree, the stylesheet is right and this file needs updating.

---

# Theming

Both themes are always supported. The active one is set by a `data-theme` attribute on `<html>` (`"light"` or `"dark"`), managed by `src/contexts/ThemeContext.tsx`:

* First visit follows `prefers-color-scheme`.
* The user's choice is saved to `localStorage` under `theme` and wins afterwards.
* `useTheme()` exposes `theme` and `toggleTheme()`.

Never read the theme in CSS any other way, and never hardcode a colour that only works in one theme. Every colour comes from a token so both themes resolve correctly.

---

# Color System

Monochromatic blue. Blue is the accent — never a page background.

## Dark Theme

### Primary

* Primary: `#60A5FA` (`--primary`, `--primary-rgb: 96, 165, 250`)
* Hover: `#3B82F6` (`--primary-hover`)
* Light: `#93C5FD` (`--primary-light`)
* Active: `#2563EB` (`--primary-active`)
* Dim (tint fill): `rgba(96, 165, 250, 0.18)` (`--primary-dim`)
* **As text/icon**: `--primary-on-tint` — aliases `--primary` here

### Backgrounds

Ascending lightness — keeps elevated surfaces distinct from the page.

* `--bg`: `#0A121A`
* `--bg2`: `#15212E`
* `--bg3`: `#243342`
* `--bg4`: `#3E5265`

### Text

* `--text`: `#F8FAFC`
* `--text-secondary`: `#CBD5E1`
* `--text-muted`: `#94A3B8`
* `--text-inverse`: `#0F172A` — text on a `--primary` fill

### Borders

* `--border`: `#243342`
* `--border-strong`: `#3E5265`
* `--border-primary`: `rgba(96, 165, 250, 0.30)`

### Elevation

* `--elev-1`: `0 1px 2px rgba(2, 6, 23, 0.40)`
* `--elev-2`: `0 2px 8px rgba(2, 6, 23, 0.36)`
* `--elev-3`: `0 12px 32px rgba(2, 6, 23, 0.48)`

---

## Light Theme

### Primary

* Primary: `#2563EB` (`--primary-rgb: 37, 99, 235`)
* Hover: `#1D4ED8`
* Light: `#3B82F6`
* Active: `#1E40AF`
* Dim: `rgba(37, 99, 235, 0.10)`
* **As text/icon**: `--primary-on-tint` = `--primary-active` `#1E40AF`

### Backgrounds

* `--bg`: `#F8FAFC`
* `--bg2`: `#D9EAFD`
* `--bg3`: `#BCCCDC`
* `--bg4`: `#9AA6B2`

### Text

* `--text`: `#0F172A`
* `--text-secondary`: `#475569`
* `--text-muted`: `#5B6779`
* `--text-inverse`: `#FFFFFF`

### Borders

* `--border`: `#BCCCDC`
* `--border-strong`: `#9AA6B2`
* `--border-primary`: `rgba(37, 99, 235, 0.35)`

### Elevation

* `--elev-1`: `0 1px 2px rgba(15, 23, 42, 0.05)`
* `--elev-2`: `0 2px 8px rgba(15, 23, 42, 0.06)`
* `--elev-3`: `0 12px 32px rgba(15, 23, 42, 0.10)`

---

## Status Colors

Each status has a **fill** and a **foreground**. Never use the fill as text.

| Fill      | Dark      | Light     | Foreground        | Dark          | Light     |
| --------- | --------- | --------- | ----------------- | ------------- | --------- |
| `--success` | `#22C55E` | `#16A34A` | `--success-text` | = `--success` | `#14532D` |
| `--warning` | `#FBBF24` | `#F59E0B` | `--warning-text` | = `--warning` | `#78350F` |
| `--error`   | `#F87171` | `#DC2626` | `--error-text`   | = `--error`   | `#991B1B` |
| `--info`    | `#60A5FA` | `#2563EB` | —                 |               |           |

The light foregrounds are calibrated against **`--bg3`**, not `--bg2`. A shade that
clears AA on a card still lands at 3.9–4.3:1 on the tinted rows and tiles inside
that card, and those are exactly where status text appears.

A status **fill** is sized for badges, dots and edges — not for carrying text. In
the light theme `--success` under white text is only 3.3:1, so a filled button in
a status colour uses the `-text` token as its fill and `--text-inverse` on top.

Tinted status backgrounds: `--success-bg`, `--error-bg`.

## Training-Day Palette

The one categorical set in the system: `--day-1` … `--day-8`, each with a
`--day-n-text` partner. Used to give every day of a training cycle its own
identity (day buttons, session headers, accent edges, confetti).

Same contract as the status colours — `--day-n` is a fill and always carries
`--text-inverse`; `--day-n-text` is the only one allowed to be text or an icon.
Dark uses the 400 level for both roles; light uses 700 for fills and 800/900 for
foregrounds.

`WorkoutPlan` remaps the brand tokens to the active day inside the session
subtree (`--primary`, `--primary-on-tint`, `--primary-dim`, `--border-primary`),
so ordinary token-driven components pick up the day's hue with no extra work.
**Remap the foreground with the fill** — leaving `--primary-on-tint` behind makes
half the subtree blue while the other half turns the day's colour.

## Surface Utilities

* `--nav-bg-glass` — translucent fill for sticky bars and glass panels (pair with `backdrop-filter: blur(...)`)
* `--nav-bg`, `--nav-bg-scrolled` — opaque nav fills
* `--overlay-scrim` — modal and drawer backdrops
* `--watermark` — oversized decorative background lettering
* Legacy aliases kept for older components: `--muted` (= `--text-muted`), `--muted2` (= `--text-secondary`), `--card-bg`, `--card-border`, `--card-shadow`, `--input-bg`, `--input-border`, `--input-focus`, `--text-main`. Prefer the primary names in new code.

---

# Design Tokens

## Spacing — 4px base

`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64 · `--space-20` 80

Paddings and gaps pick from this scale only.

## Radius

The bigger the surface, the softer the corner.

| Token             | Value   | Use                                        |
| ----------------- | ------- | ------------------------------------------ |
| `--radius-xs`     | `6px`   | tags, chips, badges, inline markers        |
| `--radius-sm`     | `8px`   | icon buttons, small tiles                  |
| `--radius-md`     | `10px`  | inputs, buttons, tabs, nav items           |
| `--radius-lg`     | `14px`  | cards, panels, sections, tables            |
| `--radius-xl`     | `18px`  | modals, drawers, hero surfaces             |
| `--radius-pill`   | `999px` | pill badges — a shape, not a scale step    |
| `--radius-circle` | `50%`   | avatars, round icon buttons, dots          |

The admin area aliases these: `--admin-radius-lg` → `lg`, `--admin-radius` → `md`, `--admin-radius-sm` → `sm`.

## Elevation

Flat by default. A shadow means "this surface floats above that one" — never decoration, and **never tinted with the brand colour**.

* `--elev-0` — none
* `--elev-1` — resting cards, inputs, tables
* `--elev-2` — raised or hovered surfaces, sticky bars
* `--elev-3` — true overlays: modals, drawers, popovers

## Motion

* Durations: `--dur-fast` 120ms · `--dur` 180ms · `--dur-slow` 280ms
* `--ease: cubic-bezier(0.2, 0, 0, 1)` — state changes that should feel instant
* `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` — anything that travels (entrances, drawers, progress bars)

`@media (prefers-reduced-motion: reduce)` in `globals.css` collapses all animation and transition durations globally. Anything that hides content until an animation runs must define a reduced-motion fallback (see `.reveal` in `landing.css`).

## Type Scale

rem-based, so it honours the user's browser text size.

| Token          | Size | Use                                  |
| -------------- | ---- | ------------------------------------ |
| `--text-2xs`   | 11px | eyebrows, uppercase micro-labels     |
| `--text-xs`    | 12px | captions, meta, badges               |
| `--text-sm`    | 13px | secondary body, dense table text     |
| `--text-base`  | 15px | default body                         |
| `--text-md`    | 16px | emphasised body, input text          |
| `--text-lg`    | 18px | card titles                          |
| `--text-xl`    | 22px | section titles, panel headers        |
| `--text-2xl`   | 28px | page titles                          |
| `--text-3xl`   | 36px | display                              |

**11px is the floor for readable text.** Anything smaller is a decorative glyph, not copy.

Line height: `--leading-tight` 1.25 · `--leading-snug` 1.45 · `--leading-normal` 1.65 · `--leading-relaxed` 1.8 (Arabic body copy).

Weights: `--weight-normal` 400 · `--weight-medium` 500 · `--weight-semibold` 600 · `--weight-bold` 700. Nothing above 700.

Headings larger than `--text-3xl` (landing hero, section titles, big statistics) use `clamp()` and sit outside the scale on purpose.

## Focus

`--focus-ring: 0 0 0 3px rgba(var(--primary-rgb), 0.28)` — one definition, used by every interactive element.

`globals.css` also sets a zero-specificity `:focus-visible` outline on all interactive elements, so a component that defines nothing still gets a visible ring.

---

# Typography

Two variable fonts ship in `public/fonts`, self-hosted via `@font-face` in `globals.css`. There is no third font.

* **Baloo 2** — `--font-primary`, `--font-display`, `--font-editorial`. Weights 100–900.
* **Cairo** — `--font-arabic` / `--font-ar`. Weights 200–1000.

Because the interface is Arabic, `:root:lang(ar)` remaps all three Latin variables to Cairo, and a `:lang(ar) *:not(.app-icon)` rule forces the Arabic face, zeroes letter-spacing, and enables tabular lining numerals. In practice **Cairo is what renders**; the display/editorial variables exist so an LTR build can differentiate later.

Never hardcode a font stack. Use `var(--font-primary)` / `var(--font-display)`, or `font-family: inherit` inside a component.

---

# Language & Direction

The root layout is `<html lang="ar" dir="rtl">`. Arabic RTL is the only mode currently built.

* Use **logical properties** everywhere: `inset-inline-start/end`, `padding-inline`, `margin-inline`, `border-inline-start`, `text-align: start/end`. Never `left`/`right`/`padding-left` for layout that should mirror.
* Arabic needs more vertical room than Latin at the same nominal size — use `--leading-relaxed` for body copy.
* Right-align text by default; keep the same typographic hierarchy an LTR build would have.
* Phone numbers, emails and other Latin runs inside Arabic copy need `dir="ltr"` on their element.

---

# Interaction System

Every interactive element needs hover, focus and active states. Keep them restrained: **one signal per state change**, not three.

### Navigation links

Default `--text-secondary` → hover `--text` → active `--primary`, with an underline or edge marker. Active markers use `inset-inline-end`, not `right`.

### Primary buttons

Fill `--primary`, text `--text-inverse`, radius `--radius-md`, weight `--weight-semibold`. Hover swaps to `--primary-hover`. **No shadow** — the fill already carries the emphasis. `:active` may sink 1px.

### Secondary / ghost buttons

Transparent or `--primary-dim` background, `--border-primary` border, `--primary` text. Hover deepens the border and fill.

### Icon buttons

34×34, `--radius-sm`, 18px glyph. Two variants: **ghost** (transparent fill and border, `--text-muted`) for actions inside a card or row, and **outlined** (`--bg3` fill, `--border-strong` border, `--text-secondary`) for standalone controls. Both tint to `--primary` on hover; a destructive one tints to `--error-text` over `--error-bg`.

### Cards and panels

`--bg2` or `--nav-bg-glass`, 1px `--border`, `--radius-lg`, `--elev-1`, padding `--space-6`. A **container** reacts at its edge only (`--border-strong` + `--elev-2`) — it must not lift, or hovering a wide dashboard makes the page twitch. A **clickable** card may add `translateY(-2px)`.

### Inputs

`--input-bg` fill, `--border` border, `--radius-md`, `--text-md` text. Focus: `--primary` border plus `--focus-ring`. Leading icons shift to `--primary` on focus.

### Segmented controls and tabs

Container at `--radius-lg` with `--space-1` padding; segments at `--radius-md`. Only the selected segment gets a fill, so the row reads as one control.

### Tables

Bordered wrapper (`--radius-lg`, `--elev-1`, `overflow: hidden`), `--bg3` header row, `--text-xs` `--text-secondary` headers (`--text-muted` cannot reach AA on `--bg3` in the light theme), hairline `--border` row separators, `--bg3` row hover, `--space-3 --space-4` cell padding. See `.co-minimal-table`, `.wl-exercise-table`, `.dpv-min-table` — all three follow this.

### Modals and drawers

`--overlay-scrim` backdrop with a light `blur(3–4px)`, `--bg2` surface, `--radius-xl`, `--elev-3`, `--border` border. Header and footer separated by hairline `--border` rules. See `AdminModal.tsx`, `.cms-modal-card`, `.dplan-picker`.

---

# Design Principles

* **Minimal and flat.** Clean surfaces, generous whitespace, no ornament that does not carry meaning.
* **Tokens, not literals.** No hex colours, raw px radii, or ad-hoc shadows in component stylesheets.
* **No brand-tinted shadows.** Glows are the fastest way to make a modern UI look dated.
* **No `transition: all`.** Name the properties; `all` animates layout and makes hovers feel heavy.
* **No `!important` for styling.** It is only acceptable to defeat a third-party or inline style you cannot reach. If you reach for it to win a specificity fight, fix the selector instead.
* **Restrained micro-interactions.** Hover lifts stay at 2–3px; scale stays under 1.06. Prefer a colour or border change over movement, especially for items in a list.
* **Accessible contrast in both themes** (AA: 4.5:1 for body text, 3:1 for large), and a visible focus ring on everything focusable. The light theme is the one that catches people out — its `--bg2`/`--bg3` are saturated pale blues, not white, so a colour that passes on `--bg` can still fail on a card. Brand and status colours therefore split into a fill and a foreground: use `--primary-on-tint`, `--success-text`, `--warning-text`, `--error-text` for text and icons, and `--primary`/`--success`/`--warning`/`--error` only as fills.
* **Responsive across desktop, tablet and mobile.** Two traps this codebase has already hit: responsive overrides must match the base rule's specificity (a bare `nav { }` will not beat `.landing-wrapper nav { }`), and grid/flex items need `min-width: 0` or their min-content width becomes a floor that overflows the container.
* **Don't rely on `:hover` alone to reveal a control.** Touch devices never fire it. Pair it with a `@media (hover: none)` rule that shows the control outright.
* **Every new page or component inherits this system automatically** unless I explicitly request otherwise.
