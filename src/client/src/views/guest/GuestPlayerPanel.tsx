import type { RefObject } from "react";
import { Eye, EyeOff, Play, Volume2, VolumeX } from "pixelarticons/react";
import type { QueueItem } from "../../../../shared/types";
import { ParticipantChip } from "../../components/ParticipantChip";
import { socket } from "../../lib/socket";

interface Props {
  nowPlaying: QueueItem | null;
  playing: boolean;
  muted: boolean;
  videoVisible: boolean;
  ownsCurrent: boolean;
  remaining: string;
  progress: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onToggleMute: () => void;
  onSeek: (delta: number) => void;
  onShowVideo: () => void;
  onHideVideo: () => void;
}

export function GuestPlayerPanel({
  nowPlaying,
  playing,
  muted,
  videoVisible,
  ownsCurrent,
  remaining,
  progress,
  containerRef,
  onToggleMute,
  onSeek,
  onShowVideo,
  onHideVideo,
}: Props) {
  function emitAction(action: { type: "play" | "pause" | "next" }) {
    socket.emit("guest:action", action);
  }

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-label="Now playing">
      <div className="crt scanlines relative min-h-[280px] flex-1 overflow-hidden rounded-[4px] border-[3px] border-cab-700 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0">
        {nowPlaying && (
          <span className="absolute top-4 right-4 z-10 rounded-[4px] border-2 border-red-700 bg-red-500 px-3 py-2 font-press text-[10px] text-white [text-shadow:2px_2px_0_#7A1030]">
            On air
          </span>
        )}
        <div ref={containerRef} className="absolute inset-0" />
        {nowPlaying && videoVisible && (
          <button
            onClick={onHideVideo}
            className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-[4px] border-2 border-cab-700 bg-cab-800 px-3 py-2 font-press text-[8px] text-arc-100"
            aria-label="Hide video"
          >
            <EyeOff className="h-4 w-4" />
            Hide video
          </button>
        )}
        {nowPlaying && !videoVisible && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-cab-900">
            <p className="text-sm text-arc-500">Video hidden — saves data.</p>
            <button
              onClick={onShowVideo}
              className="btn btn-accent px-5 py-3 text-[9px]"
              aria-label="Show video"
            >
              <Eye className="h-4 w-4" />
              Show video
            </button>
          </div>
        )}
        {nowPlaying && videoVisible && ownsCurrent && (
          <button
            type="button"
            onClick={() => emitAction({ type: playing ? "pause" : "play" })}
            aria-label={playing ? "Pause video" : "Play video"}
            className="absolute inset-0 z-[5] cursor-pointer"
          />
        )}
        {nowPlaying && videoVisible && !playing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center [&>button]:pointer-events-auto">
            <button
              onClick={() => emitAction({ type: "play" })}
              disabled={!ownsCurrent}
              aria-label="Play"
              className="btn btn-primary h-16 w-16 disabled:opacity-30"
            >
              <Play className="h-5 w-5" />
            </button>
          </div>
        )}
        {!nowPlaying && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-cab-900">
            <p className="text-arc-500">No songs yet — add the first one.</p>
          </div>
        )}
      </div>
      {nowPlaying && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{nowPlaying.title}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-arc-500">
                <span className="truncate">{nowPlaying.channel}</span>
                <ParticipantChip nickname={nowPlaying.addedBy} />
              </div>
            </div>
            <span className="font-press text-[20px] text-gold-500 [text-shadow:0_0_8px_rgba(255,210,62,.55)]">
              {remaining}
            </span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-[4px] border-[3px] border-cab-700 bg-crt-000">
            <div
              className="h-full bg-cyan-500 [background-image:repeating-linear-gradient(90deg,#3EF0FF_0_10px,#19B9C9_10px_14px)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </>
      )}
      <div className="flex items-center justify-center gap-4" aria-label="Player controls">
        <button
          onClick={() => onSeek(-10)}
          disabled={!ownsCurrent}
          className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
          aria-label="Back 10 seconds"
        >
          -10
        </button>
        <button
          onClick={() => emitAction({ type: playing ? "pause" : "play" })}
          disabled={!ownsCurrent}
          className="btn btn-primary h-16 w-16 text-[14px] disabled:opacity-30"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => onSeek(10)}
          disabled={!ownsCurrent}
          className="btn btn-ghost h-14 px-3 text-[10px] disabled:opacity-30"
          aria-label="Forward 10 seconds"
        >
          +10
        </button>
        <button
          onClick={() => emitAction({ type: "next" })}
          disabled={!ownsCurrent}
          className="btn btn-ghost h-14 w-14 disabled:opacity-30"
          aria-label="Next — play the next song"
        >
          ⏭
        </button>
        <button
          onClick={onToggleMute}
          disabled={!nowPlaying}
          title={muted ? "Sound off — click to unmute" : "Sound on — click to mute"}
          aria-label={muted ? "Unmute" : "Mute"}
          className={`btn btn-ghost h-14 w-14 disabled:opacity-30 ${
            muted
              ? "text-arc-500 opacity-70"
              : "text-cyan-500 [box-shadow:5px_5px_0_#05030C,0_0_12px_rgba(62,240,255,.45)] [text-shadow:0_0_8px_rgba(62,240,255,.7)]"
          }`}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </section>
  );
}