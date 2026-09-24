/* Minimal typings for the YouTube IFrame Player API */

export interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

type YTPlayerEvent = { target: YTPlayer; data: number };

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      playerVars?: Record<string, unknown>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export const YTEvents = {
  ENDED: YT_STATE_ENDED,
  PLAYING: YT_STATE_PLAYING,
  PAUSED: YT_STATE_PAUSED,
} as const;

export function formatClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "--:--";
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}