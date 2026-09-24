import { useEffect, useRef, useState } from "react";
import type {
  GuestAction,
  PlayerState,
  PublicRoomState,
} from "../../../shared/types";
import type { SearchResult } from "../../../server/youtube";
import { fetchSongs } from "../lib/search";
import { socket } from "../lib/socket";
import { loadYouTubeApi, YTEvents, type YTPlayer } from "../lib/youtube";

interface Props {
  code: string;
  nickname: string;
  onExit: () => void;
}

const SUGGESTIONS = ["Eraserheads", "Ben&Ben", "Moira Dela Torre", "Parokya ni Edgar", "Bee Gees"];

export function Guest({ code, nickname, onExit }: Props) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [position, setPosition] = useState(0);
  const [tab, setTab] = useState<"search" | "queue">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
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
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await fetchSongs(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
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

  const nowPlaying = state?.nowPlaying ?? null;
  const queue = state?.queue ?? [];
  const ownsCurrent = !!nowPlaying && nowPlaying.addedBy === nickname;
  const addedVideoIds = new Set([
    ...(nowPlaying ? [nowPlaying.videoId] : []),
    ...queue.map((q) => q.videoId),
  ]);
  const upNext = queue[0]?.addedBy === nickname ? queue[0] : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col">
      <header
        className="crt scanlines mx-4 mt-3 flex items-center justify-between gap-3 rounded-[4px] border-[3px] border-cab-700 px-4 py-3"
        aria-label="Now playing"
      >
        <div className="min-w-0">
          <span className="mb-1 block font-press text-[8px] tracking-[0.12em] text-arc-500">
            Now playing
          </span>
          <p className="truncate text-sm font-semibold">
            {nowPlaying ? nowPlaying.title : "Nothing playing"}
          </p>
        </div>
        {nowPlaying?.durationSec ? (
          <span className="font-press text-[14px] text-cyan-500 [text-shadow:0_0_8px_rgba(62,240,255,.7)]">
            {Math.max(0, nowPlaying.durationSec - Math.floor(position))}s
          </span>
        ) : null}
      </header>

      <section
        className={`mx-4 mt-3.5 ${nowPlaying ? "" : "hidden"}`}
        aria-label="Now playing video"
      >
        <div className="crt scanlines relative aspect-video overflow-hidden rounded-[4px] border-[3px] border-cab-700 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0">
          <div ref={containerRef} className="absolute inset-0" />
        </div>
        <div
          className="mt-2.5 flex items-center justify-center gap-3"
          aria-label="Player controls"
        >
          <button
            onClick={() => seekBy(-10)}
            disabled={!ownsCurrent}
            className="btn btn-ghost h-11 px-3 text-[9px] disabled:opacity-30"
            aria-label="Back 10 seconds"
          >
            -10
          </button>
          <button
            onClick={() => emitAction({ type: playing ? "pause" : "play" })}
            disabled={!ownsCurrent}
            className="btn btn-primary h-13 w-13 text-[12px] disabled:opacity-30"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            onClick={() => seekBy(10)}
            disabled={!ownsCurrent}
            className="btn btn-ghost h-11 px-3 text-[9px] disabled:opacity-30"
            aria-label="Forward 10 seconds"
          >
            +10
          </button>
          <button
            onClick={() => emitAction({ type: "next" })}
            disabled={!ownsCurrent}
            className="btn btn-ghost h-11 w-11 disabled:opacity-30"
            aria-label="Skip to the next song"
          >
            ⏭
          </button>
          <button
            onClick={toggleMute}
            title={muted ? "Sound off — tap to unmute" : "Sound on — tap to mute"}
            aria-label={muted ? "Unmute" : "Mute"}
            className={`btn btn-ghost h-11 w-11 text-[12px] ${
              muted
                ? "text-arc-500 opacity-70"
                : "text-cyan-500 [box-shadow:5px_5px_0_#05030C,0_0_12px_rgba(62,240,255,.45)] [text-shadow:0_0_8px_rgba(62,240,255,.7)]"
            }`}
          >
            ♪
          </button>
        </div>
        {!ownsCurrent && nowPlaying && (
          <p className="mt-2 text-center text-[11px] text-arc-500">
            Transport unlocks when your song is playing
          </p>
        )}
      </section>

      {upNext && (
        <div
          className="mx-4 mt-3.5 flex items-center gap-3 rounded-[4px] border-[3px] border-gold-500 bg-gold-500/10 p-3"
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

      <main className="flex-1 px-4 pt-4 pb-28">
        {tab === "search" ? (
          <>
            <label className="crt scanlines relative mb-3.5 flex items-center gap-2.5 rounded-[4px] border-[3px] border-cab-700 px-4 py-3.5">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-arc-500" aria-hidden="true">
                <path d="M10 2a8 8 0 105.3 14l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Song, artist, or YouTube link"
                aria-label="Search songs"
                className="min-w-0 flex-1 bg-transparent font-medium text-arc-100 outline-none placeholder:text-arc-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                  }}
                  aria-label="Clear search"
                  className="px-1 py-1 text-sm text-arc-500 hover:text-arc-100"
                >
                  ✕
                </button>
              )}
            </label>

            {!query && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="rounded-[4px] border-2 border-cab-700 bg-cab-800 px-3 py-2 text-xs font-bold text-arc-500 hover:text-arc-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {searching && <p className="text-sm text-arc-500">Searching…</p>}
            {query && !searching && results.length === 0 && (
              <p className="text-sm text-arc-500">
                No results — paste a YouTube link instead.
              </p>
            )}
            {results.map((result) => (
              <div
                key={result.videoId}
                className="mb-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-3"
              >
                <div className="grid min-w-0 grid-cols-[92px_1fr] items-center gap-3">
                  <img
                    src={result.thumbnail}
                    alt=""
                    className="aspect-video w-[92px] rounded-[4px] border-2 border-cab-700 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold">{result.title}</p>
                    <p className="text-xs text-arc-500">{result.channel}</p>
                  </div>
                </div>
                {addedVideoIds.has(result.videoId) ? (
                  <span className="flex items-center gap-1.5 font-press text-[8px] whitespace-nowrap text-cyan-500">
                    ✓ Added
                  </span>
                ) : (
                  <button
                    onClick={() => addToQueue(result)}
                    className="btn btn-primary px-3.5 py-3 text-[8px] whitespace-nowrap"
                  >
                    Add to queue
                  </button>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]">
                Queue
              </h2>
              <span className="font-press text-[9px] text-arc-500">
                {queue.length} songs
              </span>
            </div>
            <p className="mb-4 font-press text-[8px] tracking-[0.2em] text-gold-500">
              — Today's high scores —
            </p>
            {queue.length === 0 && (
              <p className="text-sm text-arc-500">No songs yet — be the first.</p>
            )}
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`mb-2.5 grid grid-cols-[36px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] bg-cab-800 p-2.5 ${
                  item.addedBy === nickname
                    ? "border-gold-500"
                    : "border-cab-700"
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
                  <p className="text-xs text-arc-500">
                    added by {item.addedBy}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {toast && (
        <div
          className="crt fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-[4px] border-[3px] border-cab-700 px-5 py-3 text-sm font-semibold text-cyan-500"
          role="status"
        >
          {toast}
        </div>
      )}

      <nav
        className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-[390px] -translate-x-1/2 grid-cols-2 gap-2.5 border-t-[3px] border-cab-700 bg-cab-800 px-4 py-4"
        aria-label="Tabs"
      >
        <button
          onClick={() => setTab("search")}
          className={`btn h-13 py-4 text-[10px] ${tab === "search" ? "btn-primary" : "btn-ghost text-arc-500"}`}
          aria-current={tab === "search"}
        >
          Search
        </button>
        <button
          onClick={() => setTab("queue")}
          className={`btn h-13 py-4 text-[10px] ${tab === "queue" ? "btn-primary" : "btn-ghost text-arc-500"}`}
          aria-current={tab === "queue"}
        >
          Queue
        </button>
      </nav>

      {error && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}