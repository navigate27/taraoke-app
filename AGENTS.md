# Taraoke — Agent Rules

Instant karaoke rooms PWA — "Tara, kanta na!" Docs live in this repo:
[PRD.md](./PRD.md) · [TECH_STACK.md](./TECH_STACK.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

## Visual/media policy (CRITICAL — never violate)

- **Never read media files** — images, screenshots, PDFs, video. Never use the Read
  tool on any binary/visual asset. Reason: visual data floods and corrupts the
  agent's context. The user has explicitly forbidden this.
- **Never drive a browser for visual verification** — no Playwright screenshots or
  page captures in this project. Type-checked code + the user's own eyes are the
  verification path for anything visual.
- If a change is visual, describe what changed and let the **user** open it in their
  browser.

## Mockups & visual review — visual companion (mandatory)

All mockups, design variants, and visual A/B choices go through the
**superpowers brainstorming "visual companion"** browser companion
(`superpowers:brainstorming` → `visual-companion.md` in the plugin cache). Never
decide visual questions by screenshotting; the user picks in their browser:

1. Start: `scripts/start-server.sh --project-dir <repo root> --open` (from the
   skill's `scripts/` directory). Same `--project-dir` on restart to keep the port.
2. **Never embed mockups via `src="/files/…"` iframes** — the companion server
   sends `X-Frame-Options: DENY` on every response, so framed assets always show
   "localhost refused to connect". Instead, write a **full-document screen**
   (starts with `<!DOCTYPE html>`, served as-is + helper injected) that embeds
   each mockup's markup inside `<script type="text/html">` templates and assigns
   them to iframes via `iframe.srcdoc` — no network request, no frame block.
3. The screen with `data-choice` options must be the newest file in `screen_dir`
   (the server serves the newest). Never reuse a filename.
4. Read the user's picks from `$STATE_DIR/events` (JSON text — this is fine to read)
   and their terminal reply.
5. Push a "waiting" fragment when the conversation moves back to terminal topics.

## Project docs are the source of truth

- Features/scope → `PRD.md`. Stack/deploy decisions → `TECH_STACK.md`. All colors,
  type, spacing, motion, copy voice → `DESIGN_SYSTEM.md`. Update these docs
  before (not after) changing what they describe.
- **UI copy is plain English — no Taglish.** The user has explicitly ruled out
  Taglish interface copy. Keep labels plain and universal (Queue, Search, Join,
  End room). "Taraoke"/"Tara, kanta na!" appear only as brand tagline, never as
  controls or copy.

## Stack conventions

- TypeScript everywhere; pnpm; single Node process (Fastify + Socket.io) serving the
  Vite build. Layout lives in `TECH_STACK.md` §"Project layout".
- Server owns room state in memory; host token authorizes host actions; guest room
  code is the only guest auth.
- YouTube playback: native HTML5 `<video>` fed by the server's stream resolver +
  range proxy (`/api/stream/:videoId`, built on `youtubei.js`) — owner-approved
  pivot, 2026-09; accepted trade-offs live in PRD §9. Search (typed, paste-URL, and
  suggestions) also runs server-side on `youtubei.js` InnerTube — the YouTube Data
  API was dropped (owner decision, 2026-09); no API key reaches the client.

## General

- Global house rules (`~/.claude/CLAUDE.md`, Agent OS) apply. Commit messages carry
  no AI/attribution trailers. No secrets in tracked files — env vars only.
- Ask before large refactors or scope changes; the PRD's Non-goals (§3) are
  deliberate — don't quietly add accounts, payments, or voting.