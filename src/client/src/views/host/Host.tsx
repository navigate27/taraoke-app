import { useEffect, useRef, useState } from "react";
import type {
  GuestAction,
  PlayerState,
  PublicRoomState,
  QueueItem,
} from "../../../../shared/types";
import type { SearchResult } from "../../../../server/youtube";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { JoinPanel } from "../../components/JoinPanel";
import { RoomHeader } from "../../components/RoomHeader";
import { SongsSearchModal } from "../../components/SongsSearchModal";
import { socket } from "../../lib/socket";
import {
  formatClock,
  loadYouTubeApi,
  YTEvents,
  type YTPlayer,
} from "../../lib/youtube";
import { HostPlayerPanel } from "./HostPlayerPanel";
import { HostQueuePanel } from "./HostQueuePanel";

const HOST_KEY = "taraoke.host";

export function saveHost(code: string, token: string, name: string): void {
  localStorage.setItem(HOST_KEY, JSON.stringify({ code, token, name }));
}

export function clearHost(): void {
  localStorage.removeItem(HOST_KEY);
}

export function loadHost(): { code: string; token: string; name?: string } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOST_KEY) ?? "");
    if (typeof parsed?.code === "string" && typeof parsed?.token === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

interface Props {
  code: string;
  token: string;
  nickname: string;
  onExit: () => void;
}

export function Host({ code, token, nickname, onExit }: Props) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState("--:--");
  const [progress, setProgress] = useState(0);
  const [endConfirm, setEndConfirm] = useState(false);
  const [playNowItem, setPlayNowItem] = useState<QueueItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [repeatOn, setRepeatOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const mutedRef = useRef(true);
  const playerRef = useRef<YTPlayer | null>(null);
  const playingRef = useRef(false);
  const readyRef = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const resumeRef = useRef<{ positionSec: number; playing: boolean } | null>(null);
  const repeatRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<PublicRoomState | null>(null);
  const videoId = state?.nowPlaying?.videoId ?? null;

  stateRef.current = state;

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    socket.emit("room:join", code, nickname, token, (res) => {
      if (!res.ok) onExit();
    });
    const pingTimer = window.setInterval(() => socket.emit("room:ping"), 25000);
    const onRoomState = (s: PublicRoomState) => setState(s);
    const onParticipantJoined = (nickname: string) => {
      showToast(`${nickname} joined the room`);
    };
    const onParticipantLeft = (left: string) => {
      if (left === nickname) return;
      showToast(`${left} left the room`);
    };
    const onPlayerState = (p: PlayerState) => {
      resumeRef.current = { positionSec: p.positionSec, playing: p.playing };
      repeatRef.current = p.repeatOn;
      setRepeatOn(p.repeatOn);
    };
    const onPlayerControl = (action: GuestAction) => {
      if (action.type === "next") {
        socket.emit("host:action", token, { type: "next" });
        return;
      }
      if (action.type === "repeat") {
        repeatRef.current = action.on;
        setRepeatOn(action.on);
        if (action.on) {
          const player = playerRef.current;
          if (player && readyRef.current) {
            player.seekTo(0, true);
            player.playVideo();
          }
        }
        return;
      }
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      if (action.type === "play") player.playVideo();
      else if (action.type === "pause") player.pauseVideo();
      else if (action.type === "seek") {
        player.seekTo(Math.max(0, action.positionSec));
      }
    };
    socket.on("roomState", onRoomState);
    socket.on("participantJoined", onParticipantJoined);
    socket.on("participantLeft", onParticipantLeft);
    socket.on("playerState", onPlayerState);
    socket.on("playerControl", onPlayerControl);
    return () => {
      socket.off("roomState", onRoomState);
      socket.off("participantJoined", onParticipantJoined);
      socket.off("participantLeft", onParticipantLeft);
      socket.off("playerState", onPlayerState);
      socket.off("playerControl", onPlayerControl);
      window.clearInterval(pingTimer);
      window.clearTimeout(toastTimer.current);
    };
  }, [code, token, nickname, onExit]);

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      const el = document.createElement("div");
      containerRef.current.appendChild(el);
      player = new YT.Player(el, {
        playerVars: {
          rel: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          playsinline: 1,
          autoplay: 1,
          mute: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (pendingVideoRef.current) {
              player?.loadVideoById(pendingVideoRef.current);
              pendingVideoRef.current = null;
            }
          },
          onStateChange: (e) => {
            const isPlaying = e.data === YTEvents.PLAYING;
            playingRef.current = isPlaying;
            setPlaying(isPlaying);
            if (e.data === YTEvents.ENDED) {
              if (repeatRef.current) {
                player?.seekTo(0, true);
                player?.playVideo();
              } else {
                socket.emit("host:action", token, { type: "next" });
              }
            }
          },
        },
      }) as YTPlayer;
      playerRef.current = player;
      pendingVideoRef.current = stateRef.current?.nowPlaying?.videoId ?? null;
    });
    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      pendingVideoRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!videoId) return;
    if (playerRef.current && readyRef.current) {
      playerRef.current.loadVideoById(videoId);
    } else {
      pendingVideoRef.current = videoId;
    }
  }, [videoId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const position = player.getCurrentTime() || 0;
      const duration = player.getDuration() || 0;
      setRemaining(formatClock(duration - position));
      setProgress(duration ? Math.min(1, position / duration) : 0);
      if (resumeRef.current) {
        if (!playingRef.current) return;
        const resume = resumeRef.current;
        resumeRef.current = null;
        if (resume.positionSec > 0) player.seekTo(resume.positionSec, true);
        if (!resume.playing) player.pauseVideo();
        return;
      }
      socket.emit("player:state", token, {
        videoId: state?.nowPlaying?.videoId ?? null,
        playing: playingRef.current,
        positionSec: position,
        durationSec: duration,
        repeatOn: repeatRef.current,
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [token, state?.nowPlaying?.videoId]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playingRef.current) player.pauseVideo();
    else player.playVideo();
  }

  function toggleRepeat() {
    const next = !repeatRef.current;
    repeatRef.current = next;
    setRepeatOn(next);
    if (next) {
      const player = playerRef.current;
      if (player && readyRef.current) {
        player.seekTo(0, true);
        player.playVideo();
      }
    }
  }

  function seekBy(delta: number) {
    const player = playerRef.current;
    if (!player) return;
    const current = player.getCurrentTime() || 0;
    player.seekTo(Math.max(0, current + delta));
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (mutedRef.current) {
      player.unMute();
      mutedRef.current = false;
      setMuted(false);
    } else {
      player.mute();
      mutedRef.current = true;
      setMuted(true);
    }
  }

  function addToQueue(result: SearchResult) {
    socket.emit(
      "queue:add",
      {
        videoId: result.videoId,
        title: result.title,
        channel: result.channel,
        durationSec: result.durationSec ?? 0,
        thumbnail: result.thumbnail,
      },
      () => {},
    );
  }

  const queue = state?.queue ?? [];
  const history = state?.history ?? [];
  const participants = state?.participants ?? [];
  const nowPlaying = state?.nowPlaying ?? null;
  const addedVideoIds = new Set([
    ...(nowPlaying ? [nowPlaying.videoId] : []),
    ...queue.map((q) => q.videoId),
  ]);

  function playQueueItem(item: QueueItem) {
    if (nowPlaying) setPlayNowItem(item);
    else socket.emit("host:action", token, { type: "play-now", itemId: item.id });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader code={code} remaining={remaining} />

      <main className="grid flex-1 grid-cols-1 items-stretch gap-5 p-6 lg:grid-cols-[300px_1fr_340px]">
        <JoinPanel code={code} participants={participants}>
          <div className="mt-auto pt-4">
            <button
              onClick={() => setEndConfirm(true)}
              className="btn btn-danger w-full px-4 py-3 text-[9px]"
            >
              End room
            </button>
          </div>
        </JoinPanel>

        <HostPlayerPanel
          nowPlaying={nowPlaying}
          playing={playing}
          remaining={remaining}
          progress={progress}
          muted={muted}
          repeatOn={repeatOn}
          containerRef={containerRef}
          onTogglePlay={togglePlay}
          onToggleRepeat={toggleRepeat}
          onSeek={seekBy}
          onToggleMute={toggleMute}
          onNext={() => socket.emit("host:action", token, { type: "next" })}
        />

        <HostQueuePanel
          token={token}
          queue={queue}
          history={history}
          nowPlaying={nowPlaying}
          addedVideoIds={addedVideoIds}
          onPlayItem={playQueueItem}
          onAddSong={() => setSearchOpen(true)}
          onReadd={addToQueue}
        />
      </main>

      {searchOpen && (
        <SongsSearchModal
          onClose={() => setSearchOpen(false)}
          onAdd={addToQueue}
          addedVideoIds={addedVideoIds}
        />
      )}

      {toast && (
        <div
          className="crt fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-[4px] border-[3px] border-cyan-500 px-5 py-3 text-sm font-semibold text-cyan-500 [box-shadow:0_0_14px_rgba(62,240,255,.4)]"
          role="status"
        >
          {toast}
        </div>
      )}

      {endConfirm && (
        <ConfirmDialog
          title="End room?"
          message="Everyone leaves and the queue is gone. This can't be undone."
          confirmLabel="End room"
          cancelLabel="Keep playing"
          danger
          onConfirm={() => {
            socket.emit("room:end", token, (res) => {
              if (res.ok) clearHost();
              onExit();
            });
          }}
          onCancel={() => setEndConfirm(false)}
        />
      )}
      {playNowItem && (
        <ConfirmDialog
          title="Switch songs?"
          message="The current song is still playing. Jump to this one now?"
          confirmLabel="Play it now"
          cancelLabel="Keep current"
          onConfirm={() => {
            socket.emit("host:action", token, {
              type: "play-now",
              itemId: playNowItem.id,
            });
            setPlayNowItem(null);
          }}
          onCancel={() => setPlayNowItem(null)}
        />
      )}
    </div>
  );
}