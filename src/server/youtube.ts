import { normalizeTitle } from "../shared/songTitle";

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

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
  };
}

interface YouTubeVideoItem {
  id?: string;
  snippet?: YouTubeSearchItem["snippet"];
}

export async function searchYouTube(
  query: string,
  pageToken?: string,
): Promise<{
  results: SearchResult[];
  nextPageToken: string | null;
  source: "api" | "cache" | "unavailable";
}> {
  const key = process.env.YOUTUBE_API_KEY;
  const cacheKey = pageToken ? `${query}#${pageToken}` : query;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return {
      results: cached.results,
      nextPageToken: cached.nextPageToken,
      source: "cache",
    };
  }
  if (!key) {
    return { results: [], nextPageToken: null, source: "unavailable" };
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("q", `${query} karaoke`);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { results: [], nextPageToken: null, source: "unavailable" };
    }
    const body = (await res.json()) as {
      items?: YouTubeSearchItem[];
      nextPageToken?: string;
    };
    const results: SearchResult[] = (body.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id!.videoId!,
        title: item.snippet?.title ?? "Untitled",
        channel: item.snippet?.channelTitle ?? "YouTube",
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
        durationSec: null,
      }));
    const nextPageToken = body.nextPageToken ?? null;
    cache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      results,
      nextPageToken,
    });
    return {
      results,
      nextPageToken,
      source: "api",
    };
  } catch {
    return { results: [], nextPageToken: null, source: "unavailable" };
  }
}

const KARAOKE_RE =
  /\b(karaoke|videoke|instrumental|minus\s?one|min-one|backing\s?track|playback)\b/i;

const NON_SONG_RE =
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

export async function getTrendingVideos(
  regionCode = "PH",
  pageToken?: string,
): Promise<{ results: SearchResult[]; nextPageToken: string | null }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { results: [], nextPageToken: null };
  const cacheKey = `#trending:${regionCode}${pageToken ? `#${pageToken}` : ""}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { results: cached.results, nextPageToken: cached.nextPageToken };
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", "12");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url);
    if (!res.ok) return { results: [], nextPageToken: null };
    const body = (await res.json()) as {
      items?: YouTubeVideoItem[];
      nextPageToken?: string;
    };
    const results: SearchResult[] = (body.items ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        videoId: item.id!,
        title: item.snippet?.title ?? "Untitled",
        channel: item.snippet?.channelTitle ?? "YouTube",
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
        durationSec: null,
      }));
    const nextPageToken = body.nextPageToken ?? null;
    cache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      results,
      nextPageToken,
    });
    return { results, nextPageToken };
  } catch {
    return { results: [], nextPageToken: null };
  }
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