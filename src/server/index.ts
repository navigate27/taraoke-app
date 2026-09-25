import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";

for (const envPath of [
  path.resolve(import.meta.dirname, "../../.env"),
  path.resolve(import.meta.dirname, ".env"),
]) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}
import fastifyStatic from "@fastify/static";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  GuestAction,
  HostAction,
  PlayerState,
  QueueItem,
  ServerToClientEvents,
} from "../shared/types";
import {
  advanceQueue,
  applyHostAction,
  createRoom,
  deleteRoom,
  getRoom,
  markDisconnected,
  publicState,
  removeParticipant,
  scoreParticipant,
  removeStaleSelf,
  reorderQueueItem,
  sweepRooms,
  touchRoom,
  MAX_QUEUE_SIZE,
} from "./rooms";
import {
  SIMILAR_PAGE,
  cleanArtist,
  getArtistTopTracks,
  getSimilarTracks,
  getTagTopTracks,
  getTopTracksChart,
  getTrackTopTags,
  pickGenreTag,
  resolveKaraokeVersions,
  resolveSimilarTracks,
  type SimilarTrack,
} from "./lastfm";
import { normalizeTitle } from "../shared/songTitle";
import {
  karaokeOnly,
  resolveYouTubeUrl,
  searchYouTube,
} from "./youtube";
import { streamHandler } from "./stream";

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const HOST = process.env.SERVER_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

const distDir = path.resolve(import.meta.dirname, "../../dist");
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  // SPA fallback: client routes like /r/:code are handled by the React app.
  app.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? "/";
    if (
      request.raw.method === "GET" &&
      !url.startsWith("/api") &&
      !url.startsWith("/socket.io")
    ) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found" });
  });
}

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/lan", async () => {
  const virtual = /^(lo|docker|br-|veth|virbr|tailscale|zt|awdl|bridge)/;
  for (const [name, nets] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const net of nets ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return { ip: net.address };
      }
    }
  }
  return { ip: null };
});

app.get<{ Params: { videoId: string }; Querystring: { audio?: string } }>(
  "/api/stream/:videoId",
  streamHandler,
);

app.get<{ Querystring: { q?: string } }>("/api/search", async (req, reply) => {
  const q = (req.query.q ?? "").trim();
  if (!q) return reply.code(400).send({ error: "Missing search query" });
  const { results, source } = await searchYouTube(q);
  reply.send({ results, source });
});

app.get<{ Querystring: { url?: string } }>(
  "/api/resolve",
  async (req, reply) => {
    const url = (req.query.url ?? "").trim();
    if (!url) return reply.code(400).send({ error: "Missing URL" });
    const result = await resolveYouTubeUrl(url);
    if (!result) return reply.code(404).send({ error: "Not a YouTube video URL" });
    reply.send(result);
  },
);

const BUCKET_SIZE = 4;
const SUGGESTIONS_TOTAL = 20;

