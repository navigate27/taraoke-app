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
}

export interface Room {
  code: string;
  hostToken: string;
  hostSocketId: string | null;
  participants: Map<string, Participant>;
  queue: QueueItem[];
  nowPlaying: QueueItem | null;
  history: QueueItem[];
  createdAt: number;
  lastActivityAt: number;
}

export interface PublicRoomState {
  code: string;
  nowPlaying: QueueItem | null;
  queue: QueueItem[];
  history: QueueItem[];
  participants: { nickname: string; isHost: boolean }[];
}

export interface PlayerState {
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
}

export type HostAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "skip" }
  | { type: "next" }
  | { type: "play-now"; itemId: string }
  | { type: "remove"; itemId: string }
  | { type: "reorder"; itemId: string; toIndex: number }
  | { type: "clear" };

export type GuestAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; positionSec: number }
  | { type: "next" };

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
  "room:leave": () => void;
  "room:end": (
    token: string,
    callback: (res: { ok: boolean }) => void,
  ) => void;
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
};