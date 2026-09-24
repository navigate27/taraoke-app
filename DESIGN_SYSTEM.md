# Taraoke — Design System

Companion to [PRD.md](./PRD.md) and [TECH_STACK.md](./TECH_STACK.md). v2.0 · 2026-09-23 ·
Direction: **full pixel cabinet** (user-approved arcade revision, v2).

---

## 1. Direction: the arcade cabinet, turned into an app

Taraoke is a **retro arcade cabinet** that lives in a browser tab. The host view is the
cabinet's control deck; the guest's phone is a player-2 controller. The identity draws
from 80s/90s arcade halls crossed with the Filipino videoke machine — CRT marquees,
high-score tables, insert-coin moments.

- **Audience:** barkadas, inuman sessions, family gatherings — people holding a drink
  in one hand and a phone in the other, in a dark room lit by a glowing screen.
- **The page's single job:** keep the party moving — play the next song without anyone
  standing up.
- **Design consequence:** deep cabinet darkness, neon magenta/cyan/gold, pixel-crisp
  type for everything the "machine" displays, hard offset shadows, scanlines. High
  contrast, big targets, zero softness.

### Signature element

**The CRT screen.** Everything "the machine displays" — room code, countdown, queue
rank numbers, the player itself — sits in a dark inset panel with scanlines, an inner
vignette, and a neon glow. Two rules make it cohere:

1. *If the machine shows it, it's CRT* — scanline overlay + glow only on these panels,
   nowhere else in the UI.
2. *If it's a rank, score, or code, it's pixel type* (Press Start 2P).

The design's aesthetic risk is committing fully: a bitmap display face for live data
and headings, accepted as deliberately retro rather than "clean". Justified because
room codes and countdowns are literally what arcade marquees exist to show.

## 2. Color

The room is dark; the neon does the talking. One accent family leads per surface,
never competing.

| Token | Hex | Name | Role |
|---|---|---|---|
| `--cab-900` | `#0F0A1E` | **Cabinet black** | App background |
| `--cab-800` | `#191233` | — | Panels, cards |
| `--cab-700` | `#2E2150` | — | Borders, bezels |
| `--crt-000` | `#05030C` | **CRT glass** | Inset panels (marquee, QR, screen), hard shadows |
| `--arc-100` | `#F2EDFF` | — | Primary text |
| `--arc-500` | `#A79FC4` | — | Secondary text, captions |
| `--neon-500` | `#E43BFF` | **Player 1 magenta** | Primary actions, play, active/playing states |
| `--cyan-500` | `#3EF0FF` | **Player 2 cyan** | Links, room code, progress bar, selection |
| `--gold-500` | `#FFD23E` | **High-score gold** | Countdown, scores, "you're up next", section headers |
| `--red-500` | `#FF3D5A` | **On-air red** | "LIVE" badge, destructive actions (end room) |

Rules:
- Magenta leads (P1 = the host), cyan supports, gold scores, red warns. Never magenta
  and cyan competing at full strength on the same element.
