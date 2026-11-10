---
name: Warm Editorial Estate
colors:
  surface: '#fcf9f2'
  surface-dim: '#dcdad3'
  surface-bright: '#fcf9f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ec'
  surface-container: '#f1eee7'
  surface-container-high: '#ebe8e1'
  surface-container-highest: '#e5e2db'
  on-surface: '#1c1c18'
  on-surface-variant: '#434845'
  inverse-surface: '#31312c'
  inverse-on-surface: '#f3f0e9'
  outline: '#737875'
  outline-variant: '#c3c8c3'
  surface-tint: '#54615a'
  primary: '#111e19'
  on-primary: '#ffffff'
  primary-container: '#26332d'
  on-primary-container: '#8d9b93'
  inverse-primary: '#bbcac1'
  secondary: '#9a4526'
  on-secondary: '#ffffff'
  secondary-container: '#ff946f'
  on-secondary-container: '#772b0e'
  tertiary: '#1d1b14'
  on-tertiary: '#ffffff'
  tertiary-container: '#333028'
  on-tertiary-container: '#9c988d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e6dd'
  primary-fixed-dim: '#bbcac1'
  on-primary-fixed: '#111e19'
  on-primary-fixed-variant: '#3c4a43'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#7b2e11'
  tertiary-fixed: '#e8e2d6'
  tertiary-fixed-dim: '#ccc6ba'
  on-tertiary-fixed: '#1e1b14'
  on-tertiary-fixed-variant: '#4a473e'
  background: '#fcf9f2'
  on-background: '#1c1c18'
  surface-variant: '#e5e2db'
typography:
  display:
    fontFamily: Newsreader
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 30px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 4rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system serves high-performing Turkish real estate brokerages and independent advisors seeking an elevated, dignified digital home. It rejects the cold, sterile, cookie-cutter SaaS aesthetics in favor of architectural refinement, warmth, and literary poise. 

The aesthetic is **Warm Editorial & Tactile Modernism**:
- **Poise & Authority:** High-caliber editorial typography paired with restrained structural balance evokes legacy European property journals and bespoke architectural dossiers.
- **Atmospheric Warmth:** Organic cream foundations and rich ink-green elements create an inviting, human workspace that dignifies the daily routine of a property agent.
- **Measured Craft:** Precise layout rules, airy proportions, and delicate tactile edges yield an Awwwards-caliber interaction standard without sacrificing clarity or SaaS utility.

## Colors

The palette draws inspiration from travertine stone, terracotta roofing tiles of the Mediterranean coast, and dark Aegean pine needle inks:

- **Primary (`#26332D` - Deep Ink Green):** Used for primary typography, authoritative surfaces, solid header blocks, navigation marks, and deep structural anchors.
- **Secondary (`#B85C3B` - Terracotta):** Used strictly as a focused accent—high-intent call-to-action triggers, status highlights, badge markers, and key performance metric callouts. Never used for massive field fills.
- **Tertiary (`#DED8CC` - Stone):** Provides the boundary language—structural dividers, crisp 1px borders, subtle card outlines, and inactive control states.
- **Neutral (`#F6F3EC` - Cream Canvas):** The overall canvas backdrop. It cushions the eye against screen fatigue and provides warmth beneath floating layers.
- **Card Surface (`#FFFEFA` - Warm White):** Pure, warm resting planes for cards, input containers, and active reading panels to separate data cleanly from the cream baseline.

## Typography

Typography balances historical warmth with precision SaaS data rendering:

- **Editorial Headlines (Newsreader):** Brings humanistic, literary sophistication to key value propositions, property portfolio titles, and major landing page milestones. Set with slightly tight tracking to maintain visual cohesion at large scales.
- **Interface & Metrics (Inter):** Handles all dashboard previews, UI controls, navigational links, analytics data, and body copy. Delivers neutral clarity and effortless legibility in Turkish diacritics (`ç, ğ, ı, ö, ş, ü`).
- **Styling Rules:** Pair italicized Newsreader accents within headlines (e.g., *“Portföy Yönetiminde”* Yeni Dönem) to establish rhythmic visual contrast. Maintain body text strictly in deep ink green (`#26332D`) at 85% opacity to avoid harsh starkness against the cream background.

## Layout & Spacing

The layout is built on an architectural 12-column fluid grid system, bounded at a maximum canvas width of 1360px to preserve comfortable scanning paths:

