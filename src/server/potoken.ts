import { JSDOM } from "jsdom";
import { fetch as undiciFetch } from "undici";
import { BotGuardClient } from "bgutils-js/botguard";
import { WebPoMinter } from "bgutils-js/webpo";
import { buildURL, getHeaders, parseLooseJSON, USER_AGENT } from "bgutils-js/utils";
import type { WebPoSignalOutput } from "bgutils-js/shared-types";
import { Innertube, Platform } from "youtubei.js";

// Importing jsdom silently breaks the built-in fetch's response decompression
// (compressed bodies arrive raw with no headers). undici's own fetch is
// unaffected — swapping it in heals fetch for the whole server process.
// youtubei.js passes built-in `Request` objects, which undici's fetch rejects,
// so they are converted back to plain (url, init) pairs first.
function flexFetch(input: unknown, init?: RequestInit): Promise<Response> {
  if (
    input &&
    typeof input === "object" &&
    !(input instanceof URL) &&
    typeof (input as { url?: unknown }).url === "string"
  ) {
    const req = input as Request & { body: BodyInit | null; signal: AbortSignal | null };
    return undiciFetch(req.url, {
      method: init?.method ?? req.method,
      headers: (init?.headers ?? req.headers) as HeadersInit,
      body: init?.body ?? req.body,
      redirect: init?.redirect ?? req.redirect,
      signal: init?.signal ?? req.signal,
      duplex: "half",
    } as never) as unknown as Promise<Response>;
  }
  return undiciFetch(input as never, init as never) as unknown as Promise<Response>;
}

globalThis.fetch = flexFetch as unknown as typeof globalThis.fetch;
// youtubei.js captured the broken global at import time; point its shim at the
// healed fetch too.
Platform.shim.fetch = flexFetch as unknown as typeof Platform.shim.fetch;

// youtubei.js runs the decipher VM through Platform.shim.eval — give it a
// plain Function constructor (safe here: the script comes from YouTube's own CDN).
Platform.shim.eval = async (data) => new Function(data.output)();

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
// Integrity tokens from GenerateIT carry a TTL; refresh with a safety margin.
const MINTER_TTL_MARGIN_MS = 10 * 60 * 1000;
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
// Full Cookie header from a logged-in youtube.com browser session. Datacenter
// IPs are bot-gated at a level PO tokens alone cannot clear — cookies are the
// accepted fix (yt-dlp maintainers: "change IP or use cookies"). Lives in .env,
// never committed. Read lazily: .env is loaded by index.ts *after* this module
// is imported.
function cookie(): string | undefined {
  return process.env.YOUTUBE_COOKIE?.trim() || undefined;
}

export interface PoTokenSession {
  yt: Innertube;
  mintContent: (videoId: string) => Promise<string | null>;
}

interface MinterState {
  minter: WebPoMinter;
  expiresAt: number;
}

let plainPromise: Promise<Innertube> | null = null;

// Search never hits the playability gate — a plain session is enough.
export function getInnertube(): Promise<Innertube> {
  if (!plainPromise) {
    plainPromise = fetchPlayerId()
      .then((playerId) =>
        Innertube.create({ generate_session_locally: true, player_id: playerId, cookie: cookie() }))
      .catch((err) => {
        plainPromise = null;
        throw err;
      });
  }
  return plainPromise;
}

// --- BotGuard VM environment -------------------------------------------------
// The BotGuard VM sniffs for browser globals, but youtubei.js misbehaves when
// it finds them — so the JSDOM globals are only installed while the VM runs.

const dom = new JSDOM(
  "<!DOCTYPE html><html lang=\"en\"><head><title></title></head><body></body></html>",
  {
    url: "https://www.youtube.com",
    referrer: "https://www.youtube.com/",
    userAgent: USER_AGENT,
  } as unknown as ConstructorParameters<typeof JSDOM>[1],
);

const GLOBAL_KEYS = ["window", "document", "location", "origin"] as const;
const savedGlobals = new Map<string, unknown>();
let navigatorPatched = false;

function installVmGlobals(ytcfg?: unknown): void {
  const g = globalThis as Record<string, unknown>;
  if (ytcfg !== undefined) {
    (dom.window as unknown as { yt: unknown }).yt = { config_: ytcfg };
  }
  for (const key of GLOBAL_KEYS) {
    if (!(key in savedGlobals)) savedGlobals.set(key, g[key]);
    g[key] = (dom.window as unknown as Record<string, unknown>)[key];
  }
  (g as Record<string, unknown>).yt = (dom.window as unknown as Record<string, unknown>).yt;
  if (!("navigator" in g)) {
    Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
    navigatorPatched = true;
  }
}

function uninstallVmGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of savedGlobals) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
  savedGlobals.clear();
  if (navigatorPatched) {
    delete g.navigator;
    navigatorPatched = false;
  }
}