- Glow (box-shadow in the element's accent) is reserved for CRT panels and the
  active/playing item — nowhere else.
- Hard shadows follow one law: `Npx Npx 0 var(--crt-000)` — offset down-right, zero
  blur, pure black. Buttons visually "press" by shrinking the offset.
- Text on `--cab-900` must pass WCAG AA: `arc-100` and `arc-500` do; neon/cyan/gold
  are large-text or non-text use.

### Semantic mapping (Tailwind theme extension)

```css
--color-bg:      var(--cab-900);
--color-panel:   var(--cab-800);
--color-bezel:   var(--cab-700);
--color-crt:     var(--crt-000);
--color-text:    var(--arc-100);
--color-muted:   var(--arc-500);
--color-primary: var(--neon-500);
--color-accent:  var(--cyan-500);
--color-hype:    var(--gold-500);
--color-danger:  var(--red-500);
```

## 3. Typography

| Role | Face (Google Fonts) | Usage |
|---|---|---|
| Display + data | **Press Start 2P** | Headings, room code, countdown, queue ranks, buttons on host view, "INSERT COIN". Bitmap type — always small |
| Body / UI | **Hanken Grotesk** | Everything readable: song titles, descriptions, forms, guest-view body |

Press Start 2P is a bitmap face — it is huge-looking and unreadable small. Scale:

```
--px-9:   9px    (micro labels: "NOW PLAYING", badges — always uppercase, +0.12em tracking)
--px-10:  10px   (buttons, chips, captions on host view)
--px-13:  13px   (panel headings, "QUEUE")
--px-16:  16px   (rare — room name on narrow screens)
--px-22:  22px   (room code, countdown clock)
```

Rules: pixel type is always uppercase with `text-transform`, tabular for numerals, and
never used for sentences longer than ~6 words. Everything longer is Hanken. Body text
`line-height ≥ 1.45`; pixel type `line-height ≥ 1.4` with breathing room around it.

## 4. Layout & spacing

- Spacing scale: 4px base (`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`).
- Radius: **pixel-crisp** — `--radius: 4px` everywhere (panels, buttons, thumbs, QR).
  No pills, no 20px softness; the cabinet is angular.
- Elevation is one device: the hard offset shadow (`6px 6px 0 var(--crt-000)` for
  panels, `5px 5px 0` for buttons). No blurs except neon glows.
- **Host view = control deck** (desktop/TV):

```
┌─────────────────────────────────────────────────────┐
│  [CRT marquee: ★ TARAOKE ★ · code · countdown]      │
├───────────────┬─────────────────────┬───────────────┤
│  QR + code    │   YOUTUBE PLAYER    │   QUEUE       │
│  (CRT panel)  │   16:9, scanlines   │  (high-score  │
│  + coin blink │   LIVE badge       │   rows)       │
├───────────────┴─────────────────────┴───────────────┤
│  transport: ⏮ ▶/⏸ ⏭ · END ROOM                     │
└─────────────────────────────────────────────────────┘
```

- **Guest view = player-2 controller** (phone, single column): sticky CRT now-playing
  bar on top, tab bar below it (`Search` / `Queue`), content fills the rest.
  Thumb-reachable bottom 60% holds primary actions.
- Touch targets: **minimum 48px**, 56–72px for transport — guests operate with one
  hand, often in low light.

## 5. Components

### CRT panel (signature)
`--crt-000` inner, `3px` `--cab-700` bezel, scanline overlay
(`repeating-linear-gradient(0deg, rgba(0,0,0,.25–.35) 0 1–2px, transparent 1–3px)`),
neon glow in the panel's accent. Used for: room marquee, QR/room-code card, player
screen, now-playing bar, "YOU'RE UP NEXT" callout. Always contains real data — never
decorative.

### Cabinet buttons (primary/secondary)
Square, chunky: `--neon-500` fill with a darker hard border, `5px 5px 0` shadow;
`:active` translates `translate(3px, 3px)` and collapses the shadow (the button presses
into the cabinet). Secondary: `--cab-800` fill, `--arc-100` icon. Transport buttons are
56–72px squares; label buttons carry Press Start 2P at 10px. Icon-only buttons carry
`aria-label`s.

### Queue card (high-score row)
`--cab-800` panel, 3px bezel: pixel rank number on the left rail (`1` glows neon when
playing) · thumbnail (16:9, 4px, 2px bezel) · title (Hanken 600) · "added by
<nickname>" (xs, muted) · host drag handle. States: `queued` → `playing` (neon bezel +
glow, striped cyan progress bar) → `done` (50% opacity, struck).

### Search result card
Same skeleton as queue card + right-aligned **"Add to queue"** button. Channel name
under title ("Sing King Karaoke") so guests can spot non-karaoke videos. Added state:
cyan check + "Added".

### Nickname chip
Small square-cornered tag, `--cab-700` fill, 2px `#3A2B66` bezel, colored 8px square
player-dot (cycled from the palette). Duplicates get auto-suffixes ("Ivan 2").

### Badges & micro-moments
- **LIVE** — red fill, pixel type, hard shadow, top-right of the player. Host view only.
- **INSERT COIN TO JOIN** — gold pixel type under the room code, 1.1s steps blink.
  The one allowed infinite animation.
- **Toast / confirmation** — CRT mini-panel, action result only: "Added to queue —
  you're #5 in line", "Skipped". Auto-dismiss 3s.

### Empty states
Invitations, not apologies. Queue empty on host view: "No songs yet — add the first
one" + the seeded staples list. Guest search empty: "What are we singing?" + 3
suggestion chips.

## 6. Motion

One orchestrated moment, few micro-interactions, all respecting
`prefers-reduced-motion`.

- **Auto-advance (the moment):** when a song ends, the now-playing card collapses and
  the next card slides up into it while the CRT marquee re-renders the countdown — the
  party's heartbeat; it should feel like the cabinet flipping tracks.
- **"You're up next" pulse:** a single 2× pulse of the gold glow on the guest's CRT
  callout when their song becomes next. Not a loop.
- **Insert-coin blink:** steps-blink (no fade) at 1.1s — the only looping animation.
- **Press feedback:** buttons translate `3px, 3px` on `:active` with hard-shadow
  collapse — the arcade keypress.
- Everything else: no parallax, no ambient loops, no scroll-triggered reveals.

## 7. Voice & copy (plain English, arcade flavor)

