import { Check, Music, Redo } from "pixelarticons/react";
import type { QueueItem } from "../../../../shared/types";
import { ParticipantChip } from "../../components/ParticipantChip";

interface Props {
  queue: QueueItem[];
  history: QueueItem[];
  nowPlaying: QueueItem | null;
  addedVideoIds: Set<string>;
  nickname: string;
  onAddSong: () => void;
  onReadd: (item: QueueItem) => void;
}

export function GuestQueuePanel({
  queue,
  history,
  nowPlaying,
  addedVideoIds,
  nickname,
  onAddSong,
  onReadd,
}: Props) {
  return (
    <section className="panel flex flex-col p-5" aria-label="Song queue">
      <h2 className="font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]">
        Queue
      </h2>
      <p className="mt-1 mb-3 font-press text-[8px] tracking-[0.2em] text-gold-500">
        — Today's high scores —
      </p>

      <button
        onClick={onAddSong}
        className="btn btn-accent mb-3 w-full px-4 py-3 text-[9px]"
      >
        + Add song
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {nowPlaying && (
          <>
            <p className="mt-1 mb-2 font-press text-[8px] tracking-[0.2em] text-red-500">
              Now playing
            </p>
            <div className="mb-6 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] border-red-500 bg-cab-800 p-2.5">
              <span className="flex justify-center text-red-500">
                <Music className="h-4 w-4" role="img" aria-label="Now playing" />
              </span>
              <img
                src={nowPlaying.thumbnail}
                alt=""
                className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{nowPlaying.title}</p>
                <ParticipantChip nickname={nowPlaying.addedBy} />
              </div>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between">
          <p className="mb-2 font-press text-[8px] tracking-[0.2em] text-cyan-500">
            Next
          </p>
          <span className="font-press text-[8px] text-arc-500">
            {queue.length} songs
          </span>
        </div>
        {queue.length === 0 && (
          <p className="mb-3 text-sm text-arc-500">Queue is empty.</p>
        )}
        {queue.map((item, index) => (
          <div
            key={item.id}
            className={`mb-2.5 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] bg-cab-800 p-2.5 ${
              item.addedBy === nickname ? "border-gold-500" : "border-cab-700"
            }`}
          >
            <span className="text-center font-press text-[12px] text-arc-500">
              {index + 1}
            </span>
            <img
              src={item.thumbnail}
              alt=""
              className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <ParticipantChip nickname={item.addedBy} />
            </div>
          </div>
        ))}
        {history.length > 0 && (
          <>
            <p className="mt-6 mb-2 font-press text-[8px] tracking-[0.2em] text-arc-500">
              Played
            </p>
            {history.map((item) => (
              <div
                key={item.id}
                className="mb-2.5 grid grid-cols-[28px_80px_1fr_auto] items-center gap-3 rounded-[4px] border-[3px] border-cab-700 bg-cab-800 p-2.5 opacity-80"
              >
                <Check className="mx-auto h-4 w-4 text-arc-500" />
                <img
                  src={item.thumbnail}
                  alt=""
                  className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <ParticipantChip nickname={item.addedBy} />
                </div>
                {addedVideoIds.has(item.videoId) ? (
                  <Check
                    role="img"
                    aria-label="Added"
                    className="mr-1 h-4 w-4 text-cyan-500"
                  />
                ) : (
                  <button
                    aria-label={`Add ${item.title} to queue again`}
                    onClick={() => onReadd(item)}
                    className="btn btn-ghost h-9 w-9 p-0 text-arc-100"
                  >
                    <Redo className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}