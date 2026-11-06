<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global Design System

Use this design system consistently across every page, section, and component — landing, authentication, trainee dashboard, coach admin panel — and in future projects, unless I explicitly request otherwise.

**The tokens in `src/app/globals.css` are the source of truth.** Everything below documents what is defined there. If the two ever disagree, the stylesheet is right and this file needs updating.

---

# Theming

**The site is dark-only.** There is one palette, defined on bare `:root` in
`globals.css`. There is no `data-theme` attribute, no `prefers-color-scheme`
query, and no theme context — `src/contexts/` does not exist.

This file used to describe a two-theme system managed by
`src/contexts/ThemeContext.tsx`, with a full light palette and a `useTheme()`
hook. None of it is in the codebase. It is recorded here because the shape of the
tokens still carries its fingerprints, and they are worth reading correctly
rather than mistaking for dead weight:

* `--primary-on-tint`, `--success-text`, `--warning-text`, `--error-text` are
  each an **alias of the matching fill**. They were the light theme's darker
  foregrounds. Keep using them for text and icons — the distinction between a
  fill and a foreground is real and the stylesheets are written against it, so
  reintroducing a second palette stays a change to `globals.css` alone.
* The `--muted`, `--muted2`, `--card-bg`, `--input-bg`, `--text-main` family are
  legacy aliases for older components. Prefer the primary names in new code.

Still true, and the reason all of this stays token-driven: **never hardcode a
colour.** A literal in a component is a colour that cannot be changed from one
place, which is what put ~90 hex values into the interface files.

---

# Color System

Monochromatic blue. Blue is the accent — never a page background.

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

* `--border`: `#162235`
* `--border-strong`: `#22334D`
* `--border-primary`: `rgba(96, 165, 250, 0.30)`

### Elevation

* `--elev-1`: `0 1px 2px rgba(2, 6, 23, 0.40)`
* `--elev-2` (= `--shadow-soft`): `--glass-highlight`, `0 10px 40px -12px rgba(2, 6, 23, 0.55)`
* `--elev-3`: `--glass-highlight`, `0 24px 64px -16px rgba(2, 6, 23, 0.65)`
* `--glass-highlight`: `inset 0 1px 0 rgba(248, 250, 252, 0.08)` — the light on a pane's top edge

### Glass surfaces

The whole product is glassmorphism. Cards, panels, bars and fields are glass: the page text colour (`--text-rgb`) at a low alpha over the ambient light, with `backdrop-filter: var(--glass-blur)` (`blur(20px) saturate(160%)`, lighter under 640px).

* `--glass`: 5.5% — card and panel fill
* `--glass-2`: 9% — hover, secondary fills, empty tracks
* `--glass-border`: 10% — the card edge
* `--glass-border-strong`: 18% — inputs, selected or hovered edges
* `--input-bg`: 6% — fields are glass too
* `--glass-solid` + `--glass-solid-blur`: `--bg2` at 78% under a 28px frost — dialogs, dropdowns, the upload window and the promo popup, where text sits over busy content
* `--primary-soft`: `--primary` at 14% — icon tiles, the selected nav item, tinted eyebrows
* `--page-glow`: two soft pools of brand blue in the top corners, painted on `body` (and on `.admin-layout-wrapper::before`) over `--bg`

### The interaction layer

The end of `globals.css` holds everything that makes the glass respond, and `src/components/GlassPointer.tsx` (mounted once in the root layout) drives the pointer half of it:

