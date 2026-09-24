import { useEffect, useRef, useState } from "react";
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ParticipantChip } from "../../components/ParticipantChip";
import { socket } from "../../lib/socket";

interface Props {
  token: string;
  queue: QueueItem[];
  history: QueueItem[];
  nowPlaying: QueueItem | null;
  addedVideoIds: Set<string>;
  onPlayItem: (item: QueueItem) => void;
  onAddSong: () => void;
  onReadd: (item: QueueItem) => void;
}

export function HostQueuePanel({
  token,
  queue,
  history,
  nowPlaying,
  addedVideoIds,
  onPlayItem,
  onAddSong,
  onReadd,
}: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [removeItem, setRemoveItem] = useState<QueueItem | null>(null);
  const pendingDragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const queueRef = useRef<QueueItem[]>([]);

  queueRef.current = queue;

  useEffect(() => {
    function rowAt(clientY: number): HTMLElement | null {
      const rows = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Song queue"] [data-next-list] > div',
        ),
      ];
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) return row;
      }
      return null;
    }

    function onPointerMove(e: PointerEvent) {
      const pending = pendingDragRef.current;
      if (!pending) return;
      let ghost = ghostRef.current;
      if (!ghost) {
        if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < 6) return;
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            '[aria-label="Song queue"] [data-next-list] > div',
          ),
        ];
        const row = rows[pending.index];
        if (!row) return;
        const rect = row.getBoundingClientRect();
        pending.offsetX = e.clientX - rect.left;
        pending.offsetY = e.clientY - rect.top;
        ghost = row.cloneNode(true) as HTMLElement;
        ghost.style.position = "fixed";
        ghost.style.width = `${rect.width}px`;
        ghost.style.margin = "0";
        ghost.style.pointerEvents = "none";
        ghost.style.opacity = "0.9";
        ghost.style.zIndex = "60";
        ghost.style.transform = "rotate(4deg)";
        ghost.style.left = `${e.clientX - pending.offsetX}px`;
        ghost.style.top = `${e.clientY - pending.offsetY}px`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        setDraggingIndex(pending.index);
        return;
      }
      ghost.style.left = `${e.clientX - pending.offsetX}px`;
      ghost.style.top = `${e.clientY - pending.offsetY}px`;
      const over = rowAt(e.clientY);
      setDragOverIndex(over ? [...(over.parentNode?.childNodes ?? [])].indexOf(over) : null);
    }

    function onPointerUp(e: PointerEvent) {
      const pending = pendingDragRef.current;
      const ghost = ghostRef.current;
      pendingDragRef.current = null;
      if (!ghost) return;
      ghost.remove();
      ghostRef.current = null;
      const from = pending?.index ?? null;
      const target = rowAt(e.clientY);
      let to: number | null = null;
      if (target) {
        to = [...(target.parentNode?.childNodes ?? [])].indexOf(target);
      }
      if (from !== null && to !== null && from !== to) {
        const dragged = queueRef.current[from];
        if (dragged) {
          socket.emit("host:action", token, {
            type: "reorder",
            itemId: dragged.id,
            toIndex: to,
          });
        }
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [token]);

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
        className="btn btn-primary mb-3 w-full px-4 py-3 text-[9px]"
      >
        + Add song
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {nowPlaying && (
          <>
            <p className="mt-1 mb-2 font-press text-[8px] tracking-[0.2em] text-neon-500">
              Now playing
            </p>
            <div
              key={nowPlaying.id}
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
        <div data-next-list>
          {queue.map((item, index) => (
          <div
            key={item.id}
            onPointerDown={(e) => {
              if (e.button !== 0 || e.pointerType === "touch") return;
              if ((e.target as HTMLElement).closest("button")) return;
              pendingDragRef.current = {
                index,
                startX: e.clientX,
                startY: e.clientY,
                offsetX: 0,
                offsetY: 0,
              };
            }}
            className={`mb-2.5 cursor-grab select-none rounded-[4px] border-[3px] bg-cab-800 p-2.5 ${
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
                onClick={() => onPlayItem(item)}
                className="btn btn-primary h-10 w-10 p-0 text-[12px]"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${item.title} up`}
                disabled={index === 0}
                onClick={() =>
                  socket.emit("host:action", token, {
                    type: "reorder",
                    itemId: item.id,
                    toIndex: index - 1,
                  })
                }
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                disabled={index === queue.length - 1}
                onClick={() =>
                  socket.emit("host:action", token, {
                    type: "reorder",
                    itemId: item.id,
                    toIndex: index + 1,
                  })
                }
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-arc-100 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                aria-label={`Remove ${item.title}`}
                onClick={() => setRemoveItem(item)}
                className="btn btn-ghost h-10 w-10 p-0 text-[12px] text-red-500"
              >
                <Close className="h-4 w-4" />
              </button>
            </div>
          </div>
          ))}
        </div>
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
                  <ParticipantChip nickname={item.addedBy} size="sm" />
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

      {removeItem && (
        <ConfirmDialog
          title="Remove song?"
          message={`"${removeItem.title}" will leave the queue.`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          danger
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