app.get<{
  Querystring: {
    seed?: string;
    artist?: string;
    page?: string;
    room?: string;
    exclude?: string;
  };
}>("/api/suggestions", async (req, reply) => {
  const seed = (req.query.seed ?? "").trim().slice(0, 120);
  const artist = cleanArtist((req.query.artist ?? "").trim().slice(0, 120));
  const page = (req.query.page ?? "").trim();

  if (artist && seed) {
    const roomArtists = [
      ...new Set(
        (req.query.room ?? "")
          .split(",")
          .map((a) => cleanArtist(a.trim().slice(0, 120)))
          .filter((a) => a && a.toLowerCase() !== artist.toLowerCase()),
      ),
    ].slice(0, 4);

    const seedTitle = normalizeTitle(seed);
    const seenTitles = new Set<string>([seedTitle]);
    for (const t of (req.query.exclude ?? "").split(",")) {
      const n = normalizeTitle(t.trim().slice(0, 120));
      if (n) seenTitles.add(n);
    }
    const usedArtists = new Set<string>([artist.toLowerCase()]);

    const take = (
      pool: SimilarTrack[],
      want: number,
      otherArtistsOnly: boolean,
    ): SimilarTrack[] => {
      const out: SimilarTrack[] = [];
      for (const t of pool) {
        if (out.length >= want) break;
        const n = normalizeTitle(t.title);
        if (!n || seenTitles.has(n)) continue;
        const aLower = t.artist.toLowerCase();
        if (otherArtistsOnly && usedArtists.has(aLower)) continue;
        seenTitles.add(n);
        usedArtists.add(aLower);
        out.push(t);
      }
      return out;
    };

    const [similarAll, artistTracks, tags, chart] = await Promise.all([
      getSimilarTracks(artist, seed),
      getArtistTopTracks(artist, 12),
      getTrackTopTags(seed, artist),
      getTopTracksChart(),
    ]);
    const genreTag = pickGenreTag(tags);
    const [genreTracks, roomPool] = await Promise.all([
      genreTag ? getTagTopTracks(genreTag, 12) : Promise.resolve([]),
      Promise.all(
        roomArtists.map((ra) => getArtistTopTracks(ra, 4)),
      ).then((lists) => lists.flat()),
    ]);

    const sameArtist = take(artistTracks, BUCKET_SIZE, false);
    const similar = take(
      similarAll.filter((t) => t.artist.toLowerCase() !== artist.toLowerCase()),
      BUCKET_SIZE,
      false,
    );
    const genre = take(genreTracks, BUCKET_SIZE, true);
    const room = take(roomPool, BUCKET_SIZE, true);
    const wildcard = take(chart, BUCKET_SIZE, true);

    const buckets = [sameArtist, similar, genre, room, wildcard];
    const leftover = [
      ...artistTracks,
      ...similarAll,
      ...genreTracks,
      ...roomPool,
      ...chart,
    ];
    const filler = take(leftover, SUGGESTIONS_TOTAL, true);

    const ordered: SimilarTrack[] = [];
    for (let i = 0; i < BUCKET_SIZE; i++) {
      for (const b of buckets) {
        if (b[i]) ordered.push(b[i]!);
      }
    }
    const tracks = [...ordered, ...filler].slice(0, SUGGESTIONS_TOTAL);

    if (tracks.length > 0) {
      const results = await resolveSimilarTracks(tracks);
      return reply.send({
        results,
        nextPageToken: null,
        mode: "similar",
      });
    }
  }

  if (!seed) {
    const chart = await getTopTracksChart();
    if (chart.length > 0) {
      const idx = page.startsWith("s:") ? Number(page.slice(2)) || 0 : 0;
      const slice = chart.slice(idx, idx + SIMILAR_PAGE);
      const results = await resolveSimilarTracks(slice);
      if (results.length > 0) {
        return reply.send({
          results,
          artists: [...new Set(slice.map((t) => t.artist).filter(Boolean))],
          nextPageToken:
            idx + SIMILAR_PAGE < chart.length
              ? `s:${idx + SIMILAR_PAGE}`
              : null,
          mode: "trending",
        });
      }
    }
    const trending = await searchYouTube("OPM videoke classics");
    const resolved =
      trending.results.length > 0
        ? await resolveKaraokeVersions(trending.results.slice(0, 6))
        : [];
    const results =
      resolved.length > 0
        ? resolved
        : karaokeOnly(trending.results).slice(0, 6);
    if (results.length > 0) {
      return reply.send({
        results,
        artists: [
          ...new Set(
            results
              .map((r) => cleanArtist(r.channel))
              .filter(Boolean),
          ),
        ],
        nextPageToken: null,
        mode: "trending",
      });
    }
  }

  const { results, nextPageToken } = await searchYouTube(
    seed || "OPM videoke classics",
  );
  const filtered = karaokeOnly(results);
  reply.send({
    results: filtered,
    artists: [
      ...new Set(filtered.map((r) => cleanArtist(r.channel)).filter(Boolean)),
    ],
    nextPageToken: nextPageToken ? `y:${nextPageToken}` : null,
    mode: "title",
  });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: true },
});

function broadcastRoom(io: Server, code: string): void {
  const room = getRoom(code);
  if (!room) return;
  io.to(code).emit("roomState", publicState(room));
}

interface SocketData {
  roomCode: string | null;
  nickname: string | null;
}

