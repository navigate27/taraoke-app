import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Close,
  Music,
  Play,
  Redo,
} from "pixelarticons/react";
import type { QueueItem } from "../../../../shared/types";
import type { SearchResult } from "../../../../server/youtube";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ParticipantChip } from "../../components/ParticipantChip";
import { SongSuggestions } from "../../components/SongSuggestions";
import { socket } from "../../lib/socket";
import { useQueueDrag } from "../../lib/useQueueDrag";

interface Props {
  token: string;
  queue: QueueItem[];
  history: QueueItem[];
  nowPlaying: QueueItem | null;
  addedVideoIds: Set<string>;
  addedTitles: Set<string>;
  onPlayItem: (item: QueueItem) => void;
  onAddSong: () => void;
  onReadd: (item: QueueItem) => void;
  onSuggestionAdd: (result: SearchResult) => void;
}

export function HostQueuePanel({
  token,
  queue,
  history,
  nowPlaying,
  addedVideoIds,
  addedTitles,
  onPlayItem,
  onAddSong,
  onReadd,
  onSuggestionAdd,
}: Props) {
  const [removeItem, setRemoveItem] = useState<QueueItem | null>(null);
  const [tab, setTab] = useState<"next" | "played">("next");
  const { draggingIndex, dragOverIndex, onRowPointerDown } = useQueueDrag(
    (itemId, toIndex) => socket.emit("queue:reorder", itemId, toIndex),
  );
  const playedVisible = history.filter((item) => !addedVideoIds.has(item.videoId));

  return (
    <section className="panel flex flex-col p-5" aria-label="Song queue" data-testid="queue-panel">
      <h2
        data-testid="queue-heading"
        className="font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]"
      >
        Queue
      </h2>

      <button
        data-testid="queue-btn-add"
        onClick={onAddSong}
        className="btn btn-primary mb-3 w-full px-4 py-3 text-[9px]"
      >
        + Add song
      </button>

      <div className="flex min-h-0 flex-1 flex-col">
        {nowPlaying && (
          <>
            <p
              data-testid="queue-now-label"
              className="mt-1 mb-2 font-press text-[9px] tracking-[0.2em] text-neon-500"
            >
              Now playing
            </p>
            <div
              key={nowPlaying.id}
              data-testid="queue-now-card"
              className="track-flip mb-6 grid grid-cols-[28px_80px_1fr] items-center gap-3 rounded-[4px] border-[3px] border-neon-500 bg-cab-800 p-2.5 [box-shadow:0_0_12px_rgba(228,59,255,.35)]"
            >
              <span className="flex justify-center text-neon-500">
                <Music className="h-4 w-4" role="img" aria-label="Now playing" />
              </span>
              <img
                src={nowPlaying.thumbnail}
                alt=""
                className="aspect-video w-[80px] rounded-[4px] border-2 border-cab-700 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{nowPlaying.title}</p>
                <ParticipantChip nickname={nowPlaying.addedBy} size="sm" />
              </div>
            </div>
          </>
        )}
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Queue sections">
          <button
            role="tab"
            aria-selected={tab === "next"}
            data-testid="queue-tab-next"
            onClick={() => setTab("next")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[4px] border-[3px] px-3 py-2 font-press text-[9px] uppercase ${
              tab === "next"
                ? "border-cyan-500 text-cyan-500"
                : "border-transparent text-arc-500"
            }`}
          >
            Next
            <span data-testid="queue-count" className="text-[8px] text-arc-500">
              {queue.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "played"}
            data-testid="queue-tab-played"
            onClick={() => setTab("played")}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-[4px] border-[3px] px-3 py-2 font-press text-[9px] uppercase ${
              tab === "played"
                ? "border-cyan-500 text-cyan-500"
                : "border-transparent text-arc-500"
            }`}
          >
            Played
          </button>
        </div>
        <div className="scroll-thin mb-3 max-h-[360px] min-h-0 flex-1 overflow-y-auto pr-1"
        data-queue-scroll>
        {tab === "next" && queue.length === 0 && (
          <p data-testid="queue-empty" className="mb-3 text-sm text-arc-500">
            Queue is empty.
          </p>
        )}
        {tab === "next" && (
        <div data-next-list>
          {queue.map((item, index) => (
          <div
            key={item.id}
            data-testid={`queue-row-${item.id}`}
            onPointerDown={onRowPointerDown(index, item.id)}
            className={`mb-2.5 cursor-grab select-none rounded-[4px] border-[3px] bg-cab-800 p-2.5 [-webkit-touch-callout:none] ${
              draggingIndex === index
                ? "border-neon-500 opacity-60 [box-shadow:0_0_12px_rgba(228,59,255,.45)]"
                : "border-cab-700"
            } ${
              dragOverIndex === index && draggingIndex !== null && draggingIndex !== index
                ? "!border-cyan-500 [box-shadow:0_0_12px_rgba(62,240,255,.4)]"
                : ""
            }`}
          >
            <div className="grid grid-cols-[28px_80px_1fr] items-center gap-3">
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
                <ParticipantChip nickname={item.addedBy} size="sm" />
              </div>
            </div>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                aria-label={`Play ${item.title} now`}
                data-testid={`queue-btn-play-${item.id}`}
                data-tip="Play now"
                onClick={() => onPlayItem(item)}
                className="btn btn-primary h-10 w-10 p-0 text-[12px]"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${item.title} up`}
                data-testid={`queue-btn-up-${item.id}`}
                data-tip="Move up"
                disabled={index === 0}
                onClick={() =>
                  socket.emit("queue:reorder", item.id, index - 1)
                }
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                data-testid={`queue-btn-down-${item.id}`}
                data-tip="Move down"
                disabled={index === queue.length - 1}
                onClick={() =>
                  socket.emit("queue:reorder", item.id, index + 1)
                }
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                aria-label={`Remove ${item.title}`}
                data-testid={`queue-btn-remove-${item.id}`}
                data-tip="Remove"
                data-tip-side="left"
                onClick={() => setRemoveItem(item)}
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-red-500"
              >
                <Close className="h-4 w-4" />
              </button>
            </div>
          </div>
          ))}
        </div>
        )}
        {tab === "played" && playedVisible.length === 0 && (
          <p data-testid="history-empty" className="mb-3 text-sm text-arc-500">
            No songs played yet.
          </p>
        )}
        {tab === "played" && playedVisible.length > 0 && (
          <>
            {playedVisible.map((item) => (
              <div
                key={item.id}
                data-testid={`history-row-${item.id}`}
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
                  <ParticipantChip nickname={item.addedBy} size="sm" />
                </div>
                <button
                  aria-label={`Add ${item.title} to queue again`}
                  data-testid={`history-btn-readd-${item.id}`}
                  data-tip="Queue again"
                  data-tip-side="left"
                  onClick={() => onReadd(item)}
                  className="btn btn-ghost h-9 w-9 p-0 text-arc-100"
                >
                  <Redo className="h-4 w-4" />
                </button>
              </div>
            ))}
          </>
        )}
        </div>
        <div className="mt-auto">
          <SongSuggestions
            seedCandidates={[nowPlaying, ...queue, ...history]
              .filter((i): i is QueueItem => !!i)
              .map((i) => ({ title: i.title, channel: i.channel }))}
            addedVideoIds={addedVideoIds}
            addedTitles={addedTitles}
            onAdd={onSuggestionAdd}
          />
        </div>
      </div>

      {removeItem && (
        <ConfirmDialog
          title="Remove song?"
          message={`"${removeItem.title}" will leave the queue.`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          danger
          testIdPrefix="remove"
          onConfirm={() => {
            socket.emit("host:action", token, { type: "remove", itemId: removeItem.id });
            setRemoveItem(null);
          }}
          onCancel={() => setRemoveItem(null)}
        />
      )}
    </section>
  );
}