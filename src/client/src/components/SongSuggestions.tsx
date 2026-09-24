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

const SHOW_COUNT = 4;
const MAX_PAGES = 6;

function cleanSeed(seed: string): string {
  return seed
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*[-–—]\s*(karaoke|lyrics|official).*$/i, "")
    .trim();
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
  const pagesFetched = useRef(0);
  const inFlightRef = useRef(false);
  const queryRef = useRef("");

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
  queryRef.current = query;

  useEffect(() => {
    setPool([]);
    setNextPageToken(null);
    setLoading(true);
    setRevealed(false);
    pagesFetched.current = 1;
    inFlightRef.current = true;
    fetch(`/api/suggestions?seed=${encodeURIComponent(query)}${artistParam}`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: SuggestionsResponse) => {
        if (queryRef.current !== query) return;
        setPool(body.results ?? []);
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
      `/api/suggestions?seed=${encodeURIComponent(query)}${artistParam}&page=${encodeURIComponent(nextPageToken)}`,
    )
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: SuggestionsResponse) => {
        if (queryRef.current !== query) return;
        setPool((prev) => {
          const seen = new Set(prev.map((r) => r.videoId));
          const seenTitles = new Set(
            prev.map((r) => normalizeTitle(r.title)).filter((t) => t),
          );
          return [
            ...prev,
            ...(body.results ?? []).filter(
              (r) =>
                !seen.has(r.videoId) &&
                !seenTitles.has(normalizeTitle(r.title)),
            ),
          ];
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
      {revealed &&
        visible.map((r) => (
        <div
          key={r.videoId}
          className="mb-2.5 grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2"
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
    </section>
  );
}