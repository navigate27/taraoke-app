import { describe, expect, it } from "vitest";
import type { QueueItem } from "../shared/types";
import { advanceQueue, createRoom } from "./rooms";

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