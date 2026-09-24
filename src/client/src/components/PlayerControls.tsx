import { useEffect, useState, type RefObject } from "react";
import { MoreHorizontal, Reload, Scale, VolumeX } from "pixelarticons/react";

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
  repeatOn: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
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
  repeatOn,
  containerRef,
  onTogglePlay,
  onToggleRepeat,
  onToggleMute,
  onSeek,
  onNext,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  return (
    <div
      className="relative flex items-center justify-center gap-4"
      aria-label="Player controls"
      data-testid="transport-panel"
    >
      <div className="flex items-center gap-4">
        <button
          data-testid="transport-btn-repeat"
          onClick={onToggleRepeat}
          disabled={!canControl}
          aria-pressed={repeatOn}
          aria-label="Repeat this song"
          data-tip={repeatOn ? "Repeat on" : "Repeat"}
          className={`btn btn-ghost h-14 w-14 p-0 text-[12px] disabled:opacity-30 ${
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
          className="btn btn-ghost hidden h-14 px-3 text-[10px] text-arc-100 disabled:opacity-30 lg:block"
        >
          -10
        </button>
        <button
          data-testid="transport-btn-play"
          onClick={onTogglePlay}
          disabled={!canControl}
          aria-label={playing ? "Pause" : "Play"}
          data-tip={playing ? "Pause" : "Play"}
          className="btn btn-primary h-16 w-16 text-[14px] disabled:opacity-30"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          data-testid="transport-btn-forward"
          onClick={() => onSeek(10)}
          disabled={!canControl}
          aria-label="Forward 10 seconds"
          className="btn btn-ghost hidden h-14 px-3 text-[10px] text-arc-100 disabled:opacity-30 lg:block"
        >
          +10
        </button>
        <button
          data-testid="transport-btn-next"
          onClick={onNext}
          disabled={!canControl}
          aria-label="Next — play the next song"
          data-tip="Next"
          className="btn btn-ghost h-14 w-14 p-0 text-[12px] text-arc-100 disabled:opacity-30"
        >
          ⏭
        </button>
      </div>
      <div className="absolute right-0 flex items-center gap-4">
        <button
          data-testid="transport-btn-mute"
          onClick={onToggleMute}
          disabled={!hasSong}
          aria-label={muted ? "Unmute" : "Mute"}
          data-tip={muted ? "Unmute" : "Mute"}
          data-tip-side="left"
          className={`btn btn-ghost hidden h-14 px-3 disabled:opacity-30 lg:block ${
            muted ? "text-arc-500 opacity-70" : `text-cyan-500`
          }`}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <IconSoundOn className="h-5 w-5" />}
        </button>
        <button
          data-testid="transport-btn-fullscreen"
          onClick={toggleFullscreen}
          disabled={!hasSong}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          data-tip={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          data-tip-side="left"
          className={`btn btn-ghost hidden h-14 px-3 disabled:opacity-30 lg:block ${
            isFullscreen ? `text-cyan-500` : "text-arc-100"
          }`}
        >
          <Scale className="h-5 w-5" />
        </button>
        <div className="relative lg:hidden">
          <button
            data-testid="transport-btn-more"
            onClick={() => setMoreOpen((o) => !o)}
            disabled={!hasSong}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            aria-label="More options"
            data-tip="More options"
            data-tip-side="left"
            className={`btn btn-ghost h-14 w-14 p-0 disabled:opacity-30 ${
              moreOpen ? `text-cyan-500` : "text-arc-100"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {moreOpen && (
            <div
              role="menu"
              aria-label="More player options"
              data-testid="transport-menu"
              className="absolute bottom-full right-0 z-30 mb-3 flex items-center gap-2 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2 [box-shadow:5px_5px_0_#05030C]"
            >
              <button
                role="menuitem"
                data-testid="transport-btn-back-menu"
                onClick={() => onSeek(-10)}
                disabled={!canControl}
                aria-label="Back 10 seconds"
                className="btn btn-ghost h-12 px-3 text-[10px] text-arc-100 disabled:opacity-30"
              >
                -10
              </button>
              <button
                role="menuitem"
                data-testid="transport-btn-forward-menu"
                onClick={() => onSeek(10)}
                disabled={!canControl}
                aria-label="Forward 10 seconds"
                className="btn btn-ghost h-12 px-3 text-[10px] text-arc-100 disabled:opacity-30"
              >
                +10
              </button>
              <button
                role="menuitem"
                data-testid="transport-btn-mute-menu"
                onClick={onToggleMute}
                disabled={!hasSong}
                aria-label={muted ? "Unmute" : "Mute"}
                data-tip={muted ? "Unmute" : "Mute"}
                data-tip-side="left"
                className={`btn btn-ghost h-12 w-12 p-0 disabled:opacity-30 ${
                  muted ? "text-arc-500 opacity-70" : `text-cyan-500`
                }`}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <IconSoundOn className="h-5 w-5" />}
              </button>
              <button
                role="menuitem"
                data-testid="transport-btn-fullscreen-menu"
                onClick={toggleFullscreen}
                disabled={!hasSong}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                data-tip={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                data-tip-side="left"
                className={`btn btn-ghost h-12 w-12 p-0 disabled:opacity-30 ${
                  isFullscreen ? `text-cyan-500` : "text-arc-100"
                }`}
              >
                <Scale className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}