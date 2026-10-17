# Design reference

Seven phone screens (390 × 844) designed on a Claude Design canvas. They are the
visual source of truth for the new app.

| File | Screen |
|---|---|
| `screens/01-uebersicht.dc.html` | Overview / home |
| `screens/02-training.dc.html` | Logging a session (set table) |
| `screens/03-zyklen.dc.html` | Cycles: AI review card + week matrix |
| `screens/04-wochen-checkin.dc.html` | AI weekly check-in |
| `screens/05-fortschritt-lifts.dc.html` | Progress: lifts, 1RM chart, data Q&A, plateau card |
| `screens/06-fortschritt-skills.dc.html` | Progress: skills ladder + hold-time chart |
| `screens/07-neue-uebung.dc.html` | Create a custom exercise |

## How to read these files

They are **not runnable HTML**. They use a design-canvas template format:

- Markup inside `<x-dc>` is the screen. Inline `style="…"` holds the exact values
  (colors, sizes, radii, gaps): copy them into components.
- `{{name}}` is a value computed in the `<script type="text/x-dc">` block at the bottom.
- `<sc-for list="{{items}}" as="x">` repeats its children per item; `<sc-if value="{{flag}}">` is a conditional.
- `href="Training.dc.html"` links mean navigation to that screen.
- All numbers and names are **demo data** (e.g. "Back Squat 128 kg"). Real exercise
  names come from the user's data (the legacy app used German names like "Kniebeuge").

Rebuild the screens as React components. Match the look closely; layout details may
adapt to real data and real phone sizes (safe areas, 360–430 px widths).

## Design tokens

Dark mode is the primary (and for now only) theme.

### Colors

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0A1628` | App background, input background |
| `surface` | `#11223A` | Cards |
| `surface-2` | `#183050` | Done rows, chips, icon tiles |
| `surface-ai` | `#0E1F35` | AI cards (with `baby` 1.5 px border) |
| `nav` | `#0D1C31` | Bottom nav and sticky bottom bars |
| `border` | `#22405F` | Card borders, dividers |
| `border-strong` | `#2B4D72` | Inputs, outline buttons, dashed add buttons |
| `text` | `#EEF5FC` | Primary text |
| `text-2` | `#C9D8E6` | Body text in AI cards |
| `muted` | `#9FB6CC` | Labels, secondary text (passes 4.5:1 on `bg` and `surface`) |
| `faint` | `#7F98B2` | Strikethrough "from" values, delete icons |
| `baby` | `#A8D5F7` | Brand color: data, charts, highlighted surfaces, active segment |
| `lime` | `#C8F24A` | Actions and achievements: primary CTA, done check, PR, current week |
| `navy` | `#0F2A47` | Text/icons on `baby` or `lime` fills |
| `plateau` | `#7FA3C7` | Stagnating series (dashed line) |

Rules: never put white or `muted` text on `baby`/`lime` — always `navy`. Lime is
used sparingly (one primary action per screen, done states, the active-tab bar).

### Typography

- **Barlow** (400/500/600/700): all UI text. Base 15 px.
- **Barlow Condensed** italic 700/800, uppercase: screen titles (40 px), card titles
  (22–30 px), big numbers (26–60 px), CTA labels (22 px).
- Self-host both (e.g. `@fontsource/barlow`, `@fontsource/barlow-condensed`) so the
  app works offline. No Google Fonts link in production.

### Shape and spacing

- Radii: cards 18–22 px, buttons/inputs 10–16 px, chips 999 px.
- Screen padding 18 px; gap between cards 12–16 px.
- Touch targets ≥ 44 px.
- "Dynamic" accent: small badges like `WOCHE 3/8` / `AKTIV` use `transform: skewX(-12deg)`;
  cycle progress bars use `skewX(-20deg)` segments.
- Icons: 24 px stroke icons, stroke width 1.8, round caps (lucide-react matches well).

### Navigation

Bottom nav with 5 tabs: Übersicht · Training · Zyklen · Fortschritt · Übungen. Active tab:
`baby` label/icon plus a 22 × 3 px `lime` bar above the icon. The live training screen
hides the bottom nav and shows a sticky "Einheit abschliessen" bar instead.
