import { useEffect, useRef, useState } from "react";
import type {
  GuestAction,
  PlayerState,
  PublicRoomState,
} from "../../../../shared/types";
import type { SearchResult } from "../../../../server/youtube";
import { JoinPanel } from "../../components/JoinPanel";
import { RoomHeader } from "../../components/RoomHeader";
import { SongsSearchModal } from "../../components/SongsSearchModal";
import { normalizeTitle } from "../../../../shared/songTitle";
import { socket } from "../../lib/socket";
import { formatClock } from "../../lib/formatClock";
import { GuestPlayerPanel } from "./GuestPlayerPanel";
import { GuestQueuePanel } from "./GuestQueuePanel";

interface Props {
  code: string;
  nickname: string;
  onExit: () => void;
}

const GUEST_KEY = "taraoke.guest";

export function saveGuest(code: string, nickname: string): void {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ code, nickname }));
}

export function clearGuest(): void {
  localStorage.removeItem(GUEST_KEY);
}

export function loadGuest(): { code: string; nickname: string } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "");
    if (typeof parsed?.code === "string" && typeof parsed?.nickname === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function Guest({ code, nickname, onExit }: Props) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const localPlayingRef = useRef(false);

  useEffect(() => {
    const join = () =>
      socket.emit("room:join", code, nickname, null, (res) => {
        if (!res.ok) onExit();
      });
    join();
    // Mobile browsers kill the socket when the tab is backgrounded; rejoin
    // on the next connection so the guest keeps their seat.
    let needRejoin = false;
    const onConnect = () => {
      if (needRejoin) {
        needRejoin = false;
        join();
      }
    };
    const onDisconnect = () => {
      needRejoin = true;
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    const pingTimer = window.setInterval(() => socket.emit("room:ping"), 25000);
    const onRoomState = (s: PublicRoomState) => setState(s);
    const onParticipantJoined = (joined: string) => {
      showToast(`${joined} joined the room`);
    };
    const onParticipantLeft = (left: string) => {
      if (left === nickname) return;
      showToast(`${left} left the room`);
    };
    const onPlayerState = (p: PlayerState) => {
      setPosition(p.positionSec);
      setDuration(p.durationSec ?? 0);
      setRepeatOn(p.repeatOn);
      if (!p.videoId) {
        localPlayingRef.current = false;
        setPlaying(false);
        return;
      }
      if (p.playing !== localPlayingRef.current) {
        localPlayingRef.current = p.playing;
        setPlaying(p.playing);
      }
    };
    socket.on("roomState", onRoomState);
    socket.on("participantJoined", onParticipantJoined);
    socket.on("participantLeft", onParticipantLeft);
    socket.on("playerState", onPlayerState);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomState", onRoomState);
      socket.off("participantJoined", onParticipantJoined);
      socket.off("participantLeft", onParticipantLeft);
      socket.off("playerState", onPlayerState);
      window.clearInterval(pingTimer);
      window.clearTimeout(toastTimer.current);
      // No room:leave here — it also fires on page unload (refresh), which
      // turns a refresh into a leave+rejoin and spams toasts. Leaving the
      // room view via history emits room:leave in App; a refresh is covered
      // by the disconnect grace period instead.
    };
  }, [code, nickname, onExit]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  function emitAction(action: GuestAction) {
    socket.emit("guest:action", action);
  }

  function seekBy(delta: number) {
    emitAction({ type: "seek", positionSec: Math.max(0, position + delta) });
  }

  function toggleRepeat() {
    emitAction({ type: "repeat", on: !repeatOn });
  }

  function addToQueue(result: SearchResult) {
    socket.emit(
      "queue:add",
      {
        videoId: result.videoId,
        title: result.title,
        channel: result.channel,
        durationSec: result.durationSec ?? 0,
        thumbnail: result.thumbnail,
      },
      (res) => {
        if (res.ok) {
          showToast(`Added to queue — you're #${res.position} in line`);
        } else {
          showToast(res.error ?? "Could not add song");
        }
      },
    );
  }

  const queue = state?.queue ?? [];
  const history = state?.history ?? [];
  const participants = state?.participants ?? [];
  const nowPlaying = state?.nowPlaying ?? null;
  const progress = duration ? Math.min(1, position / duration) : 0;
  const remaining = duration ? formatClock(Math.max(0, duration - position)) : "--:--";
  const addedVideoIds = new Set([
    ...(nowPlaying ? [nowPlaying.videoId] : []),
    ...queue.map((q) => q.videoId),
  ]);
  const addedTitles = new Set(
    [nowPlaying?.title, ...queue.map((q) => q.title), ...history.map((h) => h.title)]
      .filter((t): t is string => !!t)
      .map(normalizeTitle)
      .filter((t) => t.length > 0),
  );
  const upNext = queue[0]?.addedBy === nickname ? queue[0] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader
        code={code}
        remaining={remaining}
        sessionStartedAt={state?.sessionStartedAt ?? null}
      />

      <main className="grid flex-1 grid-cols-1 items-stretch gap-5 p-6 lg:grid-cols-[300px_1fr_340px]">
        <JoinPanel code={code} participants={participants} collapsibleJoin />

        <div className="flex min-w-0 flex-col gap-4">
          {upNext && (
            <div
              key={upNext.id}
              data-testid="upnext-callout"
              className="up-next-pulse flex items-center gap-3 rounded-[4px] border-[3px] border-gold-500 bg-gold-500/10 p-3"
              role="status"
            >
              <span className="font-press text-[9px] leading-relaxed text-gold-500 [text-shadow:0_0_8px_rgba(255,210,62,.7)]">
                You're
                <br />
                up next!
              </span>
              <p className="min-w-0 text-sm font-semibold">
                {upNext.title}
                <span className="block text-xs font-medium text-arc-500">
                  added by {upNext.addedBy}
                </span>
              </p>
            </div>
          )}

          <GuestPlayerPanel
            nowPlaying={nowPlaying}
            hasSongs={!!nowPlaying || queue.length > 0}
            playing={playing}
            repeatOn={repeatOn}
            remaining={remaining}
            progress={progress}
            onTogglePlay={() =>
              emitAction({ type: playing ? "pause" : "play" })
            }
            onToggleRepeat={toggleRepeat}
            onSeek={seekBy}
          />
        </div>

        <GuestQueuePanel
          queue={queue}
          history={history}
          nowPlaying={nowPlaying}
          addedVideoIds={addedVideoIds}
          addedTitles={addedTitles}
          nickname={nickname}
          onAddSong={() => setSearchOpen(true)}
          onReadd={addToQueue}
          onSuggestionAdd={addToQueue}
        />
      </main>

      {searchOpen && (
        <SongsSearchModal
          onClose={() => setSearchOpen(false)}
          onAdd={addToQueue}
          addedVideoIds={addedVideoIds}
        />
      )}

      {toast && (
        <div
          className="crt fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-[4px] border-[3px] border-cab-700 px-5 py-3 text-sm font-semibold text-cyan-500"
          role="status"
          data-testid="toast"
        >
          {toast}
        </div>
      )}
    </div>
  );
}