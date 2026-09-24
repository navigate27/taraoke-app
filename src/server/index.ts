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
  publicState,
  removeParticipant,
  sweepRooms,
  touchRoom,
} from "./rooms";
import {
  SIMILAR_PAGE,
  cleanArtist,
  getSimilarTracks,
  resolveKaraokeVersions,
  resolveSimilarTracks,
} from "./lastfm";
import {
  getTrendingVideos,
  karaokeOnly,
  resolveYouTubeUrl,
  searchYouTube,
} from "./youtube";

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const HOST = process.env.SERVER_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

const distDir = path.resolve(import.meta.dirname, "../../dist");
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
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

app.get<{
  Querystring: { seed?: string; artist?: string; page?: string };
}>("/api/suggestions", async (req, reply) => {
  const seed = (req.query.seed ?? "").trim().slice(0, 120);
  const artist = cleanArtist((req.query.artist ?? "").trim().slice(0, 120));
  const page = (req.query.page ?? "").trim();

  if (page.startsWith("s:") && artist && seed) {
    const idx = Number(page.slice(2)) || 0;
    const similar = await getSimilarTracks(artist, seed);
    const slice = similar.slice(idx, idx + SIMILAR_PAGE);
    const results = await resolveSimilarTracks(slice);
    return reply.send({
      results,
      nextPageToken:
        idx + SIMILAR_PAGE < similar.length ? `s:${idx + SIMILAR_PAGE}` : null,
      mode: "similar",
    });
  }

  if (artist && seed) {
    const similar = await getSimilarTracks(artist, seed);
    if (similar.length > 0) {
      const results = await resolveSimilarTracks(
        similar.slice(0, SIMILAR_PAGE),
      );
      return reply.send({
        results,
        nextPageToken:
          similar.length > SIMILAR_PAGE ? `s:${SIMILAR_PAGE}` : null,
        mode: "similar",
      });
    }
  }

  if (!seed) {
    const trending = await getTrendingVideos(
      "PH",
      page.startsWith("y:") ? page.slice(2) : undefined,
    );
    if (trending.results.length > 0) {
      const results = await resolveKaraokeVersions(
        trending.results.slice(0, 6),
      );
      return reply.send({
        results,
        nextPageToken: trending.nextPageToken
          ? `y:${trending.nextPageToken}`
          : null,
        mode: "trending",
      });
    }
  }

  const { results, nextPageToken } = await searchYouTube(
    seed || "OPM videoke classics",
    page.startsWith("y:") ? page.slice(2) : undefined,
  );
  const filtered = karaokeOnly(results);
  reply.send({
    results: filtered,
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
    room.participants.set(socket.id, {
      socketId: socket.id,
      nickname: cleanNickname,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    touchRoom(room);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.nickname = cleanNickname;
    callback({ ok: true });
    if (!(hostToken && hostToken === room.hostToken)) {
      io.to(room.code).emit("participantJoined", cleanNickname);
    }
    io.to(room.code).emit("roomState", publicState(room));
    if (isHost) {
      if (room.playerState) socket.emit("playerState", room.playerState);
    } else {
      socket.emit("playerState", {
        videoId: room.nowPlaying?.videoId ?? null,
        playing: false,
        positionSec: 0,
        durationSec: room.nowPlaying?.durationSec ?? 0,
        repeatOn: false,
      });
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

  socket.on("host:action", (token, action) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || token !== room.hostToken) return;
    applyHostAction(room, action as HostAction);
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
    if (!room || room.nowPlaying?.addedBy !== nickname) return;
    touchRoom(room);
    io.to(code).emit("playerControl", action, nickname);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      const st = room.playerState;
      if (st) {
        io.to(code).emit("playerState", { ...st, playing: false });
      }
    }
    const left = removeParticipant(room, socket.id);
    if (left) io.to(code).emit("participantLeft", left);
    io.to(code).emit("roomState", publicState(room));
  });
});

setInterval(() => {
  const { expiredRooms, leftParticipants } = sweepRooms();
  for (const { code, nickname } of leftParticipants) {
    io.to(code).emit("participantLeft", nickname);
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