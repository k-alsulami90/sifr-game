# Design

النظام البصري للعبة **صِفر** — مستخرَج من الكود الفعلي (`src/theme.js`،
`tailwind.config.js`، `src/index.css`). RTL أولًا، خلفية داكنة، لكنة ذهبية،
خطوط عربية. الشاشة الأساسية (`/display`) تُشاهَد من بُعد على التلفاز.

## Theme

Dark, cinematic, gold-on-near-black. Single warm accent (gold) carries identity;
a cool blue is used sparingly to mark "whose turn", red only for wrong/eliminated.
Surfaces are layered near-black panels with hairline light borders. The mood is a
premium-but-bold game-show stage, not an app dashboard.

## Color

Primary surface is near-black `#08080c`; the accent is gold `#F5C84B`.

### Backgrounds & surfaces
- `--ink` `#08080c` — app/page background, deepest layer
- `--panel-dark` `#0b0b11` — admin shell background
- `--chrome` `#0e0e14` — admin header bar
- `--panel` `#101018` — primary card surface
- `--panel2` `#16161e` — nested/secondary surface, list rows, chips
- `--input-bg` `#0c0c12` — inputs, score field
- **Display stage wash** (`DISPLAY_BG`): radial gold glow top-center
  `rgba(245,200,75,.10)` + radial blue glow bottom `rgba(60,90,170,.10)` over `#08080c`

### Accent — gold (identity)
- `--gold` `#F5C84B` — primary accent, numbers, active borders
- `--gold-soft` `#FFD970` — softer gold for secondary emphasis / labels
- **GOLD_GRAD** `linear-gradient(180deg,#FFE49A,#F5C84B 60%,#D6A52F)` — primary buttons
- **TITLE_GRAD** `linear-gradient(180deg,#FFF0C2,#F5C84B 55%,#B5841F)` — brand wordmark "صِفر"
- **POINTLESS_GRAD** `linear-gradient(180deg,#FFF6D8,#F5C84B 55%,#C9962A)` — the "صِفر!" celebration

### Text — cream
- `--cream` `#F6F1E7` / `--cream2` `#F8F3E6` — primary headings/body on dark
- `--cream3` `#E8E1CF` — secondary headings on display
- Muted scale (labels, captions, disabled): `#cfc8b6` `--mute6`, `#bdb39a` `--mute5`,
  `#9a937f` `--mute3`, `#8C8576` `--mute4`, `#7c7666` `--mute` (placeholder), `#6b6557` `--mute2`
- Empty/disabled category text: `#6b6557` / `#544f44`

### State colors (never color-only — paired with icon/text)
- Wrong / eliminated — red: `#FF5A5A` `--danger`, `#FF6B6B` `--danger2`, `#FF8080` `--danger3`
- Active turn — blue (sparingly): `#6FA8FF` `--turn`, `#9CC2FF` `--turn2`

### Contrast & a11y
Target **WCAG AA** on the dark background; cream `#F6F1E7` and gold `#F5C84B` both
clear AA on `#08080c`. Outcomes are distinguished by **icon + text + color**, not
hue alone (`✕` for wrong, gold "صِفر!" for pointless, strike-through for eliminated).

## Typography

Two Arabic families from Google Fonts, RTL.

- **Cairo** — headings, brand wordmark, scores, all big numbers. Weight **900**
  almost everywhere it appears; this is the show's voice.
- **Tajawal** — body text, inputs, chips, captions. Weights 400–700.
- Base body: Tajawal, color `#F6F1E7` on `#08080c`, antialiased.

### Scale (fluid, display reads from a distance)
Display uses `clamp()`/`vw`/`vh` so type scales to the TV:
- Brand wordmark: `min(22vw,300px)` (display), 64px (join)
- Hero numbers (countdown, reveal score, "صِفر!"): `min(36vh–38vh, 380–400px)`
- Question text: `clamp(34px,4.4vw,72px)`
- Eliminated team name: `min(14vw,180px)`
- Admin headings: 20–28px Cairo 900; admin body 12–16px Tajawal.

### Numerals
**Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) everywhere** via `toAr()` — room codes, scores,
timers, counts. Never Western digits in player-facing text.

## Layout

- **Direction:** `dir="rtl"` global; both routes are `position: fixed; inset: 0`
  full-viewport, `overflow: hidden` (no page scroll; it's an app/stage).
- **Admin:** flex/grid control panel. Setup = single clean column (teams +
  guaranteed categories + start). In-game = grid `1fr 360px` on wide
  (main stage + persistent scoreboard column), single column on narrow.
- **Display:** **flex column** — a non-shrinking scoreboard bar at top
  (always visible: round/pass + team chips + cumulative scores), a `flex:1`
  stage below filling remaining height. Phases (spin / question / countdown /
  reveal / elimination / winner) render inside the stage; nothing overlaps the bar.
- **Spacing:** fluid `clamp()` padding on display (`clamp(16px,2.4vh,34px)` etc.);
  fixed 14px gaps/padding on admin cards.

## Components

- **Cards / panels:** `--panel` `#101018` bg, radius **12–16px**, hairline border
  `1px solid rgba(255,255,255,.06–.08)`; gold-accented cards use `rgba(245,200,75,.16)`.
- **Pills / chips (team, category, used-answer):** fully rounded `border-radius: 100`,
  `--panel2` bg, hairline border; active/selected → gold border `rgba(245,200,75,.5–.6)`
  + gold tint bg `rgba(245,200,75,.14–.16)`.
- **Primary button:** GOLD_GRAD bg, ink text `#2a2008`, radius 9–14px, Cairo 900,
  gold glow shadow `0 8–10px 24–30px rgba(245,200,75,.3)`. Disabled → `#2a2a32` / muted.
- **Ghost / secondary button:** `--panel2` bg, hairline border, muted text.
- **Lightboard** (`components/Lightboard.jsx`): 5×20 = 100-cell board; states
  lit / off / flare; drives the countdown and pointless celebration.
- **Confetti** (`components/Confetti.jsx`): gold pieces, `confFall` animation, on
  pointless + winner.
- **Timer ring:** SVG circular progress, gold stroke with glow, Arabic digit center.
- **Inputs:** `--input-bg`, radius 10–12px, hairline border; score input gold Cairo 900.
- **Scrollbar:** 9px, thumb `rgba(245,200,75,.25)`.

## Motion

Framer Motion (`AnimatePresence mode="wait"`) for phase transitions + CSS keyframes
in `index.css`. Bold and decisive, timed for suspense and celebration — never busy.

- `livePulse` — pulsing live/standby dots
- `flareIn` — scale-in pop for reveals (score, pointless, winner)
- `glowBreath` — breathing gold glow on the winner name
- `confFall` — confetti drop
- `shake` — wrong-answer shake on the ✕
- `spinPop`, `lockBoom` — category spin land + question lock-in
- `elimRise` — elimination card rise
- **Countdown/spin timing** is deterministic and shared (`game/timing.js`) so the
  read-only Display animates in sync with the Admin without writing back.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` collapses all
  animations to ~0ms; reveals jump straight to final state.

## Voice

Confident Arabic game-show host energy. Short, declarative, celebratory on rarity
("صِفر!", "إجابة نادرة جدًّا!"), sharp on elimination ("خرج من المنافسة"). The
inverted scoring (lower = rarer = better) is reinforced verbally ("أندرُ إجابة…
أعلى فوز", "نُدرة الإجابة").
