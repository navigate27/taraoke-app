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
Guests' phones are synced controllers: they show the current song (title, progress)
and any guest can control playback — the video and its sound stay on the host device.

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
- The **host** screen keeps the join info (QR + code) front and center; the **guest**
  view hides it by default (participants are always visible) so the room code doesn't
  crowd the phone UI.

### 5.3 Song search & selection

- **Search sources (in priority order):**
  1. **Innertube search** (server-side via `youtubei.js`) — query
     `"{title} {artist} karaoke"`, no API key and no daily quota; results show title,
     channel, duration, thumbnail.
  2. **Paste a YouTube URL** — always-available fallback.
- Search UX: one search box, filter chips (e.g., OPM, Pop, Rock, 2000s) are nice-to-have;
  results are karaoke-version videos (lyrics on screen baked into the video).
- **Blank-state picks:** with an empty search box, the modal shows trending picks —
  currently trending PH tracks resolved to karaoke versions — plus artist chips;
  tapping a chip fills the search box with that artist.
- Guest taps a result → **Add to queue** (optional: "queue for after current song").

### 5.4 Queue system

- Single shared FIFO queue. Anyone can add; **host controls it**:
  - Play / pause / skip current song.
  - Reorder, remove, or clear queue items.
  - The queue holds up to **50** songs; further adds are rejected with an error.
- Queue item states: `queued → playing → done` (and `skipped`).
- Queue panel is organized top-to-bottom: **Now playing**, then a tabbed section
  with two nav tabs — **Next** (the FIFO queue, with its item count) and **Played**
  (recently finished songs, newest first) — and, below the tab content, a
  **Suggestions** section: karaoke videos seeded from the current song or the most
  recent queued/played song (falling back to OPM staples when the room is fresh).
  Suggestions come from the server's YouTube proxy with a per-seed cache to conserve
  quota; songs already queued are hidden from the list, and the list refills by
  paginating further YouTube results (page tokens) until it runs out.
- Each item shows: thumbnail, title, added-by nickname (as a participant chip), duration.
- Removing a queued item asks the host to confirm. Played songs can be queued again
  (button on each played row). While a played song is queued, its row leaves the
  Played list and returns once it is played again. The Played list holds up to
  **50** songs (oldest dropped beyond that).
- Guests see the queue live and a **"You're up next!"** notification when their song is
  1 away (it sits between the join panel and the player panel).

### 5.5 Playback (YouTube)

- **Player: native HTML5 `<video>`** fed by the server's YouTube stream proxy
  (`/api/stream/:videoId` — the server resolves YouTube stream URLs, caches them, and
  pipes bytes with HTTP Range support). Rationale:
  - Programmatic control via the standard media API: `play/pause`, `currentTime`,
    `duration`, `muted`.
  - The `ended` event → auto-advance to the next queue item (with repeat-one support).
  - Full video container control (no embed chrome) and clean fullscreen.
- Video plays on the **host device** only; audio goes to the room's speakers. Guest
  phones show the synced playback state (title, progress, remaining time) only — no
  video panel, thumbnail, badge, or sound.
- Player transport (host and guest panels share one layout), two centered rows:
  - **Main row:** **repeat, -10, play/pause, +10, next**.
  - **Secondary row (below, centered):** **sound, fullscreen** (host only — guests
    have no video, so no fullscreen).
  - Fullscreen fills the screen with the video container on the host; repeat is a
    repeat-one toggle — turning it on also restarts the current song from the top;
    when on, the host replays the song at its end instead of advancing.
- Guest transport is **not gated by ownership — any guest can use the full transport**
  (play/pause, repeat, -10/+10 seek, next). These actions are relayed through the
  host's player (the host stays the source of truth); the server only requires the
  guest to be in the room. Guest controls are active whenever the room has any song
  (playing or queued); with nothing playing, **Play starts the first queued song**.

### 5.6 Room lifecycle & edge cases

- Host leaving/closing tab → room enters grace period (e.g., 5 min), then auto-expires.
- Host resumes: when the host returns to the room, playback resumes from the last
  synced position and playing state (the server caches the latest `player_state`).
- While the host is away, guests see the current song **paused** at the last synced
  position — the server broadcasts a paused state when the host disconnects.
- Guests who leave are removed from the participant list after a heartbeat timeout;
  remaining participants see a "left the room" toast (and a "joined" toast on entry).
  Participants stay alive via a periodic heartbeat ping.
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
| Song search | Innertube search (server-side via `youtubei.js`) | No API key, no daily quota; result caching for speed |
| Player | Native HTML5 `<video>` + server stream proxy (`/api/stream/:videoId`) | Host view (authoritative); guest view (synced state, no video, no audio) |
| Auth | None | Room code = guest auth; host secret token = host auth |

**Sync model:** the host device is the playback source of truth; it broadcasts
`player_state` (playing/paused, position) that guest devices follow with a >2s drift
re-seek. The server owns the queue; the host's control actions are just privileged queue
mutations. Any guest may control playback (not restricted to their own songs):
their actions are relayed as `player:control` events that the host's player executes.

**Quota note:** the YouTube Data API was dropped (owner decision, 2026-09) — search
runs on InnerTube via `youtubei.js` with no API key and no daily quota. Result caching
keeps response times low; the URL-paste fallback always works.

## 8. Success metrics (MVP)

- Time from "open app" to "room created" < 10 s.
- Guest join (scan → in room) < 5 s.
- Songs added per active room ≥ 5.
- Zero-friction rate: % of sessions with zero accounts/forms beyond nickname.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| YouTube stream extraction breaks when YouTube changes player internals | `youtubei.js` is actively maintained; the proxy re-resolves stream URLs on failure and serves an error state the host can skip past. Accepted trade-off per owner decision (2026-09) — replaces the former official-embed-only stance. |
| YouTube bot-gates playback from datacenter IPs (`LOGIN_REQUIRED` — hits the deployed VM, not local dev) | Server solves the BotGuard challenge and mints PO tokens (`potoken.ts`, bgutils-js + jsdom sandbox); visitor-bound token on the InnerTube session, content-bound token on stream URLs; cookies from a logged-in account via the `YOUTUBE_COOKIE` env var (throwaway account; on flagged datacenter IPs PO tokens alone don't clear the gate). Minting failures degrade to a plain session. YouTube can change the challenge format without notice — if playback suddenly 502s with `LOGIN_REQUIRED`, suspect BotGuard or expired cookies first. |
| googlevideo stream URLs expire / are IP-bound | In-memory URL cache with TTL + single-flight re-resolve on 403; bytes always flow through the server proxy, never a client redirect. |
| Search quota exhaustion | N/A — no Data API; InnerTube search has no daily quota. Caching + paste-URL fallback remain. |
| Karaoke search returns non-karaoke videos | Karaoke/instrumental keyword filter on titles; host previews before play |
| Host disconnect mid-party | Grace period + reconnect via localStorage host token |
| Stream proxy bandwidth (host only) | Guest view has no stream request; quality capped at muxed progressive formats; can be lowered to 360p with a one-line change if needed |

## 10. Future / backlog candidates

- Vote-skip and "boos" reactions
- Duet mode, pitch shift, scoring (mic input via Web Audio API)
- Favorites list per device (localStorage)
- Spotify/Apple Music search integration for metadata
- Cast to TV (Chromecast / AirPlay) from the PWA
- Tagalog/English i18n