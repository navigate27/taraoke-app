import type { QueueItem } from "../../../../shared/types";
import { ParticipantChip } from "../../components/ParticipantChip";
import { PlayerControls } from "../../components/PlayerControls";
import { socket } from "../../lib/socket";

interface Props {
  nowPlaying: QueueItem | null;
  hasSongs: boolean;
  playing: boolean;
  repeatOn: boolean;
  remaining: string;
  progress: number;
  onTogglePlay: () => void;
  onToggleRepeat: () => void;
  onSeek: (delta: number) => void;
}

export function GuestPlayerPanel({
  nowPlaying,
  hasSongs,
  playing,
  repeatOn,
  remaining,
  progress,
  onTogglePlay,
  onToggleRepeat,
  onSeek,
}: Props) {
  function emitAction(action: { type: "play" | "pause" | "next" }) {
    socket.emit("guest:action", action);
  }

  return (
    <section className="panel flex flex-1 flex-col justify-center gap-4 p-5" aria-label="Now playing" data-testid="player-panel">
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
        muted={false}
        hasSong={!!nowPlaying}
        canControl={hasSongs}
        hasAudio={false}
        fullscreen={false}
        repeatOn={repeatOn}
        onTogglePlay={onTogglePlay}
        onToggleRepeat={onToggleRepeat}
        onToggleMute={() => {}}
        onSeek={onSeek}
        onNext={() => emitAction({ type: "next" })}
      />
    </section>
  );
}