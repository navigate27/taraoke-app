import { describe, expect, it } from "vitest";
import type { QueueItem } from "../shared/types";
import { advanceQueue, createRoom, reorderQueueItem } from "./rooms";

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