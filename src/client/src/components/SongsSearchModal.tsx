import { useEffect, useState } from "react";
import { Check, Close } from "pixelarticons/react";
import type { SearchResult } from "../../../server/youtube";
import { fetchSongs } from "../lib/search";

interface Props {
  onClose: () => void;
  onAdd: (result: SearchResult) => void;
  addedVideoIds: Set<string>;
}

export function SongsSearchModal({ onClose, onAdd, addedVideoIds }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-crt-000/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add songs"
      data-testid="search-modal"
    >
      <div className="panel crt flex max-h-[85vh] w-[560px] max-w-full flex-col p-5">
        <div className="flex items-baseline justify-between">
          <h2
            data-testid="search-heading"
            className="font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]"
          >
            Add songs
          </h2>
          <button
            data-testid="search-btn-close"
            onClick={onClose}
            aria-label="Close search"
            className="btn btn-ghost h-9 w-9 p-0 text-arc-500"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3 mb-3">
          <input
            data-testid="search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or paste a YouTube link"
            aria-label="Search songs to add"
            className="crt w-full rounded-[4px] border-[3px] border-cab-700 pr-9 pl-3 py-2.5 text-sm text-arc-100 outline-none placeholder:text-arc-500 focus:border-cyan-500"
          />
          {query && (
            <button
              data-testid="search-btn-clear"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 px-1.5 py-1 text-arc-500 hover:text-arc-100"
            >
              <Close className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {searching && (
            <p data-testid="search-status-searching" className="mb-3 text-xs text-arc-500">
              Searching…
            </p>
          )}
          {!query && !searching && (
            <p data-testid="search-empty" className="text-sm text-arc-500">
              Search a song or paste a YouTube link.
            </p>
          )}
          {query && !searching && results.length === 0 && (
            <p data-testid="search-no-results" className="text-sm text-arc-500">
              No results — paste a YouTube link instead.
            </p>
          )}
          {results.map((result) => {
            const added = addedVideoIds.has(result.videoId);
            return (
              <div
                key={result.videoId}
                data-testid={`search-row-${result.videoId}`}
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
                  <Check role="img" aria-label="Added" className="h-4 w-4 text-cyan-500" />
                ) : (
                  <button
                    data-testid={`search-btn-add-${result.videoId}`}
                    onClick={() => onAdd(result)}
                    className="btn btn-primary px-2.5 py-2.5 text-[8px]"
                    aria-label={`Add ${result.title} to queue`}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}