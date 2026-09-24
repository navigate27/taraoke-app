import { randomBytes } from "node:crypto";
import type {
  HostAction,
  PublicRoomState,
  QueueItem,
  Room,
} from "../shared/types";

const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;
const PARTICIPANT_TIMEOUT_MS = 60 * 1000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const rooms = new Map<string, Room>();

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function createRoom(): Room {
  let code: string;
  do {
    code = `TARA-${randomCode(4)}`;
  } while (rooms.has(code));
  const room: Room = {
    code,
    hostToken: randomBytes(24).toString("hex"),
    hostSocketId: null,
    participants: new Map(),
    queue: [],
    nowPlaying: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function touchRoom(room: Room): void {
  room.lastActivityAt = Date.now();
}

export function publicState(room: Room): PublicRoomState {
  return {
    code: room.code,
    nowPlaying: room.nowPlaying,
    queue: room.queue,
    participants: [...room.participants.values()].map((p) => ({
      nickname: p.nickname,
    })),
  };
}

export function upNextFor(room: Room, nickname: string): QueueItem | null {
  return room.queue[0]?.addedBy === nickname ? room.queue[0]! : null;
}

export function startPlayback(room: Room, item: QueueItem): void {
  item.state = "playing";
  room.nowPlaying = item;
  room.lastActivityAt = Date.now();
}

export function advanceQueue(room: Room): void {
  if (room.nowPlaying) {
    room.nowPlaying.state = "done";
    room.nowPlaying = null;
  }
  const next = room.queue.shift();
  if (next) {
    startPlayback(room, next);
  }
}

export function applyHostAction(room: Room, action: HostAction): void {
  touchRoom(room);
  switch (action.type) {
    case "play":
    case "pause":
      break; // playback control lives on the host device; server only tracks state
    case "skip":
    case "next":
      advanceQueue(room);
      break;
    case "play-now": {
      const idx = room.queue.findIndex((q) => q.id === action.itemId);
      if (idx >= 0) {
        if (room.nowPlaying) room.nowPlaying.state = "done";
        startPlayback(room, room.queue[idx]!);
        room.queue.splice(idx, 1);
      }
      break;
    }
    case "remove":
      room.queue = room.queue.filter((q) => q.id !== action.itemId);
      break;
    case "reorder": {
      const idx = room.queue.findIndex((q) => q.id === action.itemId);
      if (idx >= 0) {
        const [item] = room.queue.splice(idx, 1);
        room.queue.splice(Math.max(0, Math.min(action.toIndex, room.queue.length)), 0, item!);
      }
      break;
    }
    case "clear":
      room.queue = [];
      break;
  }
}

export function removeParticipant(room: Room, socketId: string): string | null {
  const participant = room.participants.get(socketId);
  if (!participant) return null;
  room.participants.delete(socketId);
  return participant.nickname;
}

export function sweepRooms(): string[] {
  const now = Date.now();
  const expired: string[] = [];
  for (const [code, room] of rooms) {
    for (const [socketId, participant] of room.participants) {
      if (now - participant.lastSeen > PARTICIPANT_TIMEOUT_MS) {
        room.participants.delete(socketId);
      }
    }
    if (now - room.lastActivityAt > ROOM_IDLE_MS) {
      rooms.delete(code);
      expired.push(code);
    }
  }
  return expired;
}

export type { HostAction };