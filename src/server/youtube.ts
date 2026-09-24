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

export async function searchYouTube(
  query: string,
): Promise<{ results: SearchResult[]; source: "api" | "cache" | "unavailable" }> {
  const key = process.env.YOUTUBE_API_KEY;
  const cached = cache.get(query);
  if (cached && cached.expires > Date.now()) {
    return { results: cached.results, source: "cache" };
  }
  if (!key) {
    return { results: [], source: "unavailable" };
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("q", `${query} karaoke`);
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url);
    if (!res.ok) return { results: [], source: "unavailable" };
    const body = (await res.json()) as { items?: YouTubeSearchItem[] };
    const results: SearchResult[] = (body.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id!.videoId!,
        title: item.snippet?.title ?? "Untitled",
        channel: item.snippet?.channelTitle ?? "YouTube",
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
        durationSec: null,
      }));
    cache.set(query, { expires: Date.now() + CACHE_TTL_MS, results });
    return { results, source: "api" };
  } catch {
    return { results: [], source: "unavailable" };
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