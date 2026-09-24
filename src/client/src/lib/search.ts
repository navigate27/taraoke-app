import type { SearchResult } from "../../../server/youtube";

export function isYouTubeUrl(text: string): boolean {
  return /youtube\.com|youtu\.be/i.test(text);
}

export async function fetchSongs(query: string): Promise<SearchResult[]> {
  if (isYouTubeUrl(query)) {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(query)}`);
    const body = await res.json();
    return body.error ? [] : [body as SearchResult];
  }
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const body = (await res.json()) as { results: SearchResult[] };
  return body.results ?? [];
}