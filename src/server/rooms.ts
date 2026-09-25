import { randomBytes } from "node:crypto";
import type {
  HostAction,
  PublicRoomState,
  QueueItem,
  Room,
} from "../shared/types";

const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;
const PARTICIPANT_TIMEOUT_MS = 60 * 1000;
/**
 * Mobile browsers kill the socket as soon as the tab is backgrounded, so a
 * dropped socket gets this long to reconnect before the seat is given up.
 * Owner call (2026-09-26): an hour, to cover long phone switches at a party.
 */
export const RECONNECT_GRACE_MS = 60 * 60 * 1000;

export const MAX_QUEUE_SIZE = 50;

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
    history: [],
    playerState: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase());
}

export function touchRoom(room: Room): void {
  room.lastActivityAt = Date.now();
}

export function publicState(room: Room): PublicRoomState {
  return {
    code: room.code,
    sessionStartedAt: room.createdAt,
    nowPlaying: room.nowPlaying,
    queue: room.queue,
    history: room.history,
    participants: [...room.participants.values()].map((p) => ({
      nickname: p.nickname,
      isHost: p.socketId === room.hostSocketId,
      lastScore: p.lastScore,
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
    pushHistory(room, room.nowPlaying);
    room.nowPlaying = null;
  }
  const next = room.queue.shift();
  if (next) {
    startPlayback(room, next);
  }
}

function pushHistory(room: Room, item: QueueItem): void {
  item.state = "done";
  room.history.unshift(item);
  if (room.history.length > 50) room.history.length = 50;
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
        if (room.nowPlaying) {
          pushHistory(room, room.nowPlaying);
        }
        startPlayback(room, room.queue[idx]!);
        room.queue.splice(idx, 1);
      }
      break;
    }
    case "remove":
      room.queue = room.queue.filter((q) => q.id !== action.itemId);
      break;
    case "clear":
      room.queue = [];
      break;
  }
}

export function reorderQueueItem(
  room: Room,
  itemId: string,
  toIndex: number,
): boolean {
  const idx = room.queue.findIndex((q) => q.id === itemId);
  if (idx < 0) return false;
  const [item] = room.queue.splice(idx, 1);
  room.queue.splice(Math.max(0, Math.min(toIndex, room.queue.length)), 0, item!);
  return true;
}

export function removeParticipant(room: Room, socketId: string): string | null {
  const participant = room.participants.get(socketId);
  if (!participant) return null;
  room.participants.delete(socketId);
  return participant.nickname;
}

export function scoreParticipant(room: Room, nickname: string, score: number): void {
  for (const participant of room.participants.values()) {
    if (participant.nickname === nickname) {
      participant.lastScore = score;
    }
  }
}

export function markDisconnected(room: Room, socketId: string): void {
  const participant = room.participants.get(socketId);
  if (participant) participant.disconnectedAt = Date.now();
}

/**
 * A join with an existing nickname replaces the prior seat — it is the same
 * person returning (backgrounded tab, refresh, or a re-join after a socket
 * drop), not a new participant, so it must not be announced. Also covers the
 * race where the returning client's join beats the server's processing of
 * its old socket's disconnect. Returns how many seats were replaced.
 */
export function removeStaleSelf(room: Room, nickname: string): number {
  let removed = 0;
  for (const [socketId, participant] of room.participants) {
    if (participant.nickname === nickname) {
      room.participants.delete(socketId);
      removed++;
    }
  }
  return removed;
}

export function sweepRooms(): {
  expiredRooms: string[];
  leftParticipants: { code: string; nickname: string; wasHost: boolean }[];
} {
  const now = Date.now();
  const expiredRooms: string[] = [];
  const leftParticipants: { code: string; nickname: string; wasHost: boolean }[] = [];
  for (const [code, room] of rooms) {
    for (const [socketId, participant] of room.participants) {
      const stale =
        participant.disconnectedAt !== null
          ? now - participant.disconnectedAt > RECONNECT_GRACE_MS
          : now - participant.lastSeen > PARTICIPANT_TIMEOUT_MS;
      if (!stale) continue;
      room.participants.delete(socketId);
      const wasHost = room.hostSocketId === socketId;
      if (wasHost) room.hostSocketId = null;
      leftParticipants.push({ code, nickname: participant.nickname, wasHost });
    }
    if (now - room.lastActivityAt > ROOM_IDLE_MS) {
      rooms.delete(code);
      expiredRooms.push(code);
    }
  }
  return { expiredRooms, leftParticipants };
}

export type { HostAction };