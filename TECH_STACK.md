# Taraoke — Tech Stack

Companion to [PRD.md](./PRD.md). Decisions and rationale for v1 (MVP).

---

## Summary

| Layer | Choice | Alternatives considered |
|---|---|---|
| Language | TypeScript (full-stack) | — |
| Frontend | Vite + React + Tailwind CSS (PWA) | Next.js, React Native |
| Realtime | Socket.io on Node | Supabase Realtime, PartyKit / Durable Objects |
| Backend | Fastify (Node) — serves API, WebSockets, and static build | Express, NestJS |
| Room state | In-memory (per-process) | Redis, Postgres |
| Song search | Innertube search (server-side via `youtubei.js`) | YouTube Data API v3 (dropped 2026-09 — key + quota overhead) |
| Player | Native HTML5 `<video>` fed by server-side YouTube stream resolver (`youtubei.js`) via `/api/stream/:videoId` proxy | YouTube IFrame Player API (replaced 2026-09, owner decision) |
| QR codes | `qrcode` (generated client-side) | — |
| Hosting | Single Node process — Railway / Fly.io / VPS | Vercel (rejected: no persistent WebSockets) |

## Decisions & rationale

### Vite + React over Next.js

The entire app is client-interactive: rooms, WebSocket-driven state, QR display, a video
player. There is no content to crawl and no SSR use case — Next.js adds framework weight
and a server runtime we can't use anyway (see Vercel note below).

### Single Node process (Fastify + Socket.io)

- Fastify serves the built Vite bundle and hosts the Socket.io server in the same
  process — **one deploy, one log file, one thing to run** (`pnpm dev` runs both in dev).
- The server owns all mutable state: room map, queues, participants. Clients (host and
  guests) are thin renderers over socket events.
- **Accepted limitation:** server restart wipes active rooms. Rooms are ephemeral by
  design (PRD §5.6), so this is acceptable for v1. Horizontal scaling would require
  extracting state to Redis — deliberately deferred.

### Realtime: where does it live?

Vercel/Netlify serverless cannot hold persistent WebSocket connections, so the naive
"deploy to Vercel" path is off the table for the core feature. Options weighed:

1. **Self-hosted Socket.io (chosen)** — full control, minimal moving parts, free-tier
   friendly.
2. Supabase Realtime — managed, but pushes state logic into the client and adds a
   service for what in-memory handles fine.
3. PartyKit / Cloudflare Durable Objects — purpose-built for "rooms with participants"
   and the best scaling story, but a newer toolchain and overkill for MVP.

### In-memory room state

Data model held in the server process:

```
Room {
  code: string            // "TARA-4F2K"
  hostToken: string       // secret, authorizes host actions
  participants: Map<socketId, { nickname, lastSeen }>
  queue: QueueItem[]
  nowPlaying: QueueItem | null
  createdAt, lastActivityAt
}

QueueItem {
  id, videoId, title, channel, duration, thumbnail
  addedBy: nickname
  state: 'queued' | 'playing' | 'done' | 'skipped'
}
```

Idle rooms auto-expire (see PRD §5.6). No database in v1.

### YouTube integration

- **Search runs on InnerTube** (`youtubei.js`, server-side) — same dependency as the
  stream resolver, no API key and no daily quota. The YouTube Data API v3 was dropped
  (owner decision, 2026-09): it added key management and a ~100 searches/day quota for
  no quality win. Typed search, suggestions, and the blank-state picks all flow through
  the same server-side search with response caching; pasting a YouTube URL remains the
  always-available fallback (PRD §5.3).
- **Playback** (owner-approved pivot, 2026-09 — replaces the former official-embed-only
  stance): the server resolves YouTube stream URLs with `youtubei.js`, caches them
  in memory with a TTL, and proxies the bytes at `GET /api/stream/:videoId` with
  HTTP Range support (403/expiry triggers a single-flight re-resolve). Only the host
  renders a plain `<video src="/api/stream/:videoId">` — programmatic control via the
  standard media API, `ended` → auto-advance. Guest devices render the synced
  playback state only — no video element, no stream request, no audio; the host
  device is the room's speaker. The host stays the playback source of truth.
- **PO token minting** (added 2026-09-25, `potoken.ts`): YouTube bot-gates playback
  from datacenter IPs (the Oracle VM's) with `LOGIN_REQUIRED`. The server solves the
  BotGuard challenge in Node (`bgutils-js` + a jsdom globals sandbox), mints
  visitor-bound and content-bound tokens, and attaches them to the InnerTube session
  and stream URLs; minting failures degrade gracefully to a plain session. Muxed
  formats come from the ANDROID InnerTube client (WEB no longer serves progressive
  formats); stream.ts falls back WEB → ANDROID → MWEB. On heavily flagged datacenter
  IPs PO tokens alone don't clear the gate — the session also sends cookies from a
  logged-in account via the `YOUTUBE_COOKIE` env var (yt-dlp maintainers' accepted
  fix; use a throwaway account, never committed).
- **Accepted trade-off:** raw stream extraction tracks YouTube's player internals
  (ToS-gray; `youtubei.js` keeps up), and the BotGuard challenge format can change
  without notice — both would need prompt attention if playback breaks; risk register
  lives in PRD §9. A future service worker must bypass `/api/stream`.

### Sync model

The host device is the playback source of truth and broadcasts `player_state`
(playing/paused, position) that guest views render read-only. The server owns the queue;
host controls are privileged queue mutations validated by the host token.

## Project layout

```
kr/
  PRD.md
  TECH_STACK.md
  package.json              # pnpm workspaces / single repo
  src/
    client/
      src/
        views/host/         # room dashboard: QR, player, queue controls
        views/guest/        # controller: now playing, queue, search
        components/
        lib/socket.ts
    server/
      index.ts              # Fastify bootstrap: static + socket + REST proxy
      rooms.ts              # room state, TTL, host-token validation
      youtube.ts            # search proxy + cache
      stream.ts             # YouTube stream resolver + range proxy (/api/stream)
      potoken.ts            # BotGuard PO token minting (bgutils-js + jsdom sandbox)
    shared/
      types.ts              # Room, QueueItem, socket event contracts
```

## Conventions

- Package manager: **pnpm**.
- One `pnpm dev` (concurrently) runs Vite + server; shared types live in `src/shared`.
- No secrets in client code; external API keys (Last.fm) are server-only via env.
- No database, no auth service — room code = guest auth, host token = host auth
  (stored in `localStorage`).

## Deferred (revisit when needed)

- Redis for room state (when >1 server process is needed)
- Service worker / install prompt polish for the PWA
- Chromecast/AirPlay casting
- Rate limiting beyond basic per-socket throttling (public deployment)