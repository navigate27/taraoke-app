import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Innertube } from "youtubei.js";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAX_TTL_MS = 5 * 60 * 60 * 1000;
const TTL_MARGIN_MS = 60 * 1000;

interface ResolvedStream {
  url: string;
  expiresAt: number;
}

interface CacheSlot {
  entry?: ResolvedStream;
  inflight?: Promise<ResolvedStream>;
}

const cache = new Map<string, CacheSlot>();

let innertubePromise: Promise<Innertube> | null = null;

function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      generate_session_locally: true,
    }).catch((err) => {
      innertubePromise = null;
      throw err;
    });
  }
  return innertubePromise;
}

const CLIENT_FALLBACK = ["WEB", "ANDROID", "MWEB"] as const;

async function resolveStream(videoId: string): Promise<ResolvedStream> {
  const yt = await getInnertube();
  let lastError: Error | null = null;
  for (const client of CLIENT_FALLBACK) {
    try {
      const info = await yt.getInfo(videoId, { client });
      const status = info.playability_status?.status ?? "UNKNOWN";
      if (status !== "OK") {
        throw new Error(
          `Video not playable (${status}): ${info.playability_status?.reason || "unknown reason"}`,
        );
      }
      const streaming = info.streaming_data;
      if (!streaming) {
        throw new Error("No streaming data — live or restricted video");
      }
      const muxed = streaming.formats.filter((f) => f.has_video && f.has_audio);
      const pick =
        muxed.find((f) => f.itag === 22) ??
        muxed.find((f) => f.itag === 18) ??
        muxed.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (!pick) continue;
      const url = pick.url ?? (await pick.decipher(yt.session.player));
      if (!url) continue;
      const hardExpiry = streaming.expires
        ? streaming.expires.getTime()
        : Date.now() + MAX_TTL_MS;
      return {
        url,
        expiresAt: Math.min(Date.now() + MAX_TTL_MS, hardExpiry) - TTL_MARGIN_MS,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw (
    lastError ?? new Error("No progressive video+audio format available")
  );
}

function getStream(videoId: string): Promise<ResolvedStream> {
  const cached = cache.get(videoId);
  if (cached?.entry && cached.entry.expiresAt > Date.now()) {
    return Promise.resolve(cached.entry);
  }
  if (cached?.inflight) return cached.inflight;
  const inflight = resolveStream(videoId)
    .then((entry) => {
      cache.set(videoId, { entry });
      return entry;
    })
    .catch((err) => {
      const slot = cache.get(videoId);
      if (slot?.inflight === inflight) cache.delete(videoId);
      throw err;
    });
  cache.set(videoId, { ...cache.get(videoId), inflight });
  return inflight;
}

function upstreamHeaders(range?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    referer: "https://www.youtube.com/",
  };
  if (range) headers.range = range;
  return headers;
}

export async function streamHandler(
  req: FastifyRequest<{ Params: { videoId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const videoId = req.params.videoId;
  if (!VIDEO_ID_RE.test(videoId)) {
    return void reply.code(400).send({ error: "Invalid video id" });
  }

  let entry: ResolvedStream;
  try {
    entry = await getStream(videoId);
  } catch (err) {
    req.log.warn({ videoId, err: String(err) }, "stream resolve failed");
    return void reply.code(502).send({
      error: err instanceof Error ? err.message : "Stream unavailable",
    });
  }

  const range =
    typeof req.headers.range === "string" ? req.headers.range : undefined;

  const ac = new AbortController();
  reply.raw.on("close", () => {
    if (!reply.raw.writableEnded) ac.abort();
  });

  let upstream = await fetch(entry.url, {
    headers: upstreamHeaders(range),
    signal: ac.signal,
  });

  if (upstream.status === 403 || upstream.status === 410) {
    await upstream.body?.cancel();
    cache.delete(videoId);
    try {
      entry = await getStream(videoId);
      upstream = await fetch(entry.url, {
        headers: upstreamHeaders(range),
        signal: ac.signal,
      });
    } catch (err) {
      req.log.warn({ videoId, err: String(err) }, "stream re-resolve failed");
      return void reply.code(502).send({
        error: err instanceof Error ? err.message : "Stream unavailable",
      });
    }
  }

  // Pipe bytes through reply.raw — Fastify's reply.send(stream) conflicts with a
  // manually-set content-length, so the response is hijacked and written directly.
  reply.hijack();
  const raw = reply.raw;
  const headers: Record<string, string> = {
    "content-type": upstream.headers.get("content-type") ?? "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers["content-length"] = contentLength;
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers["content-range"] = contentRange;
  raw.writeHead(upstream.status, headers);
  raw.on("close", () => {
    if (!raw.writableEnded) ac.abort();
  });
  if (!upstream.body) {
    raw.end();
    return;
  }
  try {
    await pipeline(
      Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream),
      raw,
    );
  } catch {
    ac.abort();
  }
}