- **Rhythm & Cadence:** Generous section spacing (minimum `space-xl` scaled 3–4x for vertical landing sections) enforces calm, uncluttered pacing between feature blocks and platform proof points.
- **Desktop (1024px+):** 12 columns with `1.5rem` gutters and `4rem` outer canvas padding. Component layouts use asymmetric compositions—pairing large imagery spans (7 columns) with refined editorial briefs (5 columns).
- **Tablet (768px - 1023px):** 8 columns with `1.5rem` gutters and `2.5rem` outer margins. Secondary sidebars collapse into sticky bar controls.
- **Mobile (< 768px):** 4 columns with `1rem` gutters and `1.25rem` outer margins. Grids stack into an uninterrupted vertical editorial feed with full-bleed property visual cards.

## Elevation & Depth

Visual hierarchy avoids heavy artificial drop shadows, relying instead on clean tonal surfaces, hairline borders, and atmospheric diffusion:

- **Base Layer:** The canvas sits at `#F6F3EC`.
- **Card Tier:** Elevated content units sit on `#FFFEFA` with a subtle hairline outline (`1px solid #DED8CC`) and a gentle ambient shadow: `0px 4px 20px -2px rgba(38, 51, 45, 0.04), 0px 1px 4px -1px rgba(38, 51, 45, 0.02)`.
- **Floating Overlays & Menus:** Dropdown menus, sticky navigation ribbons, and modal drawers leverage the same warm white fill with an enhanced atmospheric lift: `0px 16px 36px -4px rgba(38, 51, 45, 0.08), 0px 4px 12px -2px rgba(38, 51, 45, 0.03)`.
- **Dividers:** Interior dividers within cards or between grid columns are strictly `1px solid #DED8CC` to emulate fine stationery lines.

## Shapes

The design system standardizes on a balanced, tailored corner geometry:

- **Core Elements & Cards:** Master cards, property showcase frames, mock UI containers, and content sections utilize a strict `12px` (`0.75rem`) border radius, striking an intentional balance between tactile softness and architectural firmness.
- **Buttons & Chips:** Primary interactive pills maintain full-radius rounded capsules or refined `8px` shapes depending on density contexts.
- **Media Containers:** Architectural property imagery features matched `12px` rounding with internal 1px inner stone borders to prevent visual bleed on light photos.

## Components

### Buttons
- **Primary CTA:** Deep ink green (`#26332D`) surface, warm white text (`#FFFEFA`), `8px` border-radius or pill shape, subtle hover transition lifting slightly with an ink shadow: `0px 4px 12px rgba(38, 51, 45, 0.15)`.
- **Accent CTA (Direct Conversion / Demo):** Terracotta (`#B85C3B`) surface, `#FFFEFA` typography, used selectively for the central conversion point.
- **Secondary / Ghost:** `#FFFEFA` background with a `1px solid #DED8CC` boundary, `#26332D` text. On hover, background shifts to `#F6F3EC`.

### Cards & Property Teasers
- **Structure:** Crisp `#FFFEFA` fill, `12px` rounded corners, `1px solid #DED8CC` perimeter, and ambient soft green-tinted shadow.
- **Content Flow:** High-contrast property photography on top with a `12px` inner radius, followed by editorial Newsreader title, stone metadata dividers, and agency agent micro-avatars.

### Chips & Badges
- **Status Markers:** Terracotta tinted pill (`#B85C3B` at 10% opacity) with solid terracotta text for "Yeni Portföy" (New Portfolio) or high-priority tags.
- **Category Chips:** Warm white fill with `1px solid #DED8CC`, `11px` uppercase tracking for property types ("Konut", "Ticari", "Arsa").

### Form Fields & Inputs
- **Base Style:** `#FFFEFA` container with `1px solid #DED8CC`, `8px` border radius, `15px` Inter typography in `#26332D`.
- **Focus State:** Crisp `1px solid #26332D` ring with zero aggressive outer glow, preserving an authentic paper-form feel. Placeholder text sits at 40% `#26332D`.

### Checkboxes & Radios
- **Unchecked:** `1px solid #DED8CC` on a white background with a `4px` corner radius.
- **Checked:** Filled with `#26332D` containing a crisp white tick mark.

### Key Product Specifics
- **CRM Metric Blocks:** Dedicated stat cards pairing large Newsreader numeric displays with muted Inter micro-labels.
- **Property Commission Calculator:** Clean sliding scale UI using terracotta track fills and deep ink thumbs against stone track baselines.