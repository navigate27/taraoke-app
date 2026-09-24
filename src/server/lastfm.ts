import { normalizeTitle } from "../shared/songTitle";
import type { SearchResult } from "./youtube";
import { pickKaraokeResult, searchYouTube } from "./youtube";

export interface SimilarTrack {
  title: string;
  artist: string;
}

export const SIMILAR_PAGE = 6;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NULL_TTL_MS = 10 * 60 * 1000;
const similarCache = new Map<string, { expires: number; data: SimilarTrack[] }>();
const resolvedCache = new Map<
  string,
  { expires: number; data: SearchResult | null }
>();

export function cleanArtist(raw: string): string {
  return raw
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[-–—|]\s*topic$/i, "")
    .replace(/vevo$/i, "")
    .replace(/\b(official|channel|tv)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface LastfmSimilarResponse {
  similartracks?: {
    track?: {
      name?: string;
      artist?: { name?: string } | string;
    }[];
  };
}

export async function getSimilarTracks(
  artist: string,
  track: string,
): Promise<SimilarTrack[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist.trim() || !track.trim()) return [];
  const cacheKey = `${artist.toLowerCase()}|${track.toLowerCase()}`;
  const cached = similarCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getsimilar");
  url.searchParams.set("artist", artist);
  url.searchParams.set("track", track);
  url.searchParams.set("autocorrect", "1");
  url.searchParams.set("limit", "30");
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as LastfmSimilarResponse;
    const tracks: SimilarTrack[] = (body.similartracks?.track ?? [])
      .filter((t) => t.name)
      .map((t) => ({
        title: t.name ?? "",
        artist:
          typeof t.artist === "string" ? t.artist : (t.artist?.name ?? ""),
      }));
    similarCache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      data: tracks,
    });
    return tracks;
  } catch {
    return [];
  }
}

export function cleanTrackTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(
      /\b(official|music|video|mv|lyrics?|lyric|audio|visualizer|hd|hq|4k)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

interface LastfmChartResponse {
  tracks?: {
    track?: {
      name?: string;
      artist?: { name?: string } | string;
    }[];
  };
}

export async function getTopTracksChart(
  country = "philippines",
): Promise<SimilarTrack[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const cacheKey = `#chart:${country}`;
  const cached = similarCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "geo.gettoptracks");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", "50");
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as LastfmChartResponse;
    const tracks: SimilarTrack[] = (body.tracks?.track ?? [])
      .filter((t) => t.name)
      .map((t) => ({
        title: t.name ?? "",
        artist:
          typeof t.artist === "string" ? t.artist : (t.artist?.name ?? ""),
      }));
    similarCache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      data: tracks,
    });
    return tracks;
  } catch {
    return [];
  }
}

export async function resolveKaraokeVersions(
  seeds: SearchResult[],
): Promise<SearchResult[]> {
  const picks = await Promise.all(
    seeds.map(async (seed) => {
      const query = cleanTrackTitle(seed.title);
      if (!query) return null;
      const cached = resolvedCache.get(query.toLowerCase());
      if (cached && cached.expires > Date.now()) return cached.data;
      const { results } = await searchYouTube(query);
      const pick = pickKaraokeResult(results);
      resolvedCache.set(query.toLowerCase(), {
        expires: Date.now() + (pick ? CACHE_TTL_MS : NULL_TTL_MS),
        data: pick,
      });
      return pick;
    }),
  );
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  const out: SearchResult[] = [];
  for (const pick of picks) {
    if (!pick || seen.has(pick.videoId)) continue;
    const n = normalizeTitle(pick.title);
    if (n && seenTitles.has(n)) continue;
    seen.add(pick.videoId);
    if (n) seenTitles.add(n);
    out.push(pick);
  }
  return out;
}

export async function resolveSimilarTracks(
  tracks: SimilarTrack[],
): Promise<SearchResult[]> {
  const picks = await Promise.all(tracks.map((t) => resolveTrack(t)));
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const pick of picks) {
    if (pick && !seen.has(pick.videoId)) {
      seen.add(pick.videoId);
      out.push(pick);
    }
  }
  return out;
}

async function resolveTrack(track: SimilarTrack): Promise<SearchResult | null> {
  const query = `${track.artist} ${track.title}`.trim();
  const cached = resolvedCache.get(query.toLowerCase());
  if (cached && cached.expires > Date.now()) return cached.data;
  const { results } = await searchYouTube(query);
  const pick = pickKaraokeResult(results);
  resolvedCache.set(query.toLowerCase(), {
    expires: Date.now() + (pick ? CACHE_TTL_MS : NULL_TTL_MS),
    data: pick,
  });
  return pick;
}