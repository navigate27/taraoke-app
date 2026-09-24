import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type {
  GuestAction,
  PlayerState,
  PublicRoomState,
} from "../../../shared/types";
import type { SearchResult } from "../../../server/youtube";
import { Check, Eye, EyeOff, Volume2, VolumeX } from "pixelarticons/react";
import { ParticipantChips } from "../components/ParticipantChips";
import { SongsSearchModal } from "../components/SongsSearchModal";
import { buildJoinUrl } from "../lib/joinUrl";
import { socket } from "../lib/socket";
import { formatClock, loadYouTubeApi, YTEvents, type YTPlayer } from "../lib/youtube";

interface Props {
  code: string;
  nickname: string;
  onExit: () => void;
}

const GUEST_KEY = "taraoke.guest";

export function saveGuest(code: string, nickname: string): void {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ code, nickname }));
}

export function clearGuest(): void {
  localStorage.removeItem(GUEST_KEY);
}

export function loadGuest(): { code: string; nickname: string } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "");
    if (typeof parsed?.code === "string" && typeof parsed?.nickname === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function Guest({ code, nickname, onExit }: Props) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoVisible, setVideoVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const localPlayingRef = useRef(false);
  const mutedRef = useRef(true);
  const lastLoadedRef = useRef<string | null>(null);
  const pendingRef = useRef<{ videoId: string; playing: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    socket.emit("room:join", code, nickname, null, (res) => {
      if (!res.ok) onExit();
    });
    const onRoomState = (s: PublicRoomState) => setState(s);
    const onPlayerState = (p: PlayerState) => {
      setPosition(p.positionSec);
      if (!p.videoId) {
        lastLoadedRef.current = null;
        localPlayingRef.current = false;
        setPlaying(false);
        return;
      }
      if (p.videoId !== lastLoadedRef.current) {
        lastLoadedRef.current = p.videoId;
        const player = playerRef.current;
        if (player && readyRef.current) {
          if (p.playing) player.loadVideoById(p.videoId);
          else player.cueVideoById(p.videoId);
        } else {
          pendingRef.current = { videoId: p.videoId, playing: p.playing };
        }
        localPlayingRef.current = p.playing;
        setPlaying(p.playing);
        return;
      }
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      const local = player.getCurrentTime() || 0;
      if (p.playing && Math.abs(local - p.positionSec) > 2) {
        player.seekTo(p.positionSec);
      }
      if (p.playing !== localPlayingRef.current) {
        localPlayingRef.current = p.playing;
        setPlaying(p.playing);
        if (p.playing) player.playVideo();
        else player.pauseVideo();
      }
    };
    socket.on("roomState", onRoomState);
    socket.on("playerState", onPlayerState);
    return () => {
      socket.off("roomState", onRoomState);
      socket.off("playerState", onPlayerState);
      socket.emit("room:leave");
    };
  }, [code, nickname, onExit]);

  useEffect(() => {
    if (!videoVisible) return;
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
            if (mutedRef.current) player?.mute();
            else player?.unMute();
            const pending = pendingRef.current;
            if (pending) {
              if (pending.playing) player?.loadVideoById(pending.videoId);
              else player?.cueVideoById(pending.videoId);
              pendingRef.current = null;
            }
          },
          onStateChange: (e) => {
            if (e.data === YTEvents.ENDED) return;
            localPlayingRef.current = e.data === YTEvents.PLAYING;
            setPlaying(e.data === YTEvents.PLAYING);
          },
        },
      }) as YTPlayer;
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
      lastLoadedRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [videoVisible]);

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

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (player) {
      if (mutedRef.current) player.unMute();
      else player.mute();
    }
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }

  function showVideo() {
    setVideoVisible(true);
    lastLoadedRef.current = null;
    pendingRef.current = null;
  }

  function emitAction(action: GuestAction) {
    socket.emit("guest:action", action);
  }

  function seekBy(delta: number) {
    const current = playerRef.current?.getCurrentTime() || position;
    emitAction({ type: "seek", positionSec: Math.max(0, current + delta) });
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
      (res) => {
        if (res.ok) {
          showToast(`Added to queue — you're #${res.position} in line`);
        } else {
          showToast(res.error ?? "Could not add song");
        }
      },
    );
  }

  const queue = state?.queue ?? [];
  const history = state?.history ?? [];
  const participants = state?.participants ?? [];
  const nowPlaying = state?.nowPlaying ?? null;
  const ownsCurrent = !!nowPlaying && nowPlaying.addedBy === nickname;
  const duration = nowPlaying?.durationSec ?? 0;
  const progress = duration ? Math.min(1, position / duration) : 0;
  const remaining = duration ? formatClock(Math.max(0, duration - position)) : "--:--";
  const addedVideoIds = new Set([
    ...(nowPlaying ? [nowPlaying.videoId] : []),
    ...queue.map((q) => q.videoId),
  ]);
  const upNext = queue[0]?.addedBy === nickname ? queue[0] : null;

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

      {upNext && (
        <div
          className="mx-6 mt-4 flex items-center gap-3 rounded-[4px] border-[3px] border-gold-500 bg-gold-500/10 p-3"
          role="status"
        >
          <span className="font-press text-[9px] leading-relaxed text-gold-500 [text-shadow:0_0_8px_rgba(255,210,62,.7)]">
            You're
            <br />
            up next!
          </span>
          <p className="min-w-0 text-sm font-semibold">
            {upNext.title}
            <span className="block text-xs font-medium text-arc-500">
              added by {upNext.addedBy}
            </span>
          </p>
        </div>
      )}

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
        </section>

        <section className="panel flex flex-col gap-4 p-5" aria-label="Now playing">
          <div className="crt scanlines relative min-h-[280px] flex-1 overflow-hidden rounded-[4px] border-[3px] border-cab-700 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0">
            {nowPlaying && (
              <span className="absolute top-4 right-4 z-10 rounded-[4px] border-2 border-red-700 bg-red-500 px-3 py-2 font-press text-[10px] text-white [text-shadow:2px_2px_0_#7A1030]">
                On air
              </span>
            )}
            <div ref={containerRef} className="absolute inset-0" />
            {nowPlaying && videoVisible && (
              <button
                onClick={() => setVideoVisible(false)}
                className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-[4px] border-2 border-cab-700 bg-cab-800 px-3 py-2 font-press text-[8px] text-arc-100"
                aria-label="Hide video"
              >
                <EyeOff className="h-4 w-4" />
                Hide video
              </button>
            )}
            {nowPlaying && !videoVisible && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-cab-900">
                <p className="text-sm text-arc-500">Video hidden — saves data.</p>
                <button
                  onClick={showVideo}
                  className="btn btn-accent px-5 py-3 text-[9px]"
                  aria-label="Show video"
                >
                  <Eye className="h-4 w-4" />
                  Show video
                </button>
              </div>
            )}
            {nowPlaying && videoVisible && ownsCurrent && (
              <button
                type="button"
                onClick={() => emitAction({ type: playing ? "pause" : "play" })}
                aria-label={playing ? "Pause video" : "Play video"}
                className="absolute inset-0 z-[5] cursor-pointer"
              />
            )}
            {nowPlaying && videoVisible && !playing && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center [&>button]:pointer-events-auto">
                <button
                  onClick={() => emitAction({ type: "play" })}
                  disabled={!ownsCurrent}
                  aria-label="Play"
                  className="btn btn-primary h-16 w-16 disabled:opacity-30"
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
              disabled={!ownsCurrent}
              className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
              aria-label="Back 10 seconds"
            >
              -10
            </button>
            <button
              onClick={() => emitAction({ type: playing ? "pause" : "play" })}
              disabled={!ownsCurrent}
              className="btn btn-primary h-16 w-16 text-[14px] disabled:opacity-30"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              onClick={() => seekBy(10)}
              disabled={!ownsCurrent}
              className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
              aria-label="Forward 10 seconds"
            >
              +10
            </button>
            <button
              onClick={() => emitAction({ type: "next" })}
              disabled={!ownsCurrent}
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
            className="btn btn-accent mb-3 w-full px-4 py-3 text-[9px]"
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
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`mb-2.5 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] bg-cab-800 p-2.5 ${
                  item.addedBy === nickname ? "border-gold-500" : "border-cab-700"
                }`}
              >
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
            ))}
            {history.length > 0 && (
              <>
                <p className="mt-3 mb-2 font-press text-[8px] tracking-[0.2em] text-arc-500">
                  Played
                </p>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="mb-2.5 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] bg-cab-800 p-2.5 opacity-60"
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

      {toast && (
        <div
          className="crt fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-[4px] border-[3px] border-cab-700 px-5 py-3 text-sm font-semibold text-cyan-500"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}