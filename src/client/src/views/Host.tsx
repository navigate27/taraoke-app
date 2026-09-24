import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type {
  GuestAction,
  PublicRoomState,
  QueueItem,
} from "../../../shared/types";
import type { SearchResult } from "../../../server/youtube";
import { Check, Volume2, VolumeX } from "pixelarticons/react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ParticipantChips } from "../components/ParticipantChips";
import { SongsSearchModal } from "../components/SongsSearchModal";
import { buildJoinUrl } from "../lib/joinUrl";
import { socket } from "../lib/socket";
import {
  formatClock,
  loadYouTubeApi,
  YTEvents,
  type YTPlayer,
} from "../lib/youtube";

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
  const [qrUrl, setQrUrl] = useState("");
  const [endConfirm, setEndConfirm] = useState(false);
  const [playNowItem, setPlayNowItem] = useState<QueueItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [joinToast, setJoinToast] = useState<string | null>(null);
  const joinToastTimer = useRef<number | undefined>(undefined);
  const mutedRef = useRef(true);
  const playerRef = useRef<YTPlayer | null>(null);
  const playingRef = useRef(false);
  const readyRef = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const pendingDragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<PublicRoomState | null>(null);
  const videoId = state?.nowPlaying?.videoId ?? null;

  stateRef.current = state;

  useEffect(() => {
    socket.emit("room:join", code, nickname, token, (res) => {
      if (!res.ok) onExit();
    });
    const onRoomState = (s: PublicRoomState) => setState(s);
    const onParticipantJoined = (nickname: string) => {
      setJoinToast(`${nickname} joined the room`);
      window.clearTimeout(joinToastTimer.current);
      joinToastTimer.current = window.setTimeout(() => setJoinToast(null), 3000);
    };
    const onPlayerControl = (action: GuestAction) => {
      if (action.type === "next") {
        socket.emit("host:action", token, { type: "next" });
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
    socket.on("playerControl", onPlayerControl);
    return () => {
      socket.off("roomState", onRoomState);
      socket.off("participantJoined", onParticipantJoined);
      socket.off("playerControl", onPlayerControl);
    };
  }, [code, token, nickname, onExit]);

  useEffect(() => {
    buildJoinUrl(code)
      .then((url) =>
        QRCode.toDataURL(url, {
          margin: 1,
          color: { dark: "#3EF0FF", light: "#05030C" },
        }),
      )
      .then(setQrUrl)
      .catch(() => {});
  }, [code]);

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
              socket.emit("host:action", token, { type: "next" });
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
      socket.emit("player:state", token, {
        videoId: state?.nowPlaying?.videoId ?? null,
        playing: playingRef.current,
        positionSec: position,
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [token, state?.nowPlaying?.videoId]);

  useEffect(() => {
    function rowAt(clientY: number): HTMLElement | null {
      const rows = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Song queue"] [data-next-list] > div',
        ),
      ];
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) return row;
      }
      return null;
    }

    function onPointerMove(e: PointerEvent) {
      const pending = pendingDragRef.current;
      if (!pending) return;
      let ghost = ghostRef.current;
      if (!ghost) {
        if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < 6) return;
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            '[aria-label="Song queue"] [data-next-list] > div',
          ),
        ];
        const row = rows[pending.index];
        if (!row) return;
        const rect = row.getBoundingClientRect();
        pending.offsetX = e.clientX - rect.left;
        pending.offsetY = e.clientY - rect.top;
        ghost = row.cloneNode(true) as HTMLElement;
        ghost.style.position = "fixed";
        ghost.style.width = `${rect.width}px`;
        ghost.style.margin = "0";
        ghost.style.pointerEvents = "none";
        ghost.style.opacity = "0.9";
        ghost.style.zIndex = "60";
        ghost.style.transform = "rotate(4deg)";
        ghost.style.left = `${e.clientX - pending.offsetX}px`;
        ghost.style.top = `${e.clientY - pending.offsetY}px`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        setDraggingIndex(pending.index);
        return;
      }
      ghost.style.left = `${e.clientX - pending.offsetX}px`;
      ghost.style.top = `${e.clientY - pending.offsetY}px`;
      const over = rowAt(e.clientY);
      setDragOverIndex(over ? [...(over.parentNode?.childNodes ?? [])].indexOf(over) : null);
    }

    function onPointerUp(e: PointerEvent) {
      const pending = pendingDragRef.current;
      const ghost = ghostRef.current;
      pendingDragRef.current = null;
      if (!ghost) return;
      ghost.remove();
      ghostRef.current = null;
      const from = pending?.index ?? null;
      const target = rowAt(e.clientY);
      let to: number | null = null;
      if (target) {
        to = [...(target.parentNode?.childNodes ?? [])].indexOf(target);
      }
      if (from !== null && to !== null && from !== to) {
        const dragged = queueRef.current[from];
        if (dragged) {
          socket.emit("host:action", token, {
            type: "reorder",
            itemId: dragged.id,
            toIndex: to,
          });
        }
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [token]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playingRef.current) player.pauseVideo();
    else player.playVideo();
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

  queueRef.current = queue;

  function playQueueItem(item: QueueItem) {
    if (nowPlaying) setPlayNowItem(item);
    else socket.emit("host:action", token, { type: "play-now", itemId: item.id });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="crt scanlines mx-6 mt-4 flex items-center justify-between gap-4 rounded-[4px] border-[3px] border-cab-700 px-5 py-3"
        aria-label="Room status"
      >
        <span className="font-press text-[14px] text-neon-500 [text-shadow:0_0_10px_rgba(228,59,255,.8),2px_2px_0_#4A0E5C]">
          ★ Taraoke ★
        </span>
        <span className="font-press text-[14px] text-cyan-500 [text-shadow:0_0_10px_rgba(62,240,255,.7)]">
          {code}
        </span>
        <span className="font-press text-[14px] text-gold-500 [text-shadow:0_0_10px_rgba(255,210,62,.6)]">
          {remaining}
        </span>
      </header>

      <main className="grid flex-1 grid-cols-1 items-stretch gap-5 p-6 lg:grid-cols-[300px_1fr_340px]">
        <section className="panel flex flex-col p-5" aria-label="Join the room">
          <h2 className="mb-4 font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]">
            Join the room
          </h2>
          {qrUrl ? (
            <div className="crt flex justify-center rounded-[4px] border-[3px] border-cab-700 p-4">
              <img src={qrUrl} alt={`Room code ${code}`} width={150} height={150} />
            </div>
          ) : (
            <div className="crt h-[182px] rounded-[4px] border-[3px] border-cab-700" />
          )}
          <p className="mt-4 text-center font-press text-[22px] text-cyan-500 [text-shadow:0_0_8px_rgba(62,240,255,.7)]">
            {code}
          </p>
          <p className="mt-2 text-center text-sm text-arc-500">
            Scan the QR or type the room code
          </p>
          <p className="coin-blink mt-3 text-center font-press text-[9px] text-gold-500">
            Insert coin to join
          </p>
          <ParticipantChips participants={participants} />
          <button
            onClick={() => setEndConfirm(true)}
            className="btn btn-danger mt-auto px-4 py-3 text-[9px]"
          >
            End room
          </button>
        </section>

        <section className="panel flex flex-col gap-4 p-5" aria-label="Now playing">
          <div className="crt scanlines relative min-h-[280px] flex-1 overflow-hidden rounded-[4px] border-[3px] border-cab-700">
            {nowPlaying && (
              <span className="absolute top-4 right-4 z-10 rounded-[4px] border-2 border-red-700 bg-red-500 px-3 py-2 font-press text-[10px] text-white [text-shadow:2px_2px_0_#7A1030]">
                On air
              </span>
            )}
            <div
              ref={containerRef}
              className="absolute inset-0 flex items-center justify-center [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
            />
            {nowPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause video" : "Play video"}
                className="absolute inset-0 z-[5] cursor-pointer"
              />
            )}
            {nowPlaying && !playing && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center [&>button]:pointer-events-auto">
                <button
                  onClick={togglePlay}
                  aria-label="Play"
                  className="btn btn-primary h-16 w-16"
                >
                  ▶
                </button>
              </div>
            )}
            {!nowPlaying && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-cab-900">
                <p className="text-arc-500">No songs yet — add the first one.</p>
              </div>
            )}
          </div>
          {nowPlaying && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{nowPlaying.title}</p>
                  <p className="text-sm text-arc-500">
                    {nowPlaying.channel} · added by {nowPlaying.addedBy}
                  </p>
                </div>
                <span className="font-press text-[20px] text-gold-500 [text-shadow:0_0_8px_rgba(255,210,62,.55)]">
                  {remaining}
                </span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-[4px] border-[3px] border-cab-700 bg-crt-000">
                <div
                  className="h-full bg-cyan-500 [background-image:repeating-linear-gradient(90deg,#3EF0FF_0_10px,#19B9C9_10px_14px)]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-center gap-4" aria-label="Player controls">
            <button
              onClick={() => seekBy(-10)}
              disabled={!nowPlaying}
              className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
              aria-label="Back 10 seconds"
            >
              -10
            </button>
            <button
              onClick={togglePlay}
              disabled={!nowPlaying}
              className="btn btn-primary h-16 w-16 text-[14px] disabled:opacity-30"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              onClick={() => seekBy(10)}
              disabled={!nowPlaying}
              className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
              aria-label="Forward 10 seconds"
            >
              +10
            </button>
            <button
              onClick={() => socket.emit("host:action", token, { type: "next" })}
              disabled={!nowPlaying}
              className="btn btn-ghost h-14 w-14 disabled:opacity-30"
              aria-label="Next — play the next song"
            >
              ⏭
            </button>
            <button
              onClick={toggleMute}
              disabled={!nowPlaying}
              title={muted ? "Sound off — click to unmute" : "Sound on — click to mute"}
              aria-label={muted ? "Unmute" : "Mute"}
              className={`btn btn-ghost h-14 w-14 disabled:opacity-30 ${
                muted
                  ? "text-arc-500 opacity-70"
                  : "text-cyan-500 [box-shadow:5px_5px_0_#05030C,0_0_12px_rgba(62,240,255,.45)] [text-shadow:0_0_8px_rgba(62,240,255,.7)]"
              }`}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </section>

        <section className="panel flex flex-col p-5" aria-label="Song queue">
          <div className="flex items-baseline justify-between">
            <h2 className="font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]">
              Queue
            </h2>
            <span className="font-press text-[9px] text-arc-500">
              {queue.length} songs
            </span>
          </div>
          <p className="mt-1 mb-3 font-press text-[8px] tracking-[0.2em] text-gold-500">
            — Today's high scores —
          </p>

          <button
            onClick={() => setSearchOpen(true)}
            className="btn btn-primary mb-3 w-full px-4 py-3 text-[9px]"
          >
            + Add song
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {nowPlaying && (
              <>
                <p className="mt-1 mb-2 font-press text-[8px] tracking-[0.2em] text-red-500">
                  Now playing
                </p>
                <div className="mb-3 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] border-red-500 bg-cab-800 p-2.5">
                  <span className="text-center font-press text-[10px] text-red-500">
                    ♪
                  </span>
                  <img
                    src={nowPlaying.thumbnail}
                    alt=""
                    className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{nowPlaying.title}</p>
                    <p className="text-xs text-arc-500">added by {nowPlaying.addedBy}</p>
                  </div>
                </div>
              </>
            )}
            <p className="mb-2 font-press text-[8px] tracking-[0.2em] text-cyan-500">
              Next
            </p>
            {queue.length === 0 && (
              <p className="mb-3 text-sm text-arc-500">Queue is empty.</p>
            )}
            <div data-next-list>
              {queue.map((item, index) => (
              <div
                key={item.id}
                onPointerDown={(e) => {
                  if (e.button !== 0 || e.pointerType === "touch") return;
                  if ((e.target as HTMLElement).closest("button")) return;
                  pendingDragRef.current = {
                    index,
                    startX: e.clientX,
                    startY: e.clientY,
                    offsetX: 0,
                    offsetY: 0,
                  };
                }}
                className={`mb-2.5 cursor-grab select-none rounded-[4px] border-[3px] bg-cab-800 p-2.5 ${
                  draggingIndex === index
                    ? "border-neon-500 opacity-60 [box-shadow:0_0_12px_rgba(228,59,255,.45)]"
                    : "border-cab-700"
                } ${
                  dragOverIndex === index && draggingIndex !== null && draggingIndex !== index
                    ? "!border-cyan-500 [box-shadow:0_0_12px_rgba(62,240,255,.4)]"
                    : ""
                }`}
              >
                <div className="grid grid-cols-[28px_80px_1fr] items-center gap-3">
                  <span className="text-center font-press text-[12px] text-arc-500">
                    {index + 1}
                  </span>
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-arc-500">added by {item.addedBy}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end gap-2">
                  <button
                    aria-label={`Play ${item.title} now`}
                    onClick={() => playQueueItem(item)}
                    className="btn btn-primary h-10 w-10 p-0 text-[12px]"
                  >
                    ▶
                  </button>
                  <button
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onClick={() =>
                      socket.emit("host:action", token, {
                        type: "reorder",
                        itemId: item.id,
                        toIndex: index - 1,
                      })
                    }
                    className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${item.title} down`}
                    disabled={index === queue.length - 1}
                    onClick={() =>
                      socket.emit("host:action", token, {
                        type: "reorder",
                        itemId: item.id,
                        toIndex: index + 1,
                      })
                    }
                    className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove ${item.title}`}
                    onClick={() =>
                      socket.emit("host:action", token, { type: "remove", itemId: item.id })
                    }
                    className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-red-500"
                  >
                    ✕
                  </button>
                </div>
              </div>
              ))}
            </div>
            {history.length > 0 && (
              <>
                <p className="mt-3 mb-2 font-press text-[8px] tracking-[0.2em] text-arc-500">
                  Played
                </p>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="mb-2.5 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2.5 opacity-60"
                  >
                    <Check className="mx-auto h-4 w-4 text-arc-500" />
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-arc-500">added by {item.addedBy}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </main>

      {searchOpen && (
        <SongsSearchModal
          onClose={() => setSearchOpen(false)}
          onAdd={addToQueue}
          addedVideoIds={addedVideoIds}
        />
      )}

      {joinToast && (
        <div
          className="crt fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-[4px] border-[3px] border-cyan-500 px-5 py-3 text-sm font-semibold text-cyan-500 [box-shadow:0_0_14px_rgba(62,240,255,.4)]"
          role="status"
        >
          {joinToast}
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