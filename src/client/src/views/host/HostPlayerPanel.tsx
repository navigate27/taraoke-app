import type { RefObject } from "react";
import { Play } from "pixelarticons/react";
import type { QueueItem } from "../../../../shared/types";
import { ParticipantChip } from "../../components/ParticipantChip";
import { PlayerControls } from "../../components/PlayerControls";

interface Props {
  nowPlaying: QueueItem | null;
  playing: boolean;
  remaining: string;
  progress: number;
  muted: boolean;
  repeatOn: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoEnded: () => void;
  onVideoError: () => void;
  onTogglePlay: () => void;
  onToggleRepeat: () => void;
  onSeek: (delta: number) => void;
  onToggleMute: () => void;
  onNext: () => void;
}

export function HostPlayerPanel({
  nowPlaying,
  playing,
  remaining,
  progress,
  muted,
  repeatOn,
  containerRef,
  videoRef,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
  onVideoError,
  onTogglePlay,
  onToggleRepeat,
  onSeek,
  onToggleMute,
  onNext,
}: Props) {
  return (
    <section className="panel flex flex-col gap-4 p-5" aria-label="Now playing" data-testid="player-panel">
      <div className="crt relative min-h-[280px] flex-1 overflow-hidden rounded-[4px] border-[3px] border-cab-700">
        {nowPlaying && (
          <span
            data-testid="player-badge-live"
            className="absolute top-4 right-4 z-10 rounded-[4px] border-2 border-red-700 bg-red-500 px-3 py-2 font-press text-[10px] text-white [text-shadow:2px_2px_0_#7A1030]"
          >
            LIVE
          </span>
        )}
        <div ref={containerRef} className="absolute inset-0">
          {nowPlaying && (
            <video
              ref={videoRef}
              data-testid="player-video"
              key={nowPlaying.videoId}
              className="h-full w-full"
              src={`/api/stream/${nowPlaying.videoId}`}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onPlay={onVideoPlay}
              onPause={onVideoPause}
              onEnded={onVideoEnded}
              onError={onVideoError}
            />
          )}
        </div>
        {nowPlaying && (
          <button
            type="button"
            data-testid="player-btn-video-toggle"
            onClick={onTogglePlay}
            aria-label={playing ? "Pause video" : "Play video"}
            className="absolute inset-0 z-[5] cursor-pointer"
          />
        )}
        {nowPlaying && !playing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center [&>button]:pointer-events-auto">
            <button
              data-testid="player-btn-resume"
              onClick={onTogglePlay}
              aria-label="Play"
              className="btn btn-primary h-16 w-16"
            >
              <Play className="h-5 w-5" />
            </button>
          </div>
        )}
        {!nowPlaying && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-cab-900">
            <p data-testid="player-empty" className="text-arc-500">
              No songs yet — add the first one.
            </p>
          </div>
        )}
      </div>
      {nowPlaying && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p data-testid="player-title" className="text-lg font-semibold">
                {nowPlaying.title}
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm text-arc-500">
                <span data-testid="player-channel" className="truncate">
                  {nowPlaying.channel}
                </span>
                <ParticipantChip nickname={nowPlaying.addedBy} size="sm" />
              </div>
            </div>
            <span
              data-testid="player-remaining"
              className="font-press text-[20px] text-gold-500 [text-shadow:0_0_8px_rgba(255,210,62,.55)]"
            >
              {remaining}
            </span>
          </div>
          <div
            data-testid="player-progress"
            className="h-3.5 overflow-hidden rounded-[4px] border-[3px] border-cab-700 bg-crt-000"
          >
            <div
              data-testid="player-progress-fill"
              className="h-full bg-cyan-500 [background-image:repeating-linear-gradient(90deg,#3EF0FF_0_10px,#19B9C9_10px_14px)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </>
      )}
      <PlayerControls
        playing={playing}
        muted={muted}
        hasSong={!!nowPlaying}
        canControl={!!nowPlaying}
        repeatOn={repeatOn}
        containerRef={containerRef}
        onTogglePlay={onTogglePlay}
        onToggleRepeat={onToggleRepeat}
        onToggleMute={onToggleMute}
        onSeek={onSeek}
        onNext={onNext}
      />
    </section>
  );
}