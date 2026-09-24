import { useEffect, useState, type RefObject } from "react";
import { MoreHorizontal, Repeat1, VolumeX } from "pixelarticons/react";

function IconFullscreen({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2 2h8v2H4v4H2zm12 0h8v2h-6v4h-2zM2 14h2v4h6v2H2zm18 0v8h-8v-2h6v-6z" />
    </svg>
  );
}

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
    <div className="flex items-center justify-center gap-4" aria-label="Player controls">
      <button
        onClick={onToggleRepeat}
        disabled={!canControl}
        aria-pressed={repeatOn}
        aria-label="Repeat this song"
        title="Repeat this song"
        className={`btn btn-ghost h-14 w-14 p-0 text-[12px] disabled:opacity-30 ${
          repeatOn ? `text-cyan-500` : "text-arc-100"
        }`}
      >
        <Repeat1 className="h-5 w-5" />
      </button>
      <button
        onClick={onTogglePlay}
        disabled={!canControl}
        aria-label={playing ? "Pause" : "Play"}
        className="btn btn-primary h-16 w-16 text-[14px] disabled:opacity-30"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        onClick={toggleFullscreen}
        disabled={!hasSong}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className={`btn btn-ghost h-14 w-14 p-0 disabled:opacity-30 ${
          isFullscreen ? `text-cyan-500` : "text-arc-100"
        }`}
      >
        <IconFullscreen className="h-5 w-5" />
      </button>
      <button
        onClick={() => onSeek(-10)}
        disabled={!canControl}
        aria-label="Back 10 seconds"
        className="btn btn-ghost hidden h-14 px-3 text-[10px] text-arc-100 disabled:opacity-30 lg:block"
      >
        -10
      </button>
      <button
        onClick={() => onSeek(10)}
        disabled={!canControl}
        aria-label="Forward 10 seconds"
        className="btn btn-ghost hidden h-14 px-3 text-[10px] text-arc-100 disabled:opacity-30 lg:block"
      >
        +10
      </button>
      <button
        onClick={onToggleMute}
        disabled={!hasSong}
        title={muted ? "Sound off — click to unmute" : "Sound on — click to mute"}
        aria-label={muted ? "Unmute" : "Mute"}
        className={`btn btn-ghost hidden h-14 w-14 p-0 disabled:opacity-30 lg:block ${
          muted ? "text-arc-500 opacity-70" : `text-cyan-500`
        }`}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <IconSoundOn className="h-5 w-5" />}
      </button>
      <button
        onClick={onNext}
        disabled={!canControl}
        aria-label="Next — play the next song"
        className="btn btn-ghost hidden h-14 w-14 p-0 text-[12px] text-arc-100 disabled:opacity-30 lg:block"
      >
        ⏭
      </button>
      <div className="relative lg:hidden">
        <button
          onClick={() => setMoreOpen((o) => !o)}
          disabled={!hasSong}
          aria-expanded={moreOpen}
          aria-haspopup="true"
          aria-label="More options"
          title="More options"
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
            className="absolute bottom-full right-0 z-30 mb-3 flex items-center gap-2 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2 [box-shadow:5px_5px_0_#05030C]"
          >
            <button
              role="menuitem"
              onClick={() => onSeek(-10)}
              disabled={!canControl}
              aria-label="Back 10 seconds"
              className="btn btn-ghost h-12 px-3 text-[10px] text-arc-100 disabled:opacity-30"
            >
              -10
            </button>
            <button
              role="menuitem"
              onClick={() => onSeek(10)}
              disabled={!canControl}
              aria-label="Forward 10 seconds"
              className="btn btn-ghost h-12 px-3 text-[10px] text-arc-100 disabled:opacity-30"
            >
              +10
            </button>
            <button
              role="menuitem"
              onClick={onToggleMute}
              disabled={!hasSong}
              title={muted ? "Sound off — click to unmute" : "Sound on — click to mute"}
              aria-label={muted ? "Unmute" : "Mute"}
              className={`btn btn-ghost h-12 w-12 p-0 disabled:opacity-30 ${
                muted ? "text-arc-500 opacity-70" : `text-cyan-500`
              }`}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <IconSoundOn className="h-5 w-5" />}
            </button>
            <button
              role="menuitem"
              onClick={onNext}
              disabled={!canControl}
              aria-label="Next — play the next song"
              className="btn btn-ghost h-12 w-12 p-0 text-[12px] text-arc-100 disabled:opacity-30"
            >
              ⏭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}