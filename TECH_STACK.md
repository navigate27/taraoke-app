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
| Song search | YouTube Data API v3 (server-side proxy) | Direct client calls (key exposure) |
| Player | YouTube IFrame Player API (host device only) | Plain `<iframe>` embed |
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

- **IFrame Player API** on the host view only — programmatic control
  (`loadVideoById`, play/pause/seek) and `onStateChange` for auto-advance. A plain
  `<iframe>` gives none of this.
- **Search is proxied server-side** so the API key never reaches the browser, with
  response caching to conserve the ~100 free searches/day quota, plus the paste-URL
  fallback (PRD §5.3).
- ToS guardrails: official player only; never touch raw streams, never strip ads
  (PRD §9).

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
    shared/
      types.ts              # Room, QueueItem, socket event contracts
```

## Conventions

- Package manager: **pnpm**.
- One `pnpm dev` (concurrently) runs Vite + server; shared types live in `src/shared`.
- No secrets in client code; YouTube API key is server-only via env.
- No database, no auth service — room code = guest auth, host token = host auth
  (stored in `localStorage`).

## Deferred (revisit when needed)

- Redis for room state (when >1 server process is needed)
- Service worker / install prompt polish for the PWA
- Chromecast/AirPlay casting
- Rate limiting beyond basic per-socket throttling (public deployment)