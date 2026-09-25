# Taraoke — instant karaoke rooms

**"Tara, kanta na!"** A Filipino-flavored, retro-arcade karaoke PWA: one device is the
videoke operator, everyone else joins from their phone — no accounts, no signups.
Scan, pick a nickname, queue a song, sing.

![Design language](https://img.shields.io/badge/design-retro%20arcade-neon) — neon
cabinets, pixel type, CRT glow. Full spec in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

## Features

- **Instant rooms** — the host creates a room and gets a 4-character code
  (QR + short URL for guests). Rooms live in server memory and auto-expire.
- **Shared queue** — anyone searches and adds karaoke songs (capped at 50).
  Drag-reorder works for everyone: mouse drag on desktop, long-press-then-drag
  on touch. Host can play now, skip, remove, clear, or end the room.
- **Host-driven playback** — the host device is the room's speaker and playback
  source of truth. Native HTML5 `<video>` fed by a server-side YouTube stream
  resolver (`youtubei.js`) with HTTP Range support; guest phones mirror the
  synced playback state (opt-in video preview, data-saver friendly).
- **Smart suggestions** — Last.fm-powered buckets (same artist, similar tracks,
  genre, room taste, wildcards) plus OPM videoke classics when the room is fresh.
- **Videoke score reveal** — an optional mic-input scoring engine (CREPE pitch
  tracking in a Web Worker) with a dev playground at `/#/score-lab`.
- **PWA** — installable, works over LAN or HTTPS.

## Stack

- **Client** — React + Vite + TypeScript, Tailwind, Socket.io client.
- **Server** — Fastify + Socket.io, single Node process, in-memory room state.
- **YouTube** — search and playback both run server-side on `youtubei.js`
  (InnerTube; no Data API, no API keys in the client). Stream URLs are resolved,
  cached, and proxied with Range support. On datacenter-hosted deploys, YouTube
  bot-gates playback: the server solves BotGuard and mints PO tokens
  (`bgutils-js`), and can send cookies from a logged-in account
  (`YOUTUBE_COOKIE`) — see `deploy/.env.example`.
- **Last.fm** — artist/similar-track/genre data for suggestions (API key required).

## Quick start

```bash
pnpm install

# Server env (or put it in src/server/.env — gitignored)
export LASTFM_API_KEY=your_lastfm_api_key

pnpm dev        # Vite on :9015, API+socket server on :3001
```

Open http://localhost:9015 — create a room as host, join from another device
on the same network via the LAN IP the home screen shows.

## Production deploy

Self-hosting guide (Oracle Cloud free tier, Caddy TLS, systemd):
[deploy/DEPLOY.md](./deploy/DEPLOY.md). Deploy assets (Caddyfile, systemd unit,
env template) live in [deploy/](./deploy/).

> Hosting on a datacenter IP? Read the `YOUTUBE_COOKIE` note in
> [deploy/.env.example](./deploy/.env.example) — YouTube bot-gates anonymous
> playback from cloud IPs even with PO tokens.

## Project docs

- [PRD.md](./PRD.md) — product spec, scope, non-goals, risks
- [TECH_STACK.md](./TECH_STACK.md) — stack decisions, layout, integration notes
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — colors, type, spacing, motion, copy voice

## Repository layout

```
src/
  client/     React PWA (views, components, lib, scoring engine, pitch model)
  server/     Fastify + Socket.io (rooms, stream proxy, search, PO tokens)
  shared/     Shared types and song-title normalization
deploy/       Caddyfile, systemd unit, self-hosting guide
mockups/      Static HTML design mockups
```