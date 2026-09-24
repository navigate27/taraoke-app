import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { PublicRoomState } from "../../../shared/types";
import type { SearchResult } from "../../../server/youtube";
import { fetchSongs } from "../lib/search";
import { socket } from "../lib/socket";
import {
  formatClock,
  loadYouTubeApi,
  YTEvents,
  type YTPlayer,
} from "../lib/youtube";

const HOST_KEY = "taraoke.host";

export function saveHost(code: string, token: string): void {
  localStorage.setItem(HOST_KEY, JSON.stringify({ code, token }));
}

export function loadHost(): { code: string; token: string } | null {
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
  onExit: () => void;
}

export function Host({ code, token, onExit }: Props) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState("--:--");
  const [progress, setProgress] = useState(0);
  const [qrUrl, setQrUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const playingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<PublicRoomState | null>(null);
  const videoId = state?.nowPlaying?.videoId ?? null;

  stateRef.current = state;

  useEffect(() => {
    socket.emit("room:join", code, "Host", token, (res) => {
      if (!res.ok) onExit();
    });
    const onRoomState = (s: PublicRoomState) => setState(s);
    socket.on("roomState", onRoomState);
    return () => {
      socket.off("roomState", onRoomState);
    };
  }, [code, token, onExit]);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/r/${code}`, {
      margin: 1,
      color: { dark: "#3EF0FF", light: "#05030C" },
    })
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
        playerVars: { rel: 0, playsinline: 1, autoplay: 1 },
        events: {
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
      const current = stateRef.current?.nowPlaying?.videoId;
      if (current) player.loadVideoById(current);
    });
    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (playerRef.current && videoId) {
      playerRef.current.loadVideoById(videoId);
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

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playingRef.current) player.pauseVideo();
    else player.playVideo();
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
        if (!res.ok) setQuery("");
      },
    );
  }

  const queue = state?.queue ?? [];
  const participants = state?.participants ?? [];
  const nowPlaying = state?.nowPlaying ?? null;

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
        <section className="panel p-5" aria-label="Join the room">
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
          <div className="mt-4 flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.nickname}
                className="rounded-[4px] border-2 border-cab-700 bg-cab-700 px-2.5 py-1.5 text-xs font-bold text-arc-100"
              >
                {p.nickname}
              </span>
            ))}
          </div>
        </section>

        <section className="panel flex flex-col gap-4 p-5" aria-label="Now playing">
          {nowPlaying ? (
            <>
              <div className="crt scanlines relative flex-1 overflow-hidden rounded-[4px] border-[3px] border-cab-700">
                <span className="absolute top-4 right-4 z-10 rounded-[4px] border-2 border-red-700 bg-red-500 px-3 py-2 font-press text-[10px] text-white [text-shadow:2px_2px_0_#7A1030]">
                  On air
                </span>
                <div
                  ref={containerRef}
                  className="absolute inset-0 flex items-center justify-center"
                />
                {!playing && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <button
                      onClick={togglePlay}
                      aria-label="Play"
                      className="btn btn-primary h-16 w-16"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
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
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-arc-500">
                No songs yet — add the first one.
              </p>
            </div>
          )}
        </section>

        <section className="panel p-5" aria-label="Song queue">
          <h2 className="mb-1 flex items-baseline justify-between font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]">
            Queue
            <span className="font-press text-[9px] text-arc-500 [text-shadow:none]">
              {queue.length} songs
            </span>
          </h2>
          <p className="mb-3 font-press text-[8px] tracking-[0.2em] text-gold-500">
            — Today's high scores —
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or paste a YouTube link"
            aria-label="Search songs to add"
            className="crt mb-3 w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-2.5 text-sm text-arc-100 outline-none placeholder:text-arc-500 focus:border-cyan-500"
          />
          {searching && <p className="mb-3 text-xs text-arc-500">Searching…</p>}
          {results.map((result) => {
            const added =
              (state?.nowPlaying?.videoId === result.videoId) ||
              queue.some((q) => q.videoId === result.videoId);
            return (
              <div
                key={result.videoId}
                className="mb-2.5 grid grid-cols-[72px_1fr_auto] items-center gap-2.5 rounded-[4px] border-2 border-cab-700 bg-cab-800 p-2"
              >
                <img
                  src={result.thumbnail}
                  alt=""
                  className="aspect-video w-[72px] rounded-[4px] border-2 border-cab-700 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{result.title}</p>
                  <p className="text-[11px] text-arc-500">{result.channel}</p>
                </div>
                {added ? (
                  <span className="font-press text-[8px] text-cyan-500">✓</span>
                ) : (
                  <button
                    onClick={() => addToQueue(result)}
                    className="btn btn-primary px-2.5 py-2.5 text-[8px]"
                    aria-label={`Add ${result.title} to queue`}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
          {queue.length === 0 && !query && (
            <p className="text-sm text-arc-500">Queue is empty.</p>
          )}
          {queue.map((item, index) => (
            <div
              key={item.id}
              className="mb-2.5 grid grid-cols-[36px_88px_1fr_auto] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2.5"
            >
              <span className="text-center font-press text-[12px] text-arc-500">
                {index + 1}
              </span>
              <img
                src={item.thumbnail}
                alt=""
                className="aspect-video w-[88px] rounded-[4px] border-2 border-cab-700 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-arc-500">added by {item.addedBy}</p>
              </div>
              <div className="flex flex-col gap-1 text-arc-500">
                <button
                  aria-label={`Play ${item.title} now`}
                  onClick={() =>
                    socket.emit("host:action", token, { type: "play-now", itemId: item.id })
                  }
                  className="px-1 text-xs hover:text-neon-500"
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
                  className="px-1 text-xs hover:text-cyan-500 disabled:opacity-30"
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
                  className="px-1 text-xs hover:text-cyan-500 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  aria-label={`Remove ${item.title}`}
                  onClick={() =>
                    socket.emit("host:action", token, { type: "remove", itemId: item.id })
                  }
                  className="px-1 text-xs hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer
        className="flex items-center justify-center gap-5 px-6 py-5"
        aria-label="Player controls"
      >
        <button
          onClick={togglePlay}
          className="btn btn-primary h-16 w-16 text-[14px]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => socket.emit("host:action", token, { type: "next" })}
          className="btn btn-ghost h-14 w-14"
          aria-label="Next — play the next song"
        >
          ⏭
        </button>
        <button onClick={onExit} className="btn btn-danger ml-3 px-5 py-3.5 text-[10px]">
          End room
        </button>
      </footer>
    </div>
  );
}