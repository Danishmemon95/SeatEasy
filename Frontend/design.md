# SeatEasy — Design System

- **Version:** 1.0
- **Status:** Foundation — pre-implementation
- **Product:** Ticket booking platform (movies, live events, sports)
- **Stack:** React + Redux, Node, Postgres

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Brand Position](#2-brand-position)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Shape & Elevation](#6-shape--elevation)
7. [Motion](#7-motion)
8. [Iconography & Imagery](#8-iconography--imagery)
9. [Component Specifications](#9-component-specifications)
10. [The Seat Map](#10-the-seat-map)
11. [Surface-Specific Guidance](#11-surface-specific-guidance)
12. [Dark Mode](#12-dark-mode)
13. [Accessibility](#13-accessibility)
14. [Token Reference](#14-token-reference)
15. [Open Decisions](#15-open-decisions)

---

## 1. Design Principles

Four rules that resolve arguments without a meeting.

### 1.1 Content is the color
The interface is near-monochrome warm neutrals. Posters, artwork, and a single accent supply all chroma. UI chrome never competes with content for attention. If a screen feels busy, the fix is removing color, not adding hierarchy.

### 1.2 Space over lines
Separate things with whitespace and typographic hierarchy first. Borders, cards, and dividers are a last resort. This is the single largest difference between "editorial" and "generic dashboard" — most designers reach for a card when they should reach for 48px of margin.

### 1.3 One decision per screen
Every screen in the booking flow asks exactly one question. Pick a city. Pick a showtime. Pick seats. Pay. Never two. This is where the "Easy" in SeatEasy lives, and it is the principle most likely to be violated under feature pressure.

### 1.4 Calm under pressure
Timers, conflicts, sold-out states, and errors get quieter and clearer, not louder and redder. A user who is about to spend money should feel steadied, not rushed. Panic UI is a conversion killer and directly contradicts the brand promise.

Calm is not the same as inert. Every interactive element must respond visibly to hover, focus, and press. An interface that gives no feedback reads as broken, not composed.

---

## 2. Brand Position

- **Name:** SeatEasy
- **Promise:** Booking that feels effortless and considered.
- **Mood:** Premium & editorial.
- **Primary theme:** Light. (Dark supported as an option).

### Competitive positioning

| Competitor | Aesthetic | SeatEasy differs by |
| :--- | :--- | :--- |
| **BookMyShow** | Dense, loud red, ad-heavy | Being calm and uncluttered |
| **Fandango** | Corporate dark blue, utilitarian | Having warmth and craft |
| **Dice** | Bright, energetic, youth-oriented | Being restrained and grown-up |
| **Ticketmaster** | Functional, high-friction | Being pleasant to move through |

> **The bet:** In a category that is uniformly loud, quiet is differentiating. An editorial light interface reads like an arts magazine rather than a transaction terminal, which earns trust at the moment money changes hands.

### What "editorial" means concretely
- Serif display typography paired with a neutral interface sans
- Warm paper-toned backgrounds, not clinical white or grey
- Generous vertical rhythm; content breathes
- Restraint in color — one accent, used sparingly
- Small uppercase letterspaced labels as a recurring motif
- Hairline rules instead of heavy borders and cards
- Photography framed and contained, never bleeding chaotically

### What it does not mean
- Not skeuomorphic or vintage-themed
- Not decorative for its own sake
- Not low-density everywhere — dashboards still need to be efficient
- Not slow; editorial refers to composition, not pace

---

## 3. Color System

### 3.1 Core philosophy
The palette is built on warm paper and warm ink. Pure `#FFFFFF` and pure `#000000` are banned from the product. Every neutral carries a slight warm cast — this is the difference between "printed page" and "default browser."

#### Three rules:
1. **Paper is the page; pure white is elevation.** Cards and modals sit above the ground as white surfaces. This inversion of the usual convention is a primary signature of the system.
2. **Chroma is rationed.** The accent appears at most 2–3 times per screen. If it's everywhere, it means nothing.
3. **Never sample colors from poster artwork into the UI.** Tempting, always muddy across a real catalog.

### 3.2 Neutrals — paper and ink
The spine of the entire product. Roughly 90% of every screen uses only these.

| Token | Hex | Description | Primary use |
| :--- | :--- | :--- | :--- |
| `paper` | `#FBFAF7` | Warm off-white | Page background |
| `paper-raised` | `#FFFFFF` | Pure white | Cards, modals, sheets, popovers |
| `paper-sunken` | `#F4F2ED` | Recessed warm grey | Wells, disabled fields, seat-map canvas, table headers |
| `paper-inverse` | `#1A1815` | Warm near-black | Inverted sections, footers, tooltips |
| `ink` | `#1A1815` | Warm near-black | Headings, primary text |
| `ink-secondary` | `#57534E` | Warm dark grey | Body copy, descriptions |
| `ink-muted` | `#8A8580` | Warm mid grey | Metadata, captions, timestamps |
| `ink-faint` | `#B8B3AC` | Warm light grey | Placeholders, disabled text |
| `ink-inverse` | `#FDFCFB` | Warm white | Text on dark or accent surfaces |
| `rule` | `#E7E3DC` | Warm hairline | Dividers, input borders, image frames |
| `rule-strong` | `#D6D1C8` | Emphasized hairline | Focused inputs, active borders |

#### Contrast verification (on paper `#FBFAF7`):

| Token | Ratio | WCAG |
| :--- | :--- | :--- |
| `ink` | 15.8:1 | AAA |
| `ink-secondary` | 7.4:1 | AAA |
| `ink-muted` | 3.4:1 | AA Large only — never for body text |
| `ink-faint` | 2.0:1 | Decorative / placeholder only |

### 3.3 Brand accent — Oxblood

| Token | Hex | Use |
| :--- | :--- | :--- |
| `accent` | `#6B2737` | Primary buttons, selected seats, active nav, links |
| `accent-hover` | `#571F2C` | Hover state |
| `accent-active` | `#451822` | Pressed state |
| `accent-subtle` | `#F7EDEF` | Selected row backgrounds, tinted badges |
| `accent-border` | `#E3CDD2` | Borders on subtle-accent surfaces |
| `accent-ink` | `#FDFCFB` | Text on accent fill |

**Rationale:** Oxblood sits adjacent to the red the ticketing category expects — so it still reads as "tickets" — but desaturated and darkened into something that feels bound, printed, and expensive. It references theatre curtains, ticket stubs, and letterpress ink. Against warm off-white it is a genuinely hard relationship to get wrong.

- `accent` on `paper` = 9.6:1 (AAA)
- `accent-ink` on `accent` = 9.3:1 (AAA)

#### Approved alternatives if oxblood is rejected
Each has been checked against the same neutral base:

| Alternative | Hex | Character |
| :--- | :--- | :--- |
| **Deep forest** | `#2C4A3B` | Calmer, more editorial, less "ticket" association |
| **Ink navy** | `#1E3A5F` | More trustworthy and corporate, safest at checkout |
| **Burnt amber** | `#8A4B1F` | Warmer and more inviting, slightly less premium |

*Whichever is chosen, only the `accent-*` tokens change. Nothing else in the system moves.*

### 3.4 Semantic colors
Default framework semantics (Tailwind `red-500`, Bootstrap green) will destroy this palette instantly. These are desaturated to sit correctly on warm paper.

| Token | Hex | Subtle variant | Use |
| :--- | :--- | :--- | :--- |
| `success` | `#3F6B4F` | `#EDF3EF` | Booking confirmed, seat available, payment succeeded |
| `warning` | `#8A6A2F` | `#F7F1E6` | Timer under 2 min, low availability, needs attention |
| `danger` | `#8C3A32` | `#F9EDEC` | Errors, cancellation, destructive actions |
| `info` | `#3A5A7A` | `#EDF1F5` | Neutral notices, tips |

> [!CRITICAL]
> **Critical rule:** `danger` (`#8C3A32`) and `accent` (`#6B2737`) are close relatives. They must never appear adjacent or in the same component.
> - The accent never appears inside an error state.
> - Destructive actions never use accent — always danger.
> - A "Cancel booking" button is danger; a "Pay now" button is accent. Never the reverse.

### 3.5 Seat category colors
Gold, platinum, and sofa form a price ladder, not three unrelated categories. Encoding them as three competing hues produces a traffic light. Instead, use a value ramp within one warm hue family — depth increases with price.

| Category | Border | Subtle fill | Position |
| :--- | :--- | :--- | :--- |
| `seat-gold` | `#B08A3E` | `#FAF5EA` | Entry tier — lightest |
| `seat-platinum` | `#8A6E52` | `#F6F1EB` | Mid tier |
| `seat-sofa` | `#5E4636` | `#F2EDE7` | Premium tier — deepest |

This reads as a hierarchy rather than an arbitrary set, survives all common color-vision deficiencies (the ramp remains monotonic in luminance), and stays inside the editorial palette. Category is always reinforced by an always-visible legend with prices — never communicated by color alone.

### 3.6 Handling poster and event artwork
The central visual problem: artwork is loud, saturated, and wildly inconsistent; the layout is quiet and controlled. Four mandatory techniques:

1. **Frame every image:** 1px `rule` border, 6px radius. Makes artwork an object on the page rather than a hole in it.
2. **Enforce aspect ratios:** 2:3 posters, 16:9 event heroes, 1:1 avatars, 3:2 venue photos. `object-fit: cover`, always. Ragged image dimensions are the fastest route to looking amateur.
3. **Warm unifying overlay on large imagery:** 4–8% `paper` blended over hero images pulls disparate artwork toward one temperature. Skip on small thumbnails.
4. **Never extract poster colors into UI:** No dynamic theming from artwork.

---

## 4. Typography

Typography carries more of the "editorial" quality than color does.

### 4.1 Typefaces

- **Display — Fraunces (Google Fonts, variable)**  
  High-contrast serif with optical-size, SOFT, and WONK axes. Characterful without being fussy.

  Fraunces must be tuned. Untuned defaults produce sharp, wedge-like serifs that read hard at mid sizes. Required settings on every display-tier style:

  ```css
  font-variation-settings: 'SOFT' 60, 'WONK' 0, 'opsz' 40;
  font-weight: 400;
  letter-spacing: -0.02em;
  ```

  - `SOFT 60` rounds terminals — the single most important correction
  - `WONK 0` disables the quirky alternate forms
  - `opsz` should track the rendered size (24 for h2, 40 for h1, 48+ for display); the default optical size is wrong at UI scale
  - Weight 400, not 500 — lighter reads softer at display sizes

  A larger serif reads softer than a smaller one. If display type feels sharp, increase the size before changing the face.

  *Approved fallback:* Instrument Serif — lower contrast, rounder, humanist, softer by construction. Swap to it if Fraunces still reads hard after tuning. Same role, same scale, no other changes required.

- **Interface — Inter (Google Fonts, variable)**  
  Neutral, highly legible, excellent at small sizes. Deliberately gets out of the way.  
  *Alternatives:* Geist, Söhne (licensed).

- **Mono — JetBrains Mono**  
  Booking references, QR payload display, ticket codes, admin logs.

```css
--font-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
```

### 4.2 Tabular figures — mandatory

```css
font-variant-numeric: tabular-nums;
```
**Required on:** countdown timers, prices, seat numbers, showtimes, dashboard tables, booking references, any changing numeral.

Without this, a countdown timer visibly jitters as digit widths change. This is a one-line fix that separates polished from sloppy, and it is the most commonly skipped detail in the entire system.

### 4.3 Type scale
Ratio 1.25. Serif reserved for genuine display moments only.

| Token | Size/Line | Face | Weight | Tracking | Use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | 48/52 | Fraunces | 500 | -0.02em | Hero, event detail title |
| `h1` | 36/42 | Fraunces | 500 | -0.015em | Page titles |
| `h2` | 28/34 | Fraunces | 500 | -0.01em | Section headers |
| `h3` | 20/28 | Inter | 600 | -0.005em | Card titles, subsections |
| `h4` | 17/24 | Inter | 600 | 0 | Minor headings, modal titles |
| `body-lg` | 17/28 | Inter | 400 | 0 | Event descriptions, editorial copy |
| `body` | 15/24 | Inter | 400 | 0 | Default UI text |
| `body-sm` | 13/20 | Inter | 400 | 0 | Metadata, helper text |
| `caption` | 11/16 | Inter | 500 | +0.06em | Labels, eyebrows, table headers — uppercase |
| `mono` | 13/20 | JetBrains | 400 | 0 | Codes, references |

**Mobile adjustments:** `display` → 32/36, `h1` → 28/34, `h2` → 22/28. Body sizes unchanged.

### 4.4 The caption style
Small, uppercase, letterspaced text is the recurring editorial motif of the system. It appears as:
- Category eyebrows above titles (`NOW SHOWING`, `LIVE EVENT`)
- Form field labels
- Table column headers
- Metadata labels (`VENUE`, `DURATION`, `CERTIFICATE`)
- Section dividers

It does a disproportionate amount of the premium feel for very little effort. Use it liberally — it is the one place where repetition strengthens rather than dilutes.

### 4.5 Restraint rules
- Maximum two serif elements per screen. Usually one.
- Never serif in: buttons, form labels, table cells, navigation, badges, tooltips. Serif in interface chrome reads as costume.
- **Measure:** 60–75 characters for body copy. Wider is unreadable, narrower is choppy.
- Never center long-form text. Center only single-line headings and empty states.

---

## 5. Spacing & Layout

### 5.1 Scale
4px base unit.

| Token | Value | Typical use |
| :--- | :--- | :--- |
| `space-1` | 4px | Icon-to-label gap |
| `space-2` | 8px | Inside compact components |
| `space-3` | 12px | Input padding, tight stacks |
| `space-4` | 16px | Default component padding |
| `space-6` | 24px | Card padding, related-group gaps |
| `space-8` | 32px | Between distinct groups |
| `space-12` | 48px | Between page sections |
| `space-16` | 64px | Major section breaks |
| `space-24` | 96px | Page top/bottom, hero padding |

> **The editorial rule:** Live at the large end. Where a conventional dashboard puts 16px between sections, put 48px. Generous vertical rhythm is the majority of the premium feel, and it costs nothing.

### 5.2 Grid and containers
12-column grid, 24px gutters desktop / 16px mobile.

| Container | Max width | Use |
| :--- | :--- | :--- |
| `container-prose` | 680px | Long-form text, terms, editorial copy |
| `container-narrow` | 880px | Checkout, forms, auth, single-column flows |
| `container-default` | 1200px | Listings, event detail, most customer pages |
| `container-wide` | 1440px | Dashboards, tables, seat maps |
| `container-full` | 100% | Scanner, immersive hero sections |

### 5.3 Breakpoints

| Name | Min width | Target |
| :--- | :--- | :--- |
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

*Desktop-first design, mobile-validated. Design at `xl`, but no customer-facing booking screen is considered complete until it has been verified at 375px. Seat selection and checkout in particular.*

### 5.4 Touch targets
Minimum 44×44px for any interactive element on touch devices. Seats may render smaller visually but must carry a 44px hit area via padding or an invisible overlay. The scanner app uses a 64px minimum.

---

## 6. Shape & Elevation

### 6.1 Radius

| Token | Value | Use |
| :--- | :--- | :--- |
| `radius-xs` | 4px | Seats, tiny indicators |
| `radius-sm` | 6px | Badges, chips, small controls |
| `radius-md` | 10px | Buttons, inputs, images, panels |
| `radius-lg` | 16px | Cards, modals, sheets, drawers |
| `radius-full` | 9999px | Pills, avatars, toggles |

The governing rule: radius scales with element size, not a single global value. A 10px radius on a 48px button is proportionally modest; the same 10px on a 20px badge would read bubbly. Consistency of ratio matters more than consistency of value.

Radii below 8px on medium-to-large elements produce a hard, unfinished edge — small enough that the corner still reads as a corner, without the deliberate crispness of a true square corner. Avoid that middle ground.

### 6.2 Elevation
Shadows are warm-tinted and subtle. A grey or blue shadow on a warm palette is immediately visible as wrong.

| Level | Definition | Use |
| :--- | :--- | :--- |
| `elev-0` | 1px solid `rule`, no shadow | Default cards, list items, inputs |
| `elev-1` | `0 1px 2px rgba(26,24,21,0.04)` + border | Hover on cards |
| `elev-2` | `0 4px 12px rgba(26,24,21,0.06)` | Dropdowns, popovers, tooltips |
| `elev-3` | `0 12px 32px rgba(26,24,21,0.10)` | Modals, sheets |
| `elev-sticky` | `0 1px 0 rule` | Sticky headers, bottom bars |

*Elevation 0 is the default. Most surfaces need only a hairline border. Reaching for a shadow usually means the layout needs more space instead.*

---

## 7. Motion

| Token | Duration | Easing | Use |
| :--- | :--- | :--- | :--- |
| `motion-hover` | 150ms | `var(--ease)` | Hover, focus, active states |
| `motion-fast` | 200ms | `var(--ease)` | Toggles, underline wipes, small transitions |
| `motion-base` | 250ms | `var(--ease)` | Entrances, dropdowns, sheets |
| `motion-slow` | 400ms | `var(--ease-emphasis)` | Page transitions, seat-map zoom |

Editorial means composed, not inert. Every interactive element must have a visible hover, focus, and active state. An interface with no feedback reads as broken, not restrained.

**Permitted:** opacity, color, border-color, box-shadow, and translations up to 2px. Micro-lifts (`translateY(-1px)`) on buttons and interactive cards are encouraged.

**Prohibited:** spring physics, overshoot, bounce, and scale transforms above 1.02.

**Never animate:** countdown timers, price totals, or seat availability changes (Principle 1.4).

*Durations below 120ms are not perceived as transitions — they read as snaps. 150ms is the floor for hover.*

All motion gated behind:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Iconography & Imagery

- **Icons:** Lucide. 1.5px stroke, sizes 16 / 20 / 24. Icons inherit text color — never accent-colored unless the accompanying text is. Icons are always paired with text labels except in the scanner and in universally understood controls (close, back, search).
- **Photography:** Enforced aspect ratios, 1px `rule` frame, 6px radius, `object-fit: cover`. Skeleton placeholders in `paper-sunken`; never spinners for images.
- **Empty states:** No illustrations. An `h3` line, a `body-sm` explanation in `ink-muted`, and one action. Restraint reads more premium than decorative artwork.

---

## 9. Component Specifications

### 9.1 Buttons

| Variant | Fill | Text | Border | Use |
| :--- | :--- | :--- | :--- | :--- |
| `primary` | `accent` | `accent-ink` | None | The one main action per screen |
| `secondary` | `paper-raised` | `ink` | 1px `rule-strong` | Secondary actions |
| `ghost` | `transparent` | `ink-secondary` | None | Tertiary, toolbars |
| `danger` | `danger` | `ink-inverse` | None | Destructive only |
| `link` | `transparent` | `accent` | None, underline on hover | Inline text actions |

- **Radius:** `radius-md` (10px).
- **Sizes:** `sm` 32px / `md` 40px (default) / `lg` 48px. Primary CTAs and mobile use `lg`. Nothing exceeds 48px.
- **Padding:** 16px horizontal (`md`). Label: `body`, weight 500, never serif.
- **Rule:** Exactly one primary button visible per screen region. Two primaries means the screen asks two questions — a Principle 1.3 violation.

#### Required states:
```css
transition: background-color var(--motion-hover) var(--ease),
            box-shadow      var(--motion-hover) var(--ease),
            transform       var(--motion-hover) var(--ease);

/* primary */
:hover  { background: var(--accent-hover);
          box-shadow: 0 2px 8px rgba(107,39,55,0.24);
          transform: translateY(-1px); }
:active { background: var(--accent-active);
          transform: translateY(0);
          box-shadow: none; }
:focus-visible { outline: 2px solid var(--accent);
                 outline-offset: 2px; }
```
Secondary and ghost variants follow the same pattern with `paper-sunken` hover fills and no shadow.

**Label copy:** verb-first and short. Never repeat the product name inside a button on its own product ("Sign in", not "Sign in to SeatEasy"). Directional arrows only where the action genuinely navigates elsewhere — not on submit.

### 9.2 Inputs
- Height 44px, `paper-raised` fill, 1px `rule` border, `radius-md`, 14px horizontal padding.

```css
transition: border-color var(--motion-hover) var(--ease),
            box-shadow   var(--motion-hover) var(--ease),
            background   var(--motion-hover) var(--ease);

:hover { border-color: var(--rule-strong); background: #FFFDFB; }
:focus { border-color: var(--accent);
         box-shadow: 0 0 0 3px var(--accent-subtle);
         outline: none; }
```
The focus ring transitions in — it never snaps.

- Labels use `caption` style above the field. Errors: `danger` border, `body-sm` message below with an icon. Never remove focus indication.
- **Leading icons are optional and default to off.** With caption labels above the field, an icon is redundant and adds visual weight. Use them only where the field type is genuinely ambiguous.
- **Adornments** (password reveal, clear, unit) get a 32px `radius-full` hit area with a `paper-sunken` hover fill. A bare icon with no hover feedback is not acceptable.

### 9.3 Cards
- `paper-raised` fill, 1px `rule` border, `radius-md`, `space-6` padding, `elev-0`.
- **Hover (when interactive):** `elev-1` + `rule-strong` border. No scale transform.
- Cards are used sparingly on customer pages — prefer whitespace separation (Principle 1.2). They earn their place in dashboards and the checkout summary.

### 9.4 Tables (dashboards)
- **Header row:** `paper-sunken`, `caption` style.
- **Rows:** 48px, 1px `rule` bottom border, `paper-raised` fill.
- **Hover:** `paper-sunken`. **Selected:** `accent-subtle` with a 2px `accent` left border.
- **Numeric columns:** Right-aligned, tabular figures.
- Zebra striping is not used — hairlines and row height carry the structure.

### 9.5 Badges
- `radius-full`, 2px/8px padding, `caption` style.
- **Variants:** `neutral` (`paper-sunken`/`ink-secondary`), `success`, `warning`, `danger`, `info`, `accent` — each using its `-subtle` fill with the solid color as text.

### 9.6 Modals & sheets
- **Desktop:** Centered modal, `container-narrow` max, `radius-lg`, `elev-3`, `paper-raised`.
- **Mobile:** Bottom sheet, `radius-lg` top corners only, drag handle.
- **Overlay:** `rgba(26,24,21,0.32)` — warm, never pure black.
- **Enter:** 250ms fade + 8px rise. Focus trapped; Esc closes unless a booking is mid-commit.

### 9.7 Links & tabs
Inline links animate an underline in rather than toggling it:

```css
background-image: linear-gradient(var(--accent), var(--accent));
background-size: 0% 1px;
background-position: 0 100%;
background-repeat: no-repeat;
transition: background-size var(--motion-fast) var(--ease);
:hover { background-size: 100% 1px; }
```

A wipe-in underline is an editorial gesture that costs nothing and makes text feel alive.

**Tabs:** `caption` style labels, 2px accent active indicator. The indicator slides horizontally between tabs over `motion-fast` — it never cuts. Inactive labels are `ink-muted` and shift to `ink-secondary` on hover.

Do not duplicate a tab's action elsewhere on the same screen. If "Create account" is a tab, it does not also appear as a footer link.

---

## 10. The Seat Map

The screen that defines the product. Every other screen is a competent booking flow; this is where users decide whether SeatEasy is good.

### 10.1 The core problem
The map must encode 5 states × 3 price categories legibly, on a phone, for colorblind users, under time pressure.

The resolution: state is carried by fill and border style; category is carried by border hue plus a mandatory legend. Neither is ever communicated by color alone.

### 10.2 Seat states

| State | Fill | Border | Opacity | Interactive |
| :--- | :--- | :--- | :--- | :--- |
| **Available** | `paper-raised` | 1.5px solid category color | 100% | Yes |
| **Selected** | `accent` solid | None | 100% | Yes (deselect) |
| **Held (others)** | `paper-sunken` | 1.5px dashed `rule-strong` | 100% | No |
| **Booked** | `paper-sunken` | None | 40% | No |
| **Blocked / aisle** | Not rendered — negative space | — | — | No |

*Selected seats show the seat number in `accent-ink`. The dashed border for "held" is the critical non-color signal distinguishing it from "booked."*

### 10.3 Canvas and furniture
- Canvas sits on `paper-sunken` so seats read as objects on a surface.
- **Screen/stage indicator:** A curved 1px `rule-strong` line with a caption-styled label (`SCREEN` / `STAGE`), plus a soft gradient fade suggesting projection. A small detail that carries a lot of the premium feel.
- Row labels in `caption` style, `ink-muted`, on both left and right edges.
- Aisles rendered as genuine gaps, never as drawn lines.
- **Seat size:** 28px desktop, 32px mobile, `radius-sm`, 6px gaps, 12px at aisles.

### 10.4 The legend — mandatory, always visible
Never collapsed, never behind a tooltip. Shows each category with its swatch, name, and price; plus available / held / booked / selected state swatches. On mobile it sits in a sticky bar directly beneath the map.

### 10.5 Per-vertical strategy

| Vertical | Approach |
| :--- | :--- |
| **Movies (~200 seats)** | Full grid visible at once. Fits desktop; mobile fits width with a 32px seat size. No zoom needed. |
| **Live events (zones/GA)** | Zone-first selection. Irregular floor plan rendered from coordinates. GA zones show a quantity stepper rather than a seat grid. |
| **Sports (10k–50k)** | Mandatory three-step drill-down: section → row → seat. Never attempt to render all seats. Overview shows sections colored by availability density. |

### 10.6 Zoom and pan
Only for sports and large-venue events. Movies never need it. Pinch-to-zoom and drag-pan, 0.5×–3× range, with a persistent minimap when zoomed beyond 1.5×. Double-tap zooms to the tapped section. A "fit to screen" control is always available.

### 10.7 The countdown timer
Directly governed by Principle 1.4.

| Remaining | Treatment |
| :--- | :--- |
| **> 2 min** | `ink-muted`, `body-sm`, tabular figures — quiet |
| **2 min – 30 s** | `warning` color, weight 500 |
| **< 30 s** | `danger` color, weight 600 |

*No pulsing, flashing, or scale animation at any point. A thin progress hairline beneath the timer conveys depletion. At expiry: a calm modal explaining the release, with the previously chosen seats offered for one-tap re-selection if still free.*

### 10.8 Conflict recovery
The most important interaction in the product, and the one most competitors get wrong.

When a seat is taken during selection:
1. The seat animates once to the held state — 150ms, no flash.
2. A non-blocking toast: *"C14 was just taken."*
3. Automatically suggest three equivalent seats — same category, similar position, adjacent where the group size requires it.
4. One tap to swap, one tap to dismiss.

> *"Error, please start over"* is never acceptable here. The difference between this and a plain error message is the difference between a demo and a product.

### 10.9 Real-time strategy
- Polling, demand-scaled: 8-second interval by default; 3 seconds when the screening is above 80% sold.
- Correctness comes from the server-side lock (`screening_seats.status` + `held_until`), never from the frontend. Real-time display is a comfort feature only.
- WebSockets are a documented future upgrade behind a transport interface — worthwhile only for high-demand onsales, not for launch.

---

## 11. Surface-Specific Guidance

The four surfaces share tokens and primitives but differ in density and character.

### 11.1 Customer booking app
Full editorial treatment. Generous space, serif display, `container-default`. Content-forward, marketing-grade. Highest design investment.

### 11.2 Organizer dashboard
Same tokens, tighter density. `container-wide`, 32px section gaps rather than 48px, tables and forms dominant. Serif appears only in the page title. Efficiency for daily users beats editorial flourish.

### 11.3 Super-admin panel
Most utilitarian. No serif at all. Maximum density, `container-full`, compact 40px table rows. Destructive actions always danger, always confirmed. Audit trails visible.

### 11.4 Scanner / check-in
A different product wearing the same palette. Designed for one hand, in low light, at a gate.
- Near-full-screen camera view
- Result states occupy the entire screen: `success` full-bleed green for valid, `danger` full-bleed for invalid — readable at arm's length in under half a second
- Minimum 64px touch targets
- Text no smaller than `body-lg`
- Works offline; queues scans for sync
- No serif, no decoration, no imagery

---

## 12. Dark Mode

Light is primary; dark is optional and secondary. Build the tokens correctly now, implement later.

> [!WARNING]
> Do not invert the light palette. Warm-light inverted produces muddy brown. Dark mode requires independently chosen values.

| Token | Dark value | Note |
| :--- | :--- | :--- |
| `paper` | `#16150F` | Warm near-black ground |
| `paper-raised` | `#211F19` | Elevation by lightening, not shadow |
| `paper-sunken` | `#100F0B` | Recessed background |
| `ink` | `#F5F2EC` | Warm off-white |
| `ink-secondary` | `#B8B3AA` | Body copy |
| `ink-muted` | `#847F76` | Metadata |
| `rule` | `#2E2B24` | Borders & hairlines |
| `accent` | `#C4707F` | Lightened — deep oxblood fails contrast on dark |
| `accent-subtle` | `#2A1A1E` | Tinted background |

- Semantic colors lighten similarly. Shadows are largely replaced by surface lightness; borders carry more of the work.
- **Implementation:** Identical token names, swapped by `[data-theme="dark"]` plus a `prefers-color-scheme` fallback. Every color must be defined on bare `:root` first — a color whose only definition lives inside a media query will break the toggle.

---

## 13. Accessibility

Non-negotiable requirements:

- **Contrast:** 4.5:1 body text, 3:1 large text and UI boundaries. `ink-muted` is AA-Large only and must never carry body copy.
- **Color independence:** Every state distinguishable without color. Seat states use fill and border style. Status badges carry text. Charts use pattern or direct labels.
- **Focus:** Visible on every interactive element — 3px `accent-subtle` ring with a `rule-strong` border. Never removed. Logical tab order. Skip-to-content link.
- **Seat map keyboard support:** Arrow keys move between seats, Enter selects, Escape exits the map. Each seat announces row, number, category, price, and state. Live regions announce selection changes and timer milestones (5 min, 2 min, 30 s) — but not every tick.
- **Motion:** All animation respects `prefers-reduced-motion`.
- **Forms:** Every input has a real `<label>`. Errors are programmatically associated and announced. Never placeholder-as-label.
- **Timers:** WCAG requires that timed processes be extendable. Provide a one-time extension of the hold, or clear warning with recovery.

---

## 14. Token Reference

```css
:root {
  /* ---- Neutrals: paper & ink ---- */
  --paper:            #FBFAF7;
  --paper-raised:     #FFFFFF;
  --paper-sunken:     #F4F2ED;
  --paper-inverse:    #1A1815;

  --ink:              #1A1815;
  --ink-secondary:    #57534E;
  --ink-muted:        #8A8580;
  --ink-faint:        #B8B3AC;
  --ink-inverse:      #FDFCFB;

  --rule:             #E7E3DC;
  --rule-strong:      #D6D1C8;

  /* ---- Accent: oxblood ---- */
  --accent:           #6B2737;
  --accent-hover:     #571F2C;
  --accent-active:    #451822;
  --accent-subtle:    #F7EDEF;
  --accent-border:    #E3CDD2;
  --accent-ink:       #FDFCFB;

  /* ---- Semantic ---- */
  --success:          #3F6B4F;
  --success-subtle:   #EDF3EF;
  --warning:          #8A6A2F;
  --warning-subtle:   #F7F1E6;
  --danger:           #8C3A32;
  --danger-subtle:    #F9EDEC;
  --info:             #3A5A7A;
  --info-subtle:      #EDF1F5;

  /* ---- Seat categories ---- */
  --seat-gold:            #B08A3E;
  --seat-gold-fill:       #FAF5EA;
  --seat-platinum:        #8A6E52;
  --seat-platinum-fill:   #F6F1EB;
  --seat-sofa:            #5E4636;
  --seat-sofa-fill:       #F2EDE7;

  /* ---- Type ---- */
  --font-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
  --font-sans:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    'JetBrains Mono', 'SF Mono', Menlo, monospace;

  --text-display:  3rem;     --leading-display:  3.25rem;
  --text-h1:       2.25rem;  --leading-h1:       2.625rem;
  --text-h2:       1.75rem;  --leading-h2:       2.125rem;
  --text-h3:       1.25rem;  --leading-h3:       1.75rem;
  --text-h4:       1.0625rem;--leading-h4:       1.5rem;
  --text-body-lg:  1.0625rem;--leading-body-lg:  1.75rem;
  --text-body:     0.9375rem;--leading-body:     1.5rem;
  --text-body-sm:  0.8125rem;--leading-body-sm:  1.25rem;
  --text-caption:  0.6875rem;--leading-caption:  1rem;

  /* ---- Space ---- */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-6: 24px;  --space-8: 32px;
  --space-12: 48px; --space-16: 64px; --space-24: 96px;

  /* ---- Radius ---- */
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-full: 9999px;

  /* ---- Elevation ---- */
  --elev-1: 0 1px 2px rgba(26, 24, 21, 0.04);
  --elev-2: 0 4px 12px rgba(26, 24, 21, 0.06);
  --elev-3: 0 12px 32px rgba(26, 24, 21, 0.10);
  --overlay: rgba(26, 24, 21, 0.32);

  /* ---- Motion ---- */
  --motion-hover: 150ms;
  --motion-fast:  200ms;
  --motion-base:  250ms;
  --motion-slow:  400ms;
  --ease:          cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-emphasis: cubic-bezier(0.4, 0, 0.2, 1);

  /* ---- Containers ---- */
  --container-prose:   680px;
  --container-narrow:  880px;
  --container-default: 1200px;
  --container-wide:    1440px;
}
```

---

## 15. Open Decisions

Things this document does not settle, flagged honestly:

1. **Oxblood Accent:** The oxblood accent is a recommendation, not a certainty. Everything else hangs off it. Worth looking at rendered before committing — three approved alternatives are listed in [§3.3](#33-brand-accent--oxblood), and swapping one changes only the `accent-*` tokens.
2. **Fraunces + Warm Paper:** Strongly opinionated. It will look nothing like any competitor. That is the intent, but it should be a conscious choice before 40 screens are built on it.
3. **Component Library:** Library-agnostic. If `shadcn/ui` is used, these tokens map cleanly onto its CSS-variable structure — that is probably the path of least resistance for a solo build.
4. **Schema Gaps:** Block several specified screens. Seat geometry (`rowLabel`, `colIndex`, optional `x`/`y`), `shows.type`, venue `layoutType`, poster/metadata fields, an admin role, screen/hall modeling, and a booking reference plus QR payload are all required by this document but absent from the current Drizzle schema. The seat map in [§10](#10-the-seat-map) cannot be built without seat geometry.
5. **Dark Mode Values:** Provisional. Directionally correct, but require verification against real artwork before implementation.
6. **Fraunces on Probation:** Requires `SOFT`/`opsz` tuning to avoid reading hard at UI sizes. If display type still feels sharp after tuning and up-scaling, swap to Instrument Serif — the change is isolated to `--font-display` and affects nothing else in the system.