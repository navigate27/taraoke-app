import { describe, expect, it } from "vitest";
import type { QueueItem } from "../shared/types";
import {
  advanceQueue,
  createRoom,
  markDisconnected,
  publicState,
  RECONNECT_GRACE_MS,
  removeStaleSelf,
  reorderQueueItem,
  scoreParticipant,
  sweepRooms,
} from "./rooms";

function join(
  room: ReturnType<typeof createRoom>,
  socketId: string,
  nickname: string,
): void {
  room.participants.set(socketId, {
    socketId,
    nickname,
    joinedAt: 0,
    lastSeen: Date.now(),
    disconnectedAt: null,
    lastScore: null,
  });
}

function fakeItem(n: number): QueueItem {
  return {
    id: `item-${n}`,
    videoId: `vid${n}`,
    title: `Song ${n}`,
    channel: "ch",
    durationSec: 60,
    thumbnail: "",
    addedBy: "Host",
    state: "queued",
  };
}

describe("reorderQueueItem", () => {
  it("moves an item to the target index", () => {
    const room = createRoom();
    room.queue = [fakeItem(1), fakeItem(2), fakeItem(3)];
    expect(reorderQueueItem(room, "item-3", 0)).toBe(true);
    expect(room.queue.map((q) => q.id)).toEqual(["item-3", "item-1", "item-2"]);
  });

  it("clamps out-of-range target indices", () => {
    const room = createRoom();
    room.queue = [fakeItem(1), fakeItem(2)];
    expect(reorderQueueItem(room, "item-1", 99)).toBe(true);
    expect(room.queue.map((q) => q.id)).toEqual(["item-2", "item-1"]);
    expect(reorderQueueItem(room, "item-2", -5)).toBe(true);
    expect(room.queue.map((q) => q.id)).toEqual(["item-2", "item-1"]);
  });

  it("returns false for unknown item ids", () => {
    const room = createRoom();
    room.queue = [fakeItem(1)];
    expect(reorderQueueItem(room, "nope", 0)).toBe(false);
    expect(room.queue.map((q) => q.id)).toEqual(["item-1"]);
  });
});

describe("advanceQueue", () => {
  it("caps history at 50 entries, dropping the oldest", () => {
    const room = createRoom();
    for (let i = 0; i < 55; i++) {
      room.nowPlaying = fakeItem(i);
      advanceQueue(room);
    }
    expect(room.history).toHaveLength(50);
    expect(room.history[0]!.title).toBe("Song 54");
    expect(room.history[49]!.title).toBe("Song 5");
  });
});

describe("markDisconnected", () => {
  it("keeps a disconnected guest in the room during the grace period", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    markDisconnected(room, "s1");
    const { leftParticipants } = sweepRooms();
    expect(leftParticipants).toEqual([]);
    expect(room.participants.get("s1")?.nickname).toBe("Ana");
  });

  it("removes a disconnected guest once the grace period elapses", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    markDisconnected(room, "s1");
    room.participants.get("s1")!.disconnectedAt =
      Date.now() - RECONNECT_GRACE_MS - 1000;
    const { leftParticipants } = sweepRooms();
    expect(leftParticipants).toEqual([
      { code: room.code, nickname: "Ana", wasHost: false },
    ]);
    expect(room.participants.has("s1")).toBe(false);
  });

  it("a connected guest with fresh lastSeen survives the sweep", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    const { leftParticipants } = sweepRooms();
    expect(leftParticipants).toEqual([]);
    expect(room.participants.has("s1")).toBe(true);
  });

  it("sweeping a disconnected host clears hostSocketId and flags wasHost", () => {
    const room = createRoom();
    join(room, "s1", "Host");
    room.hostSocketId = "s1";
    markDisconnected(room, "s1");
    room.participants.get("s1")!.disconnectedAt =
      Date.now() - RECONNECT_GRACE_MS - 1000;
    const { leftParticipants } = sweepRooms();
    expect(leftParticipants).toEqual([
      { code: room.code, nickname: "Host", wasHost: true },
    ]);
    expect(room.hostSocketId).toBeNull();
  });
});

describe("publicState", () => {
  it("exposes the session start time for the room clock", () => {
    const room = createRoom();
    expect(publicState(room).sessionStartedAt).toBe(room.createdAt);
  });
});

describe("scoreParticipant", () => {
  it("records the singer's latest score, replacing older ones", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    scoreParticipant(room, "Ana", 88);
    expect(room.participants.get("s1")!.lastScore).toBe(88);
    scoreParticipant(room, "Ana", 72);
    expect(room.participants.get("s1")!.lastScore).toBe(72);
  });

  it("only touches the matching participant", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    join(room, "s2", "Bob");
    scoreParticipant(room, "Ana", 91);
    expect(room.participants.get("s2")!.lastScore).toBeNull();
  });

  it("ignores scores for people no longer in the room", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    room.participants.delete("s1");
    expect(() => scoreParticipant(room, "Ana", 75)).not.toThrow();
    expect(room.participants.size).toBe(0);
  });

  it("publicState exposes each participant's last score", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    join(room, "s2", "Bob");
    scoreParticipant(room, "Bob", 83);
    const list = publicState(room).participants;
    expect(list.find((p) => p.nickname === "Ana")?.lastScore).toBeNull();
    expect(list.find((p) => p.nickname === "Bob")!.lastScore).toBe(83);
  });
});

describe("removeStaleSelf", () => {
  it("replaces the prior seat for the same nickname, disconnected or not", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    markDisconnected(room, "s1");
    join(room, "s2", "Bob");
    join(room, "s3", "Ana");
    expect(removeStaleSelf(room, "Ana")).toBe(2);
    expect(room.participants.has("s1")).toBe(false);
    expect(room.participants.has("s3")).toBe(false);
    expect(room.participants.has("s2")).toBe(true);
  });

  it("replaces a connected duplicate (returning join beat the disconnect)", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    expect(removeStaleSelf(room, "Ana")).toBe(1);
    expect(room.participants.has("s1")).toBe(false);
  });

  it("returns 0 when there is no prior entry (a genuinely new join)", () => {
    const room = createRoom();
    join(room, "s1", "Ana");
    expect(removeStaleSelf(room, "Bob")).toBe(0);
    expect(room.participants.has("s1")).toBe(true);
  });
});