* **Ambient light** — `.ambient`, three slow-drifting radial pools of `--primary`, `--primary-light` and `--primary-active` fixed behind the page. Glass needs colour behind it to read as glass; a full-page wrapper must stay transparent or it hides them.
* **Spotlight** — on the cards in GlassPointer's `GLOW` list (mirrored in the CSS) a light follows the cursor, via `--mx`/`--my` and `data-glow`. Only cards whose background is a plain fill: it is a `background-image`.
* **Cards never move.** No lift, tilt or travel on hover or on arrival; a card answers at its edge, its shadow and the spotlight only. On the landing page cards fade in without moving.
* **Button motion** — every button in the shared list rises 2px on hover, its icon leans 3px the reading way, a press sinks it to `scale: 0.96` and springs back (`--ease-spring`), and a press sends a ripple from the exact point (`::before`, driven by GlassPointer's `RIPPLE` list via `--bx`/`--by` and `is-rippling`; it works on touch). These use the independent `translate`/`scale` properties so they compose with a button's own `transform`. A button in the list must not use its own `::before`.
* **Shine** — a band of light crosses each primary button once on hover (`::after`, so a button in that list must not use its own `::after`).

The spotlight is mouse only; everything is off under reduced motion. Add a new card to both `GLOW` lists, and a new button to both button lists, to give it the effect.

---

## Plan Accents

One colour per membership tier: `--plan-1` `#820911`, `--plan-2` `#FFD700`,
`--plan-3` `#370F75`, each with an `-rgb` companion and a `--plan-n-text`
foreground for labels laid on the fill.

The landing page remaps `--primary` to the tier's colour inside each plan card,
and the CRM tints its plan tags with them. **They must always stay defined:**
`--primary: var(--plan-1)` with `--plan-1` missing makes `--primary` itself
resolve to nothing, which silently strips the brand colour and the border from
everything inside the card.

## Status Colors

Each status has a **fill** and a **foreground**. Never use the fill as text.

| Fill        | Value     | Foreground       | Value         |
| ----------- | --------- | ---------------- | ------------- |
| `--success` | `#22C55E` | `--success-text` | = `--success` |
| `--warning` | `#FBBF24` | `--warning-text` | = `--warning` |
| `--error`   | `#F87171` | `--error-text`   | = `--error`   |
| `--info`    | `#60A5FA` | —                |               |

The foregrounds alias the fills, because these are already light shapes on a
near-black page. Keep using the `-text` names for text and icons anyway — see
the note under **Theming** for why the distinction is worth preserving even
while the two resolve the same.

Tinted status backgrounds: `--success-bg`, `--error-bg`.

## Food-Category Palette

One colour per nutrition-library category, so a food's category reads at a
glance in the diet library and the plan builder. Like the training-day
palette, a deliberate exception to the monochromatic-blue rule.

| Category            | Token             | Value     |
| ------------------- | ----------------- | --------- |
| مصادر البروتين      | `--food-protein`  | `#F472B6` |
| مصادر الكاربوهيدرات | `--food-carbs`    | `#FBBF24` |
| مصادر الدهون الصحية | `--food-fats`     | `#A78BFA` |
| الخضراوات           | `--food-veggies`  | `#4ADE80` |
| الفواكه             | `--food-fruit`    | `#FB923C` |

`getCategoryBadge` in `src/types/diet.ts` maps a category to its token (any
other category gets `--primary`). The component sets it on the card or row as
`--cat-color`; the stylesheets read `var(--cat-color, var(--primary))` and mix
it into the surface with `color-mix()` — a light gradient from the right, no
border. Protein is pink, not red, so it never reads as the delete button.

## Training-Day Palette

Eight colours giving every day of a training cycle its own identity — day
buttons, session headers, accent edges.

They are **not tokens**. They are a literal array, `DAY_ACCENT_COLORS` in
`src/components/dashboard/WorkoutPlan.tsx`, indexed by day number and wrapping
after eight:

`#E8C96A` gold · `#F97316` orange · `#10B981` emerald · `#A855F7` purple ·
`#EF4444` crimson · `#EC4899` magenta · `#14B8A6` teal · `#8B5CF6` violet

`WorkoutPlan` sets the chosen one as a single custom property, `--day-accent`,
on the element itself; `workout-log.css` reads it through
`var(--day-accent, var(--primary))` and mixes it with `color-mix()` for the
tinted background and border. Nothing else in the system is remapped — the rest
of the subtree stays brand blue.

This is the one place the codebase keeps colour outside `globals.css`. If it
moves, it should move as `--day-1` … `--day-8` on `:root` with the component
selecting rather than defining. Until then, do not add a ninth colour anywhere
else and expect it to participate.

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
| `--radius-md`     | `12px`  | inputs, buttons, tabs, nav items           |
| `--radius-lg`     | `16px`  | cards, panels, sections, tables            |
| `--radius-xl`     | `24px`  | modals, drawers, hero surfaces             |
| `--radius-2xl`    | `32px`  | large showcase panels, the coach's photos  |
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
* `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` — anything that travels (entrances, drawers, progress bars)

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

`--focus-ring: 0 0 0 3px rgba(var(--primary-rgb), 0.40)` — one definition, used by every interactive element.

`globals.css` also sets a zero-specificity `:focus-visible` outline on all interactive elements, so a component that defines nothing still gets a visible ring.

## Breakpoints

**Four widths. Write new rules at these and nowhere else.**

| Width | Meaning |
| ----- | ------- |
| `480px` | small phone |
| `640px` | phone |
| `768px` | tablet, and the boundary the dashboard and the panel both turn on |
| `1024px` | small laptop |

Pair them as `max-width: 640px` and `min-width: 641px` when a rule needs both sides; that off-by-one pair is deliberate and is not a fifth breakpoint.

The stylesheets currently hold **eighteen** distinct widths, not four: 380, 400, 480, 520, 560, 640, 641, 680, 720, 768, 820, 900, 901, 992, 1000, 1024, 1080, 1180. Two thirds of all rules already sit on 640 and 768; the rest appear once or twice each.

This is not a tidiness complaint. It is the mechanism behind a specific and repeated experience — *"I fixed this and it came back."* A fix written at 640 does not cover a rule someone else wrote at 680, so the same visual fault reappears in the band between them and reads as a regression. It is not a regression; it is a second fault that was never touched, in a band nobody checked.

Migrating an existing rule from an odd width to a scale one **changes where the layout switches**, so it is a visual change and needs looking at, at that width, on that screen. Do it when you are already working in that file and can see the result. Do not sweep them.



---

# Typography

**One variable font, Cairo.** It is self-hosted from `public/fonts/Cairo-Variable.woff2` through the single `@font-face` in `globals.css`, at weights 200–1000. There is no second font.

This section used to describe two: Baloo 2 for Latin and Cairo for Arabic. Baloo is gone. It was 177 KB downloaded to be almost entirely unused, because the `:lang(ar)` rule below overrode it with Cairo on every page the site actually serves.

All five font variables point at Cairo on bare `:root` — `--font-primary`, `--font-display`, `--font-editorial`, `--font-arabic`, `--font-ar`. The five names are kept because the stylesheets are written against them and because an LTR build could differentiate later; today they resolve to one family, so **which one you reach for changes nothing that renders**. `:root:lang(ar)` still remaps the three Latin names to `--font-arabic`, and `:lang(ar) *:not(.app-icon)` still forces the face, zeroes letter-spacing and enables tabular lining numerals. Both are no-ops for the family now and load-bearing for the numerals and spacing.

Never hardcode a font stack. Use `var(--font-primary)` / `var(--font-display)`, or `font-family: inherit` inside a component. **A file sitting in `public/fonts` is not a font you may use** — only a family with an `@font-face` rule is loadable, and naming any other resolves silently to the system face rather than failing. That directory has held unreferenced leftovers before, and pinning a component to one of them is a bug that renders as "this paragraph is in the wrong font" with nothing in the console to say why. Check `globals.css` for the rule before naming a family, not the directory listing.

Three things in the font block exist for WebKit and must not be tidied away:

* **The duplicated `src` entry.** The same file is announced twice, as `woff2-variations` and then as `woff2`. WebKit before Safari 14 will not use a variable font announced as plain `woff2`; nothing else recognises `woff2-variations`. Each engine matches the entry it understands and skips the other.
* **The file name has no comma in it.** It was `Cairo-VariableFont_slnt,wght.woff2`, and a comma inside `url()` is the `src` property's own argument separator. Every engine that parsed it as one token was fine; nothing forces them to.
* **The `slnt` axis is pinned.** `html { font-variation-settings: "slnt" 0 }`, and again as `inherit` on `input, textarea, select, button, optgroup, option` — the browser's `font` shorthand resets the property on form controls, so the pin stops at the edge of every field without it. Cairo's slant axis defaults to 0 and Chrome honours that for `font-style: normal`; WebKit does not, and drew the whole site leaning on iPhone. Measured on the device, not inferred.

Relatedly, `em, i, cite, dfn, address, var` are reset to `font-style: normal`. With Cairo that italic is a real slant rather than the no-op it is in a face with no slanted cut, and these are the tags the coach can introduce from the content manager without touching CSS.

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

### Lit Glass — the one material

Everything interactive or elevated is the same material: **dark glass with a thin edge of light** that runs `--primary` → `--primary-light` → `--primary-active` and fades out along one side, plus a soft inner glow of the same colours. It began as the primary button (the "Lit-edge buttons" block at the end of `globals.css`) and is now the whole interface. The system lives in `src/styles/lit/`, imported by the root layout after `globals.css`:

| File | What it holds |
|---|---|
| `tokens.css` | the registered knobs (`--lit-a`, `--lit-glow`, `--surf-a`, `--surf-angle`), the tone stops (`--danger-*`, `--success-*`, `--warning-*`), control and icon sizes, `.tone-*` |
| `primitives.css` | buttons, tabs/segments, chips, fields, icons, badges, counts |
| `surfaces.css` | cards, windows (modals, drawers, sheets, dropdowns, pickers), scrims, tables |
| `navigation.css` | the active item in every nav, eyebrows, page headers, dividers, avatars |
| `feedback.css` | spinners, progress, skeletons, empty states, alerts, toasts |

`/admin/design` (owner only) shows every component at every level. Look there before building a screen; check it after changing `src/styles/lit/`.

**Levels.** What changes between elements is only how much light they carry:

1. **Lit** — full edge and glow; the edge turns and a light follows the cursor on hover. The main action, the selected tab, the active nav item, the open window, featured cards. **One per section.**
2. **Edged** — the same edge at ~40%, no glow; full light on hover. Secondary actions, ordinary tables.
3. **Quiet** — plain glass; the edge appears on hover or focus. Icon buttons, row actions, chips, filters.

**Tones** are four custom properties on the element (`--primary`, `--primary-rgb`, `--primary-light`, `--primary-active`) — every gradient reads them where it paints, so a tone never restates a style. Use `.tone-danger` / `.tone-success` / `.tone-warning` (or `.ui-btn--danger` etc.). A token derived on `:root` from `--primary-rgb` (`--primary-soft`, `--primary-dim`) is resolved once and stays blue inside a tone — inside a toned element write `rgba(var(--primary-rgb), …)` instead.

**How it is applied.** Controls (buttons, the selected tab, a focused field) carry the light in their own `background`: a cursor-light layer and the dark fill on `padding-box`, the conic edge on `border-box` through a transparent `--lit-w` border. Surfaces keep their own fill, so their light is a `::before` ring masked to the border band — **a surface in the lists must not use its own `::before`**. Existing classes are mapped to a level by selector list, so most screens needed no JSX change; new markup uses the `ui-*` classes directly:

* buttons — `.ui-btn` + `--primary | --secondary | --ghost | --icon`, `--sm | --lg`, `--block`, `--danger | --success | --warning`
* tabs — `.ui-segment` (the recessed track) with `.ui-tab[aria-selected]`; chips — `.ui-chip.is-active`
* fields — `.ui-field`, `.ui-field-label`, `.ui-field-control`, `.ui-field-hint`
* icons — `.ui-icon-tile` (`--sm | --lg | --lit`); badges — `.ui-badge`; counts — `.ui-count`; `.ui-avatar`
* surfaces — `.ui-card` (`--featured`), `.ui-window` with `-head | -title | -body | -foot`, `.ui-scrim`
* tables — `.ui-table-wrap` > `.ui-table` (`.is-num` cells, `tr.is-selected`); add `.ui-table--stack` with `data-label` on each `td` to turn rows into cards on a phone
* states — `.ui-empty` (+ `-title`, `-text`), `.ui-alert` (`--success | --warning | --danger`), `.ui-spinner`, `.ui-skeleton`, `.ui-progress` > `.ui-progress-fill`
* page — `.ui-page-head` (+ `-text`, `.ui-page-title`, `.ui-page-sub`, `.ui-page-actions`), `.ui-eyebrow`, `.ui-section`, `.ui-divider`

**Specificity.** Every rule in `src/styles/lit/` sits at `html:root:root:root:root:root :where(…)`: a fixed floor above each component's own selectors (some are three classes plus `:hover:not()`), with the lists themselves at zero so the last rule written wins. An inline `style` still wins over all of it — keep that for deliberate one-offs.

**Adding a component.** A new class that should be a level-N button goes into that level's lists in `primitives.css` (the recipe list, the shape list, the level list, hover, active, focus, disabled) and into GlassPointer's `LIT` list; a new card into the surface lists in `surfaces.css` and GlassPointer's `GLOW` list. Or just use the `ui-*` class.

**Toasts** go through `src/components/ui/AppToaster.tsx` — mount it instead of `<Toaster>`; the look is `.lit-toast`.

**Icons** all share one line weight, `--icon-stroke` (1.75), set on `svg.lucide` and `svg.app-icon`, and three sizes (`--icon-sm | md | lg`). Prefer `<Icon name>` from `src/components/Icon.tsx`.

**Motion.** The edge turns over `--lit-turn` (1.8s) on hover; windows and featured cards keep a still light. Under reduced motion the edge does not turn and skeletons do not sweep.

### Tables

A glass wrapper with a faint edge, `--text-xs` `--text-secondary` headers over a line of light, hairline row separators, a soft `--primary` wash on row hover with an edge of light on the reading side (the right), tabular numbers, `--space-3 --space-4` cell padding.

### Modals and drawers

The scrim is darker and blurred; the window is `--radius-xl` glass with its light at the top (still, not turning), `--elev-3`, and a line of light under the header instead of a flat rule. See `AdminModal.tsx`, `.cms-modal-card`, `.ui-window`.

---

# Design Principles

* **Minimal and flat.** Clean surfaces, generous whitespace, no ornament that does not carry meaning.
* **Tokens, not literals.** No hex colours, raw px radii, or ad-hoc shadows in component stylesheets.
* **Light is the system's, not the component's.** The only glows are the lit edge and its inner glow, at the levels above. Don't add a free-standing brand-coloured shadow to a component — give it a level instead.
* **No `transition: all`.** Name the properties; `all` animates layout and makes hovers feel heavy.
* **No `!important` for styling.** It is only acceptable to defeat a third-party or inline style you cannot reach. If you reach for it to win a specificity fight, fix the selector instead.
* **Restrained micro-interactions.** Hover lifts stay at 2–3px; scale stays under 1.06. Prefer a colour or border change over movement, especially for items in a list.
* **Accessible contrast** (AA: 4.5:1 for body text, 3:1 for large), and a visible focus ring on everything focusable. The trap on a near-black page is the ascending background scale: `--bg3` and `--bg4` are considerably lighter than `--bg`, so `--text-muted` that reads well on the page can fall under AA on a tinted row or a table header — which is why the table contract below specifies `--text-secondary` for headers. Brand and status colours split into a fill and a foreground: use `--primary-on-tint`, `--success-text`, `--warning-text`, `--error-text` for text and icons, and `--primary`/`--success`/`--warning`/`--error` only as fills.
* **Responsive across desktop, tablet and mobile.** Two traps this codebase has already hit: responsive overrides must match the base rule's specificity (a bare `nav { }` will not beat `.landing-wrapper nav { }`), and grid/flex items need `min-width: 0` or their min-content width becomes a floor that overflows the container.
* **Don't rely on `:hover` alone to reveal a control.** Touch devices never fire it. Pair it with a `@media (hover: none)` rule that shows the control outright.
* **Every new page or component inherits this system automatically** unless I explicitly request otherwise.
