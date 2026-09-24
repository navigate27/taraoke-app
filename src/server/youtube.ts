import { normalizeTitle } from "../shared/songTitle";
import { getInnertube } from "./stream";

export interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number | null;
}

interface CacheEntry {
  expires: number;
  results: SearchResult[];
  nextPageToken: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function searchYouTube(
  query: string,
  pageToken?: string,
): Promise<{
  results: SearchResult[];
  nextPageToken: string | null;
  source: "cache" | "innertube" | "unavailable";
}> {
  const cacheKey = pageToken ? `${query}#${pageToken}` : query;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return {
      results: cached.results,
      nextPageToken: cached.nextPageToken,
      source: "cache",
    };
  }
  return searchYouTubeViaInnertube(query, pageToken, cacheKey);
}

interface InnertubeVideoLike {
  id?: string;
  title?: { text?: string };
  author?: { name?: string };
  best_thumbnail?: { url?: string } | null;
  duration?: number;
}

async function searchYouTubeViaInnertube(
  query: string,
  pageToken: string | undefined,
  cacheKey: string,
): Promise<{
  results: SearchResult[];
  nextPageToken: string | null;
  source: "innertube" | "unavailable";
}> {
  try {
    const yt = await getInnertube();
    const info = (await yt.search(`${query} karaoke`, {
      type: "video",
    })) as unknown as { videos?: InnertubeVideoLike[] };
    const results: SearchResult[] = (info.videos ?? [])
      .filter((v) => v.id)
      .map((v) => ({
        videoId: v.id!,
        title: v.title?.text ?? "Untitled",
        channel: v.author?.name ?? "YouTube",
        thumbnail:
          v.best_thumbnail?.url ??
          `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        durationSec:
          typeof v.duration === "number" && Number.isFinite(v.duration)
            ? v.duration
            : null,
      }));
    if (results.length === 0) {
      return { results: [], nextPageToken: null, source: "unavailable" };
    }
    cache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      results,
      nextPageToken: null,
    });
    return { results, nextPageToken: null, source: "innertube" };
  } catch {
    return { results: [], nextPageToken: null, source: "unavailable" };
  }
}

const KARAOKE_RE =
  /\b(karaoke|videoke|instrumental|minus\s?one|min-one|backing\s?track|playback)\b/i;

export const NON_SONG_RE =
  /\b(mashup|medley|megamix|non-?stop|compilation|mixtape)\b/i;

export function pickKaraokeResult(
  results: SearchResult[],
): SearchResult | null {
  return (
    results.find(
      (r) => KARAOKE_RE.test(r.title) && !NON_SONG_RE.test(r.title),
    ) ?? null
  );
}

export function dedupeByTitle(results: SearchResult[]): SearchResult[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    if (seenIds.has(r.videoId)) continue;
    const n = normalizeTitle(r.title);
    if (n && seenTitles.has(n)) continue;
    seenIds.add(r.videoId);
    if (n) seenTitles.add(n);
    out.push(r);
  }
  return out;
}

export function karaokeOnly(results: SearchResult[]): SearchResult[] {
  return dedupeByTitle(
    results.filter((r) => KARAOKE_RE.test(r.title) && !NON_SONG_RE.test(r.title)),
  );
}

interface OEmbedResponse {
  title?: string;
  author_name?: string;
}

export async function resolveYouTubeUrl(
  rawUrl: string,
): Promise<SearchResult | null> {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as OEmbedResponse;
    return {
      videoId,
      title: body.title ?? "Untitled",
      channel: body.author_name ?? "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationSec: null,
    };
  } catch {
    return null;
  }
}

export function extractVideoId(raw: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1]!;
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(raw.trim())) return raw.trim();
  return null;
}