# Taraoke — Product Requirements Document

**"Tara, kanta na!"** — instant karaoke rooms, no account needed.

- **Version:** 0.1 (Draft)
- **Date:** 2026-09-23
- **Status:** MVP scoping

---

## 1. Overview

Taraoke is a web app (PWA) that turns any device into a videoke machine. One person
creates a room, everyone else scans a QR code to join from their phone — no downloads,
no accounts. Guests search for songs, add them to a queue, and the host plays them
via embedded YouTube karaoke videos on the "big" device (TV, laptop, tablet).

**Target users:** Filipino households, parties, inuman sessions, small gatherings —
anyone who has ever pointed a remote at a videoke machine.

## 2. Goals

- **Zero friction:** a room is live in under 10 seconds; a guest joins in one QR scan.
- **No accounts, ever.** Identity = a device-local nickname. Rooms are ephemeral.
- **Host-first control.** The host is the "videoke operator" — they run the queue.
- **Free to run.** Leverage YouTube's catalog (largest karaoke songbook in existence)
  rather than licensing music.

## 3. Non-goals (v1)

- No user accounts, profiles, or persistent song history.
- No voting, duets, scoring, or pitch-shifting (future candidates, see §10).
- No native mobile apps.
- No monetization.
- No audio recording/uploading of performances.

## 4. Personas

| Persona | Device | What they do |
|---|---|---|
| **Host** ("videoke operator") | Laptop/TV-connected device | Creates the room, controls playback and queue |
| **Guest** | Phone | Scans QR, picks a nickname, searches and queues songs |

One device can be both host screen and player (e.g., a laptop on the TV speaker).
Guests' phones are controllers, not players (v1).

## 5. Features

### 5.1 Create room (no account)

- Host opens Taraoke → enters a host nickname → taps **Create Room**.
- Server generates a room: short room code (e.g., `TARA-4F2K`) + a **host secret token**
  stored in the host's `localStorage`. No login.
- Room state: created → active → expired (auto-close after N hours idle).

### 5.2 Join via QR

- Room screen shows a large **QR code** encoding the join URL (`taraoke.app/r/{code}`)
  plus the visible room code as text fallback.
- Guest scans → lands in the room → enters a display nickname → in.
- No permission needed from the host to *join*; adding songs is also open (host can remove).

### 5.3 Song search & selection

- **Search sources (in priority order):**
  1. **YouTube Data API v3 search** (server-side, API-key protected) — query
     `"{title} {artist} karaoke"` against curated karaoke channels; results show title,
     channel, duration, thumbnail.
  2. **Paste a YouTube URL** — always-available fallback if search quota is exhausted.
- Search UX: one search box, filter chips (e.g., OPM, Pop, Rock, 2000s) are nice-to-have;
  results are karaoke-version videos (lyrics on screen baked into the video).
- Guest taps a result → **Add to queue** (optional: "queue for after current song").

### 5.4 Queue system

- Single shared FIFO queue. Anyone can add; **host controls it**:
  - Play / pause / skip current song.
  - Reorder, remove, or clear queue items.
- Queue item states: `queued → playing → done` (and `skipped`).
- Each item shows: thumbnail, title, added-by nickname, duration.
- Guests see the queue live and a **"You're up next!"** notification when their song is
  1 away.

### 5.5 Playback (YouTube)

- **Player: YouTube IFrame Player API** (not a plain `<iframe>`). Rationale:
  - Programmatic control: `loadVideoById`, `playVideo`, `pauseVideo`, `seekTo`.
  - State events (`onStateChange`) → auto-advance to the next queue item on `ENDED`.
  - Player params: `rel=0` (hide related videos), fullscreen support, minimal chrome.
- Video plays on the **host device**; audio goes to the room's speakers.
- Guest phones show a synced "now playing" panel (title, progress) — muted, no video
  playback on guest devices in v1 (keeps A/V in sync trivially and avoids echo).
- Known tradeoff: **YouTube ads may play between songs** on non-Premium accounts.
  Acceptable for MVP; documented as a known limitation.

### 5.6 Room lifecycle & edge cases

- Host leaving/closing tab → room enters grace period (e.g., 5 min), then auto-expires.
- Guests who leave are removed from the participant list after timeout.
- Duplicate song in queue: allowed, but host may remove.
- Room codes: collision-safe, profanity-filtered, retry on collision.
- Empty queue → "Add a song!" empty state with one-tap suggestions (e.g., top OPM
  videoke staples).

## 6. UX flow (golden path)

1. Host: `taraoke.app` → **Create Room** → fullscreen room view: [QR + code] left,
   [player] center, [queue] right.
2. Guests: scan → nickname → see room dashboard (now playing, queue, search tab).
3. Guest searches "Eheads" → adds "Ang Huling El Bimbo (Karaoke)".
4. Host taps play on the queued item → YouTube video plays with on-screen lyrics.
5. Song ends → auto-advance to next item → repeat.
6. Party ends → host taps **End Room** → everything is gone.

## 7. Technical architecture (proposed)

| Layer | Choice (MVP) | Notes |
|---|---|---|
| Frontend | Next.js / Vite + React PWA | Single page, two layouts: host view & guest view |
| Realtime | WebSockets (Socket.io or Supabase Realtime) | Room events: `queue_updated`, `player_state`, `participant_join/leave` |
| Backend | Node (host-persisted room state) | Rooms held in memory/Redis; no DB required for MVP |
| Song search | YouTube Data API v3 (server-side proxy) | Caches popular queries to conserve quota |
| Player | YouTube IFrame Player API | Only on host view |
| Auth | None | Room code = guest auth; host secret token = host auth |

**Sync model:** the host device is the playback source of truth; it broadcasts
`player_state` (playing/paused, position) that guests render read-only. The server owns
the queue; the host's control actions are just privileged queue mutations.

**Quota note:** free YouTube API quota ≈ 100 searches/day. Mitigations: result caching,
curated pre-seeded "karaoke staples" list shipped with the app, URL-paste fallback.

## 8. Success metrics (MVP)

- Time from "open app" to "room created" < 10 s.
- Guest join (scan → in room) < 5 s.
- Songs added per active room ≥ 5.
- Zero-friction rate: % of sessions with zero accounts/forms beyond nickname.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| YouTube ToS: must not download/strip ads/extract audio | Use official IFrame Player API only; never touch raw streams |
| Search quota exhaustion | Caching, seeded catalog, paste-URL fallback |
| Ads between songs kill the vibe | Documented limitation; future: host's own Premium account |
| Karaoke search returns non-karaoke videos | Prefer curated karaoke channels in search filter; host previews before play |
| Host disconnect mid-party | Grace period + reconnect via localStorage host token |

## 10. Future / backlog candidates

- Vote-skip and "boos" reactions
- Duet mode, pitch shift, scoring (mic input via Web Audio API)
- Favorites list per device (localStorage)
- Spotify/Apple Music search integration for metadata
- Cast to TV (Chromecast / AirPlay) from the PWA
- Tagalog/English i18n