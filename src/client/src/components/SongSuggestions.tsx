import { useEffect, useState } from "react";
import type { SearchResult } from "../../../server/youtube";

interface Props {
  seed: string | null;
  addedVideoIds: Set<string>;
  onAdd: (result: SearchResult) => void;
}

function cleanSeed(seed: string): string {
  return seed
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*[-–—]\s*(karaoke|lyrics|official).*$/i, "")
    .trim();
}

export function SongSuggestions({ seed, addedVideoIds, onAdd }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = seed ? cleanSeed(seed) : "";
    setLoading(true);
    fetch(`/api/suggestions?seed=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: { results?: SearchResult[] }) => {
        setResults(body.results ?? []);
        setLoading(false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [seed]);

  const visible = results
    .filter((r) => !addedVideoIds.has(r.videoId))
    .slice(0, 4);

  if (!loading && visible.length === 0) return null;

  return (
    <section aria-label="Song suggestions" className="mt-6">
      <p className="mb-2 font-press text-[8px] tracking-[0.2em] text-gold-500">
        Suggestions
      </p>
      {loading && <p className="mb-3 text-sm text-arc-500">Looking for songs…</p>}
      {visible.map((r) => (
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