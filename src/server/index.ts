import { randomBytes } from "node:crypto";
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
  HostAction,
  PlayerState,
  QueueItem,
  ServerToClientEvents,
} from "../shared/types";
import {
  advanceQueue,
  applyHostAction,
  createRoom,
  getRoom,
  publicState,
  removeParticipant,
  sweepRooms,
  touchRoom,
} from "./rooms";
import { resolveYouTubeUrl, searchYouTube } from "./youtube";

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const HOST = process.env.SERVER_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

const distDir = path.resolve(import.meta.dirname, "../../dist");
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
}

app.get("/api/health", async () => ({ ok: true }));

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
    const cleanNickname = nickname.trim().slice(0, 20) || "Guest";
    if (hostToken && hostToken === room.hostToken) {
      room.hostSocketId = socket.id;
    }
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
    io.to(room.code).emit("participantJoined", cleanNickname);
    socket.emit("roomState", publicState(room));
    socket.emit("playerState", {
      videoId: room.nowPlaying?.videoId ?? null,
      playing: false,
      positionSec: 0,
    });
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
    socket.to(code).emit("playerState", state);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = null;
    }
    const left = removeParticipant(room, socket.id);
    if (left) io.to(code).emit("participantLeft", left);
    io.to(code).emit("roomState", publicState(room));
  });
});

setInterval(() => {
  for (const code of sweepRooms()) {
    io.to(code).emit("error", "Room expired");
  }
}, 60 * 1000).unref();

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}