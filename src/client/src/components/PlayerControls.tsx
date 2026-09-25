import { useEffect, useState, type RefObject } from "react";
import { Reload, Scale, VolumeX } from "pixelarticons/react";

function IconSoundOn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13 22h-2v-2H9v-2h2V6H9V4h2V2h2v20Zm-4-4H7v-2h2v2Zm-2-8H5v4h2v2H3V8h4v2ZM9 8H7V6h2v2Zm6 0h2v8h-2Zm4-2h2v12h-2Z" />
    </svg>
  );
}

interface Props {
  playing: boolean;
  muted: boolean;
  hasSong: boolean;
  canControl: boolean;
  hasAudio?: boolean;
  fullscreen?: boolean;
  repeatOn: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onToggleRepeat: () => void;
  onToggleMute: () => void;
  onSeek: (delta: number) => void;
  onNext: () => void;
}

export function PlayerControls({
  playing,
  muted,
  hasSong,
  canControl,
  hasAudio = true,
  fullscreen = true,
  repeatOn,
  containerRef,
  onTogglePlay,
  onToggleRepeat,
  onToggleMute,
  onSeek,
  onNext,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    const el = containerRef?.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  return (
    <div
      className="flex flex-col items-center gap-3"
      aria-label="Player controls"
      data-testid="transport-panel"
    >
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 max-md:w-fit max-md:mx-auto max-md:grid-cols-[auto_auto] max-md:grid-rows-[auto_auto] max-md:justify-items-center max-md:gap-3">
        <div className="justify-self-start max-md:col-start-1 max-md:row-start-2 max-md:justify-self-center md:col-start-1 md:row-start-1">
          {hasAudio && (
            <button
              data-testid="transport-btn-mute"
              onClick={onToggleMute}
              disabled={!hasSong}
              aria-label={muted ? "Unmute" : "Mute"}
              data-tip={muted ? "Unmute" : "Mute"}
              className={`btn btn-ghost h-12 px-4 disabled:opacity-30 ${
                muted ? "text-arc-500 opacity-70" : `text-cyan-500`
              }`}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <IconSoundOn className="h-5 w-5" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4 max-md:col-span-2 max-md:col-start-1 max-md:row-start-1 max-md:justify-self-center md:col-start-2 md:row-start-1">
          <button
            data-testid="transport-btn-repeat"
            onClick={onToggleRepeat}
            disabled={!canControl}
            aria-pressed={repeatOn}
            aria-label="Repeat this song"
            data-tip={repeatOn ? "Repeat on" : "Repeat"}
            className={`btn btn-ghost h-14 w-14 max-md:h-12 max-md:w-12 p-0 text-[12px] disabled:opacity-30 ${
              repeatOn ? `text-cyan-500` : "text-arc-100"
            }`}
          >
            <Reload className="h-5 w-5" />
          </button>
          <button
            data-testid="transport-btn-back"
            onClick={() => onSeek(-10)}
            disabled={!canControl}
            aria-label="Back 10 seconds"
            className="btn btn-ghost h-14 max-md:h-12 px-3 max-md:px-2 text-[10px] text-arc-100 disabled:opacity-30"
          >
            -10
          </button>
          <button
            data-testid="transport-btn-play"
            onClick={onTogglePlay}
            disabled={!canControl}
            aria-label={playing ? "Pause" : "Play"}
            data-tip={playing ? "Pause" : "Play"}
            className="btn btn-primary h-16 max-md:h-14 w-16 max-md:w-14 text-[14px] disabled:opacity-30"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            data-testid="transport-btn-forward"
            onClick={() => onSeek(10)}
            disabled={!canControl}
            aria-label="Forward 10 seconds"
            className="btn btn-ghost h-14 max-md:h-12 px-3 max-md:px-2 text-[10px] text-arc-100 disabled:opacity-30"
          >
            +10
          </button>
          <button
            data-testid="transport-btn-next"
            onClick={onNext}
            disabled={!canControl}
            aria-label="Next — play the next song"
            data-tip="Next"
            className="btn btn-ghost h-14 max-md:h-12 w-14 max-md:w-12 p-0 text-[12px] text-arc-100 disabled:opacity-30"
          >
            ⏭
          </button>
        </div>
        <div className="justify-self-end max-md:col-start-2 max-md:row-start-2 max-md:justify-self-center md:col-start-3 md:row-start-1">
          {fullscreen && (
            <button
              data-testid="transport-btn-fullscreen"
              onClick={toggleFullscreen}
              disabled={!hasSong}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-tip={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className={`btn btn-ghost h-12 px-4 disabled:opacity-30 ${
                isFullscreen ? `text-cyan-500` : "text-arc-100"
              }`}
            >
              <Scale className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}