export type QueueItemState = "queued" | "playing" | "done" | "skipped";

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  durationSec: number;
  thumbnail: string;
  addedBy: string;
  state: QueueItemState;
}

export interface Participant {
  socketId: string;
  nickname: string;
  joinedAt: number;
  lastSeen: number;
  /** Timestamp of a dropped socket; null while the socket is connected. */
  disconnectedAt: number | null;
  /** Score from the singer's most recent revealed performance; null if none. */
  lastScore: number | null;
}

export interface Room {
  code: string;
  hostToken: string;
  hostSocketId: string | null;
  participants: Map<string, Participant>;
  queue: QueueItem[];
  nowPlaying: QueueItem | null;
  history: QueueItem[];
  playerState: PlayerState | null;
  createdAt: number;
  lastActivityAt: number;
}

export interface PublicRoomState {
  code: string;
  /** Room creation time (ms) — drives the session runtime clock. */
  sessionStartedAt: number;
  nowPlaying: QueueItem | null;
  queue: QueueItem[];
  history: QueueItem[];
  participants: {
    nickname: string;
    isHost: boolean;
    lastScore: number | null;
  }[];
}

export interface PlayerState {
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  repeatOn: boolean;
}

export type HostAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "skip" }
  | { type: "next" }
  | { type: "play-now"; itemId: string }
  | { type: "remove"; itemId: string }
  | { type: "clear" };

export type GuestAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; positionSec: number }
  | { type: "next" }
  | { type: "repeat"; on: boolean };

export type ServerToClientEvents = {
  roomState: (state: PublicRoomState) => void;
  playerState: (state: PlayerState) => void;
  playerControl: (action: GuestAction, by: string) => void;
  participantJoined: (nickname: string) => void;
  participantLeft: (nickname: string) => void;
  error: (message: string) => void;
};

export type ClientToServerEvents = {
  "room:create": (
    callback: (res: { code: string; hostToken: string }) => void,
  ) => void;
  "room:join": (
    code: string,
    nickname: string,
    hostToken: string | null,
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  /** Validation only — no room membership, no participantJoined broadcast. */
  "room:check": (
    code: string,
    hostToken: string | null,
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "room:leave": () => void;
  "room:end": (
    token: string,
    callback: (res: { ok: boolean }) => void,
  ) => void;
  /** Host reports a performance score once its reveal animation finishes. */
  "host:score": (token: string, nickname: string, score: number) => void;
  "host:action": (token: string, action: HostAction) => void;
  "player:state": (token: string, state: PlayerState) => void;
  "guest:action": (action: GuestAction) => void;
  "queue:add": (
    item: {
      videoId: string;
      title: string;
      channel: string;
      durationSec: number;
      thumbnail: string;
    },
    callback: (res: { ok: boolean; position?: number; error?: string }) => void,
  ) => void;
  "queue:reorder": (itemId: string, toIndex: number) => void;
  "room:ping": () => void;
};