io.on("connection", (socket) => {
  socket.data.roomCode = null;
  socket.data.nickname = null;

  socket.on("room:create", (callback) => {
    const room = createRoom();
    room.hostSocketId = socket.id;
    touchRoom(room);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    callback({ code: room.code, hostToken: room.hostToken });
  });

  // Validation-only: Home checks the code/token before mounting the room
  // view; the actual join (and its announcement) happens once, in the view.
  socket.on("room:check", (code, hostToken, callback) => {
    const room = getRoom(code);
    if (!room) {
      callback({ ok: false, error: "Room not found — check the code" });
      return;
    }
    if (hostToken && hostToken !== room.hostToken) {
      callback({ ok: false, error: "Host session expired" });
      return;
    }
    callback({ ok: true });
  });

  socket.on("room:join", (code, nickname, hostToken, callback) => {
    const room = getRoom(code);
    if (!room) {
      callback({ ok: false, error: "Room not found — check the code" });
      return;
    }
    const cleanNickname = nickname.trim().slice(0, 20);
    if (!cleanNickname) {
      callback({ ok: false, error: "Hostname required" });
      return;
    }
    if (hostToken && hostToken === room.hostToken) {
      room.hostSocketId = socket.id;
    }
    const isHost = !!hostToken && hostToken === room.hostToken;
    // A prior seat for this nickname is a returning client (backgrounded
    // tab, refresh, or re-join after a socket drop) — not a new join.
    const isRejoin = removeStaleSelf(room, cleanNickname) > 0;
    room.participants.set(socket.id, {
      socketId: socket.id,
      nickname: cleanNickname,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      disconnectedAt: null,
      lastScore: null,
    });
    touchRoom(room);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.nickname = cleanNickname;
    callback({ ok: true });
    if (!isHost && !isRejoin) {
      io.to(room.code).emit("participantJoined", cleanNickname);
    }
    io.to(room.code).emit("roomState", publicState(room));
    if (isHost) {
      if (room.playerState) socket.emit("playerState", room.playerState);
    } else {
      socket.emit(
        "playerState",
        room.playerState ?? {
          videoId: room.nowPlaying?.videoId ?? null,
          playing: false,
          positionSec: 0,
          durationSec: room.nowPlaying?.durationSec ?? 0,
          repeatOn: false,
        },
      );
    }
  });

  socket.on("room:leave", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const left = removeParticipant(room, socket.id);
    if (left) io.to(code).emit("participantLeft", left);
    socket.leave(code);
  });

  socket.on("room:end", (token, callback) => {
    const code = socket.data.roomCode;
    if (!code) {
      callback({ ok: false });
      return;
    }
    const room = getRoom(code);
    if (!room || token !== room.hostToken) {
      callback({ ok: false });
      return;
    }
    io.to(code).emit("error", "Room ended");
    deleteRoom(code);
    socket.data.roomCode = null;
    callback({ ok: true });
  });

  socket.on("queue:add", (item, callback) => {
    const code = socket.data.roomCode;
    if (!code) {
      callback({ ok: false, error: "Not in a room" });
      return;
    }
    const room = getRoom(code);
    if (!room) {
      callback({ ok: false, error: "Room closed" });
      return;
    }
    if (room.queue.length >= MAX_QUEUE_SIZE) {
      callback({ ok: false, error: "Queue is full — 50 songs max" });
      return;
    }
    const queueItem: QueueItem = {
      id: randomBytes(8).toString("hex"),
      videoId: item.videoId,
      title: item.title,
      channel: item.channel,
      durationSec: item.durationSec ?? 0,
      thumbnail: item.thumbnail,
      addedBy: socket.data.nickname ?? "Guest",
      state: "queued",
    };
    room.queue.push(queueItem);
    touchRoom(room);
    callback({ ok: true, position: room.queue.length });
    io.to(code).emit("roomState", publicState(room));
  });

  // Any room participant (host or guest) may reorder the shared queue.
  socket.on("queue:reorder", (itemId, toIndex) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    if (reorderQueueItem(room, itemId, toIndex)) {
      touchRoom(room);
      io.to(code).emit("roomState", publicState(room));
    }
  });

  socket.on("host:action", (token, action) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || token !== room.hostToken) return;
    applyHostAction(room, action as HostAction);
    io.to(code).emit("roomState", publicState(room));
  });

  socket.on("host:score", (token, nickname, score) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || token !== room.hostToken) return;
    const cleanNickname = String(nickname).trim().slice(0, 20);
    const boundedScore = Math.max(0, Math.min(100, Math.round(Number(score))));
    if (!cleanNickname || !Number.isFinite(boundedScore)) return;
    scoreParticipant(room, cleanNickname, boundedScore);
    io.to(code).emit("roomState", publicState(room));
  });

  socket.on("player:state", (token, state: PlayerState) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || token !== room.hostToken) return;
    touchRoom(room);
    room.playerState = state;
    socket.to(code).emit("playerState", state);
  });

  socket.on("room:ping", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    const participant = room?.participants.get(socket.id);
    if (participant) participant.lastSeen = Date.now();
  });

  socket.on("guest:action", (action: GuestAction) => {
    const code = socket.data.roomCode;
    const nickname = socket.data.nickname;
    if (!code || !nickname) return;
    const room = getRoom(code);
    if (!room) return;
    touchRoom(room);
    io.to(code).emit("playerControl", action, nickname);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    // Mobile browsers kill the socket the moment the tab is backgrounded.
    // Keep the seat for the grace period; the client rejoins on its next
    // connection and the sweep gives it up if they never come back.
    markDisconnected(room, socket.id);
  });
});

setInterval(() => {
  const { expiredRooms, leftParticipants } = sweepRooms();
  for (const { code, nickname, wasHost } of leftParticipants) {
    io.to(code).emit("participantLeft", nickname);
    if (wasHost) {
      const room = getRoom(code);
      const st = room?.playerState;
      if (room && st) {
        io.to(code).emit("playerState", { ...st, playing: false });
      }
    }
    broadcastRoom(io, code);
  }
  for (const code of expiredRooms) {
    io.to(code).emit("error", "Room expired");
  }
}, 60 * 1000).unref();

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}