Interface copy is plain English — casual, confident, lightly arcade-flavored. The user
has ruled out Taglish; "Taraoke / Tara, kanta na!" is brand only.

| Rule | Yes | No |
|---|---|---|
| Verbs first, no filler | "Pick a song" | "Please select a song" |
| Same word through a flow | "Queue" everywhere for the queue | queue/list/line mixing |
| Errors state cause + fix | "Couldn't connect. Refresh the page." | "Oops! Something went wrong" |
| No apologizing, no hype | "Song ended." | "Sorry! 🎤 Your amazing song has ended!" |
| Arcade flavor in moments, not controls | "Insert coin to join", "Today's high scores" | "PLAYER 1 READY — DEFEAT THE MICROPHONE" |

Core vocabulary (used everywhere, never paraphrased):
- **Queue** — the queue. **Search** — search. **Song** — a song entry.
- **Join** — enter the room. **Taraoke!** — the create-room CTA (brand moment only).
- Host actions: **Play/Pause**, **Next**, **Skip**, **End room**.

## 8. Iconography & imagery

- Icons: **Pixelarticons** (`pixelarticons/react`, MIT) — 1-bit pixel icons on a 24px
  grid, the native companion to Press Start 2P. Used for all functional UI: close ✕
  (Close), search, volume off (VolumeX), eye (Eye/EyeOff), host star (Star),
  played check (Check), play (Play), now-playing note (Music), reorder
  (ArrowUp/ArrowDown), repeat (Repeat1), more options (MoreHorizontal). Sized 16–20px
  via CSS classes; glows on SVG icons use `drop-shadow` filter. Active toggles
  (repeat on, more-options open, sound on) light up in cyan with a text glow instead
  of a filled background.
- One transport icon is a **custom 1-bit inline SVG** in the same 24px/pixel style:
  **sound on** (speaker + wave bars drawn to the same bounding box as `volume-x`, so
  the mute/unmute toggle doesn't shift optically). **Fullscreen** uses the pack's
  `Scale` (opposing diagonal arrows) — the pack has no fullscreen glyph and `expand`
  looks like a plus. **Repeat** uses the pack's `Reload` (circular rotate arrow) —
  the pack has no rotate glyph and `repeat`/`repeat-1` scatter into noise at 20px.
- **Icon-only buttons** carry a hover/focus tooltip via a `data-tip` attribute —
  a CRT mini-panel (2px bezel, hard shadow, 8px pixel type, uppercase) rendered
  with CSS `[data-tip]::after` above the button; no native `title` on those
  buttons. Hover tooltips fire only on hover-capable pointers (touch taps must
  not leave a stuck tooltip); `:focus-visible` shows it on any device. Buttons
  with visible text labels don't get tooltips.
- Transport keeps **unicode glyphs** (▶ ❚❚ ⏭) — pixel-font-native and the
  arcade-authentic look; don't replace them with an icon pack.
- **App mark** (`/icon.png`, also the favicon + PWA icon): the pixel jukebox art is
  the brand mark inside the app. Shown in exactly two places — the Home header
  (80px mark above the pixel wordmark, hard offset shadow) and the room CRT marquee
  (20px mark left of the wordmark). The wordmark stays Press Start 2P with the neon
  glow; the mark replaces the old `★ … ★` star framing. Never use it as a bullet,
  watermark, or filler elsewhere.
- No stock photos of people singing. Imagery is the machine itself: CRT panels,
  speaker-grille texture at ≤4% contrast, bezels.
- Thumbnails (YouTube) are the app's de facto imagery — keep chrome quiet so they read
  as the app's visual texture.

## 9. Accessibility floor

- Contrast: all text AA on `--cab-900`; pixel type is inherently low-detail — keep
  sizes ≥ 9px and never set body text in it.
- Keyboard: full host view operable — transport, queue reorder, search; visible
  `:focus-visible` ring in `--cyan-500` (2px, offset 2px).
- QR card always shows the room code as text (scanning isn't available to everyone).
- `prefers-reduced-motion`: auto-advance becomes a crossfade; insert-coin blink and
  pulse disabled (static text instead).
- Nickname input: text name always present for screen readers (no emoji-only identity).

## 10. Anti-patterns (explicitly out)

- Rounded-soft everything (the v1 look is retired) — the cabinet is pixel-crisp.
- Gradient buttons, glassmorphism, confetti — party energy comes from CRT panels,
  hard shadows, and the auto-advance moment.
- Press Start 2P for body text, song titles, or anything longer than a short heading.
- Scanlines outside CRT panels — full-screen noise stays subtle (variant A's 22%
  overlay) or lives only on the machine.
- Taglish copy, corporate-stiff copy, or emoji-decorated strings — plain English,
  arcade flavor in moments only.