async function fetchChallenge(): Promise<{
  program: string;
  globalName: string;
  visitorData: string | null;
}> {
  const pageResponse = await fetch("https://www.youtube.com", {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.7",
      "user-agent": USER_AGENT,
    },
  });
  const pageHtml = await pageResponse.text();

  const ytConfig = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
  if (!ytConfig) throw new Error("Could not find ytcfg in page HTML");

  const parsedConfig = JSON.parse(ytConfig) as { VISITOR_DATA?: string };
  installVmGlobals(parsedConfig);

  const initialAttestationData = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
  if (!initialAttestationData?.[1]) throw new Error("Could not find challenge in page HTML");

  const parsed = parseLooseJSON(initialAttestationData[1]) as {
    R?: {
      bgChallenge?: {
        program: string;
        globalName: string;
        interpreterUrl: { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string };
      };
    };
  };
  const bgChallenge = parsed.R?.bgChallenge;
  if (!bgChallenge) throw new Error("Could not get challenge");

  const interpreterUrl = bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
  if (!interpreterUrl) throw new Error("Could not get interpreter URL");
  const interpreterResponse = await fetch(`https:${interpreterUrl}`);
  const interpreterJavascript = await interpreterResponse.text();
  if (!interpreterJavascript) throw new Error("Could not load VM");
  new Function(interpreterJavascript)();

  return {
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    visitorData: parsedConfig.VISITOR_DATA ?? null,
  };
}

async function createMinter(): Promise<MinterState> {
  const challenge = await fetchChallenge();
  if (challenge.visitorData) homepageVisitorData = challenge.visitorData;

  try {
    const botGuardClient = await BotGuardClient.create({
      program: challenge.program,
      globalName: challenge.globalName,
      globalObject: globalThis,
    });

    const webPoSignalOutput: WebPoSignalOutput = [];
    const botguardResponse = await botGuardClient.snapshot({ webPoSignalOutput });

    const integrityTokenResponse = await fetch(buildURL("GenerateIT", true), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify([REQUEST_KEY, botguardResponse]),
    });
    const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] =
      (await integrityTokenResponse.json()) as [string, number, number, string];

    const minter = await WebPoMinter.create(
      { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
      webPoSignalOutput,
    );

    const ttlMs = Math.max(1, estimatedTtlSecs ?? 3600) * 1000 - MINTER_TTL_MARGIN_MS;
    return { minter, expiresAt: Date.now() + ttlMs };
  } finally {
    uninstallVmGlobals();
  }
}

// The minter's VM callbacks dereference `window` — globals must be installed
// while minting runs.
async function mintWebsafe(minter: WebPoMinter, contentBinding: string): Promise<string> {
  installVmGlobals();
  try {
    return await minter.mintAsWebsafeString(contentBinding);
  } finally {
    uninstallVmGlobals();
  }
}

let minterState: MinterState | null = null;
// Visitor data from the live homepage ytcfg — tokens minted for a locally
// generated visitor id don't clear the playability gate on datacenter IPs.
let homepageVisitorData: string | null = null;

// youtubei.js fetches /iframe_api once without retries or UA; YouTube
// intermittently serves a short stub without the player id, so we fetch it
// ourselves and hand it to every session creation.
const PLAYER_ID_RE = /player\\\/([a-zA-Z0-9_-]+)\\\//;

async function fetchPlayerId(): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(new URL("/iframe_api", "https://www.youtube.com"), {
      headers: { accept: "*/*", "user-agent": BROWSER_UA },
    });
    const id = PLAYER_ID_RE.exec(await res.text())?.[1];
    if (id) return id;
    lastError = new Error("player id missing from /iframe_api response");
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  // Fallback: the homepage's ytcfg carries the player script URL.
  const page = await fetch("https://www.youtube.com", {
    headers: { "user-agent": BROWSER_UA },
  }).then((r) => r.text());
  const fromYtcfg = /"PLAYER_JS_URL":"\/s\/player\/([a-zA-Z0-9_-]+)\//.exec(page)?.[1];
  if (fromYtcfg) return fromYtcfg;
  throw lastError ?? new Error("Could not get player id");
}

async function createSession(): Promise<PoTokenSession> {
  const playerId = await fetchPlayerId();
  // With cookies, let the server assign the visitor id so the minted token is
  // bound to an identity YouTube actually recognizes.
  const base = await Innertube.create({
    generate_session_locally: !cookie(),
    player_id: playerId,
    cookie: cookie(),
  });
  const localVisitor = base.session.context.client.visitorData;
  if (!localVisitor && !homepageVisitorData) throw new Error("Could not get visitor data");

  minterState = await createMinter();

  const visitorData = (cookie() ? null : homepageVisitorData) ?? localVisitor;
  if (!visitorData) throw new Error("Could not get visitor data");
  const visitorToken = await mintWebsafe(minterState.minter, visitorData);

  const yt = await Innertube.create({
    generate_session_locally: true,
    player_id: playerId,
    visitor_data: visitorData,
    po_token: visitorToken,
    cookie: cookie(),
  });

  return {
    yt,
    mintContent: async (videoId) => {
      try {
        if (!minterState || minterState.expiresAt <= Date.now()) {
          minterState = await createMinter();
        }
        return await mintWebsafe(minterState.minter, videoId);
      } catch {
        return null;
      }
    },
  };
}

let sessionPromise: Promise<PoTokenSession> | null = null;

export async function getPoTokenSession(): Promise<PoTokenSession> {
  if (!sessionPromise) {
    sessionPromise = createSession().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}