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
import { normalizeTitle } from "../../../../shared/songTitle";
import { socket } from "../../lib/socket";
import { formatClock } from "../../lib/formatClock";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playingRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const resumeRef = useRef<{ positionSec: number; playing: boolean } | null>(null);
  const repeatRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoId = state?.nowPlaying?.videoId ?? null;

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
          const video = videoRef.current;
          if (video) {
            video.currentTime = 0;
            video.play().catch(() => {});
          }
        }
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      if (action.type === "play") video.play().catch(() => {});
      else if (action.type === "pause") video.pause();
      else if (action.type === "seek" && video.readyState >= 1) {
        video.currentTime = Math.max(0, action.positionSec);
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

  function handleVideoPlay() {
    playingRef.current = true;
    setPlaying(true);
  }

  function handleVideoPause() {
    playingRef.current = false;
    setPlaying(false);
  }

  function handleVideoEnded() {
    const video = videoRef.current;
    if (repeatRef.current && video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      socket.emit("host:action", token, { type: "next" });
    }
  }

  function handleVideoError() {
    const video = videoRef.current;
    if (!video || !video.src || errorRetriedRef.current) return;
    errorRetriedRef.current = true;
    video.src = `${video.src}${video.src.includes("?") ? "&" : "?"}r=${Date.now()}`;
    video.play().catch(() => {});
  }

  useEffect(() => {
    errorRetriedRef.current = false;
  }, [videoId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const position = video.currentTime || 0;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      setRemaining(formatClock(duration - position));
      setProgress(duration ? Math.min(1, position / duration) : 0);
      if (resumeRef.current) {
        if (!playingRef.current) return;
        const resume = resumeRef.current;
        resumeRef.current = null;
        if (resume.positionSec > 0 && video.readyState >= 1) {
          video.currentTime = resume.positionSec;
        }
        if (!resume.playing) video.pause();
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
    const video = videoRef.current;
    if (!video) return;
    if (playingRef.current) video.pause();
    else video.play().catch(() => {});
  }

  function toggleRepeat() {
    const next = !repeatRef.current;
    repeatRef.current = next;
    setRepeatOn(next);
    if (next) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }
  }

  function seekBy(delta: number) {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;
    video.currentTime = Math.max(0, video.currentTime + delta);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    mutedRef.current = !mutedRef.current;
    video.muted = mutedRef.current;
    setMuted(mutedRef.current);
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
  const addedTitles = new Set(
    [nowPlaying?.title, ...queue.map((q) => q.title)]
      .filter((t): t is string => !!t)
      .map(normalizeTitle)
      .filter((t) => t.length > 0),
  );

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
              data-testid="host-btn-end-room"
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
          videoRef={videoRef}
          onVideoPlay={handleVideoPlay}
          onVideoPause={handleVideoPause}
          onVideoEnded={handleVideoEnded}
          onVideoError={handleVideoError}
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
          addedTitles={addedTitles}
          onPlayItem={playQueueItem}
          onAddSong={() => setSearchOpen(true)}
          onReadd={addToQueue}
          onSuggestionAdd={addToQueue}
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
          data-testid="toast"
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
          testIdPrefix="end-room"
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
          testIdPrefix="play-now"
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