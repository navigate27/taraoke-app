import { useEffect, useRef, useState } from "react";
import { Refresh } from "pixelarticons/react";
import { normalizeTitle } from "../../../shared/songTitle";
import type { SearchResult } from "../../../server/youtube";

interface SeedSong {
  title: string;
  channel: string;
}

interface Props {
  seedCandidates: SeedSong[];
  addedVideoIds: Set<string>;
  addedTitles: Set<string>;
  onAdd: (result: SearchResult) => void;
}

const SHOW_COUNT = 20;
const MAX_PAGES = 6;

function cleanSeed(seed: string): string {
  return seed
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*[-–—]\s*(karaoke|lyrics|official).*$/i, "")
    .trim();
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface SuggestionsResponse {
  results?: SearchResult[];
  nextPageToken?: string | null;
}

export function SongSuggestions({
  seedCandidates,
  addedVideoIds,
  addedTitles,
  onAdd,
}: Props) {
  const [pool, setPool] = useState<SearchResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [titlePop, setTitlePop] = useState<{
    title: string;
    channel: string;
    x: number;
    y: number;
    width: number;
    below: boolean;
  } | null>(null);
  const pagesFetched = useRef(0);
  const inFlightRef = useRef(false);
  const queryRef = useRef("");
  const pressTimer = useRef<number | undefined>(undefined);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const cancelPress = () => {
    window.clearTimeout(pressTimer.current);
    pressStart.current = null;
  };

  useEffect(() => {
    if (!titlePop) return;
    const timer = window.setTimeout(() => setTitlePop(null), 3000);
    return () => window.clearTimeout(timer);
  }, [titlePop]);

  useEffect(() => cancelPress, []);

  const seedOptions: SeedSong[] = [];
  const seenSeeds = new Set<string>();
  for (const candidate of seedCandidates) {
    if (!candidate.title) continue;
    const n = normalizeTitle(candidate.title);
    if (seenSeeds.has(n)) continue;
    seenSeeds.add(n);
    seedOptions.push(candidate);
  }

  const head = seedOptions[0]?.title ?? "";
  useEffect(() => {
    setOffset(0);
  }, [head]);

  const current = seedOptions.length
    ? seedOptions[offset % seedOptions.length]
    : null;
  const query = current ? cleanSeed(current.title) : "";
  const artist = current?.channel ?? "";
  const artistParam = artist ? `&artist=${encodeURIComponent(artist)}` : "";
  const roomChannels: string[] = [];
  for (const candidate of seedCandidates) {
    const channel = candidate.channel?.trim();
    if (!channel) continue;
    if (
      channel === artist ||
      roomChannels.some((c) => c.toLowerCase() === channel.toLowerCase())
    ) {
      continue;
    }
    roomChannels.push(channel);
    if (roomChannels.length >= 8) break;
  }
  const roomParam = roomChannels.length
    ? `&room=${encodeURIComponent(roomChannels.join(","))}`
    : "";
  const excludeParam = addedTitles.size
    ? `&exclude=${encodeURIComponent([...addedTitles].slice(0, 40).join(","))}`
    : "";
  queryRef.current = query;

  useEffect(() => {
    setPool([]);
    setNextPageToken(null);
    setLoading(true);
    setRevealed(false);
    setTitlePop(null);
    pagesFetched.current = 1;
    inFlightRef.current = true;
    fetch(
      `/api/suggestions?seed=${encodeURIComponent(query)}${artistParam}${roomParam}${excludeParam}`,
    )
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: SuggestionsResponse) => {
        if (queryRef.current !== query) return;
        setPool(shuffle(body.results ?? []));
        setNextPageToken(body.nextPageToken ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (queryRef.current !== query) return;
        inFlightRef.current = false;
        setLoading(false);
      });
  }, [query]);

  const isAdded = (r: SearchResult) => {
    if (addedVideoIds.has(r.videoId)) return true;
    const n = normalizeTitle(r.title);
    return n.length > 0 && addedTitles.has(n);
  };

  const unaddedCount = pool.filter((r) => !isAdded(r)).length;

  useEffect(() => {
    if (inFlightRef.current || !nextPageToken || unaddedCount >= SHOW_COUNT) {
      return;
    }
    if (pagesFetched.current >= MAX_PAGES) return;
    inFlightRef.current = true;
    setLoading(true);
    pagesFetched.current += 1;
    fetch(
      `/api/suggestions?seed=${encodeURIComponent(query)}${artistParam}${roomParam}${excludeParam}&page=${encodeURIComponent(nextPageToken)}`,
    )
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: SuggestionsResponse) => {
        if (queryRef.current !== query) return;
        setPool((prev) => {
          const seen = new Set(prev.map((r) => r.videoId));
          const seenTitles = new Set(
            prev.map((r) => normalizeTitle(r.title)).filter((t) => t),
          );
          return shuffle([
            ...prev,
            ...shuffle(body.results ?? []).filter(
              (r) =>
                !seen.has(r.videoId) &&
                !seenTitles.has(normalizeTitle(r.title)),
            ),
          ]);
        });
        setNextPageToken(body.nextPageToken ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (queryRef.current !== query) return;
        inFlightRef.current = false;
        setLoading(false);
      });
  }, [nextPageToken, unaddedCount, query]);

  const visible = pool.filter((r) => !isAdded(r)).slice(0, SHOW_COUNT);

  const canFetchMore = !!nextPageToken && pagesFetched.current < MAX_PAGES;

  useEffect(() => {
    if (revealed || loading) return;
    if (unaddedCount >= SHOW_COUNT || !canFetchMore) {
      setRevealed(true);
    }
  }, [revealed, loading, unaddedCount, canFetchMore]);

  if (!revealed && !loading && visible.length === 0 && !canFetchMore) {
    return null;
  }

  return (
    <section aria-label="Song suggestions" className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-press text-[9px] tracking-[0.2em] text-gold-500">
          Suggestions
        </p>
        {seedOptions.length > 1 && (
          <button
            type="button"
            onClick={() => setOffset((o) => (o + 1) % seedOptions.length)}
            className="btn btn-ghost h-7 w-7 p-0 text-arc-100"
            aria-label="Refresh suggestions"
            title="Show suggestions for the next song"
            data-testid="suggestions-refresh"
          >
            <Refresh className="h-4 w-4" />
          </button>
        )}
      </div>
      {loading && <p className="mb-3 text-sm text-arc-500">Looking for songs…</p>}
      <div
        className="scroll-thin max-h-[400px] overflow-y-auto pr-1"
        onScroll={() => setTitlePop(null)}
      >
        {titlePop && (
          <div
            className="crt fixed z-50 rounded-[4px] border-[3px] border-gold-500 bg-cab-900 px-3 py-2"
            style={{
              left: titlePop.x,
              top: titlePop.y,
              width: titlePop.width,
              transform: titlePop.below ? "none" : "translateY(-100%)",
            }}
            role="tooltip"
            data-testid="suggestion-title-popover"
          >
            <p className="break-words text-sm font-semibold leading-snug">
              {titlePop.title}
            </p>
            <p className="truncate text-xs text-arc-500">{titlePop.channel}</p>
          </div>
        )}
        {revealed &&
          visible.map((r) => (
          <div
            key={r.videoId}
            className="mb-1 grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2 select-none [-webkit-touch-callout:none]"
            onPointerDown={(e) => {
              if (titlePop) {
                setTitlePop(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              pressStart.current = { x: e.clientX, y: e.clientY };
              window.clearTimeout(pressTimer.current);
              pressTimer.current = window.setTimeout(() => {
                setTitlePop({
                  title: r.title,
                  channel: r.channel,
                  x: rect.left,
                  y: rect.top < 80 ? rect.bottom + 6 : rect.top - 6,
                  width: rect.width,
                  below: rect.top < 80,
                });
              }, 500);
            }}
            onPointerMove={(e) => {
              const start = pressStart.current;
              if (
                start &&
                (Math.abs(e.clientX - start.x) > 10 ||
                  Math.abs(e.clientY - start.y) > 10)
              ) {
                cancelPress();
              }
            }}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={r.thumbnail}
              alt=""
              className="aspect-video w-[64px] rounded-[4px] border-2 border-cab-700 object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{r.title}</p>
              <p className="truncate text-xs text-arc-500">{r.channel}</p>
            </div>
            <button
              onClick={() => onAdd(r)}
              className="btn btn-accent h-9 px-3 text-[9px]"
              aria-label={`Add ${r.title} to queue`}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}