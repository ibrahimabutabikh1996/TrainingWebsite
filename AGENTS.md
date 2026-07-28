<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global Design System (Apply to All Future Website Projects)

Use this design system consistently across every website, landing page, dashboard, authentication page, admin panel, e-commerce website, portfolio, and future project unless I explicitly request otherwise.

---

# Color System

## Dark Theme

### Primary Colors

* Primary Gold: `#C9A84C`
* Gold Hover: `#E8C96A`
* Gold Transparent: `rgba(201,168,76,0.18)`

### Backgrounds

* Background 1: `#080808`
* Background 2: `#0F0F0F`
* Background 3: `#141414`
* Background 4: `#1A1A1A`

### Typography Colors

* Primary Text: `#F0EDE8`
* Secondary Text: `#9A9490`
* Muted Text: `#6B6560`

### Borders

* Default Border: `rgba(255,255,255,0.06)`
* Gold Border: `rgba(201,168,76,0.30)`

---

## Light Theme

### Primary Colors

* Primary Gold: `#96701A`
* Gold Hover: `#B38B30`

### Backgrounds

* Background 1: `#FCFCFC`
* Background 2: `#FFFFFF`
* Background 3: `#F5F2ED`
* Background 4: `#EBE8E1`

### Typography Colors

* Primary Text: `#050505`
* Secondary Text: `#2E2C2A`
* Muted Text: `#524F4B`

### Borders

* Default Border: `rgba(0,0,0,0.12)`
* Gold Border: `rgba(150,112,26,0.35)`

---

# Global Hover System

Every interactive element must include hover, focus, and active states.

### Navigation

* Default: Secondary Text
* Hover: Primary Text
* Active: Primary Gold
* Include a smooth underline or accent animation.

### Primary Buttons

* Background: Primary Gold
* Hover: Gold Hover
* Text: `#080808`
* Add a subtle gold shadow and slight upward movement.

### Secondary Buttons

* Transparent background.
* Gold border.
* Gold text.
* Hover with Gold Hover background and dark text.

### Cards

* Default: Background 2
* Hover: Background 3
* Border becomes Primary Gold.
* Add a soft premium gold glow.

### Forms

* Focus background: Background 4
* Focus border: Gold Border
* Icons change to Primary Gold.

### Social Buttons

* Default: Background 3
* Hover: Background 4
* Border becomes Gold Border.
* Text becomes Primary Text.

---

# Typography System

## English

### Primary UI Font

**DM Sans**

Use for:
* Body text
* Paragraphs
* Navigation
* Buttons
* Forms
* Cards
* Tables
* Footer
* Labels
* UI components

This is the default font across the English interface.

---

### Display Font

**Bebas Neue**

Use only for:
* Hero titles
* Section headings
* Page titles
* Statistics
* Pricing
* Large numbers
* Logo text
* Promotional headings

---

### Editorial Font

**DM Serif Display**

Use only for:
* Quotes
* Testimonials
* Featured statements
* Editorial highlights

Never use this font for UI elements or long paragraphs.

---

# Arabic Typography

Whenever the website language is Arabic (`lang="ar"`):

Use **Amiri** as the default font across the entire Arabic interface.

Apply it to:
* Hero titles
* Section headings
* Paragraphs
* Navigation
* Buttons
* Forms
* Cards
* Tables
* Footer
* All UI components

---

# Language Rules

## English

* Direction: LTR
* Language: `lang="en"`
* Use DM Sans for interface text.
* Use Bebas Neue for display headings.
* Use DM Serif Display only for quotes and editorial content.

---

## Arabic

* Direction: RTL
* Language: `lang="ar"`
* Automatically switch the entire layout to RTL.
* Automatically use Amiri for all Arabic content.
* Right-align text by default.
* Adjust spacing and line height for comfortable Arabic reading.
* Preserve the same typography hierarchy as the English version.

---

# Design Principles

* Always support both Dark Mode and Light Mode.
* Use CSS variables (design tokens) instead of hardcoded values.
* Every interactive element must include hover, focus, and active states.
* Gold is an accent color only; never use it as a page background.
* Keep the design modern, premium, elegant, and minimal.
* Maintain consistent spacing, typography, border radius, shadows, and animations.
* Ensure accessibility with sufficient color contrast in both themes.
* Design must be fully responsive across desktop, tablet, and mobile devices.
* Every new page, section, or component must automatically inherit this design system unless I explicitly request otherwise.
