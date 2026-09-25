import { AnimatePresence, motion } from "framer-motion";
import { Star } from "pixelarticons/react";
import type { PublicRoomState } from "../../../shared/types";
import { chipStyleFor } from "./ParticipantChip";

type Participant = PublicRoomState["participants"][number];

const rank = (list: Participant[]): Participant[] => {
  const scored = list
    .filter((p) => p.lastScore !== null)
    .sort((a, b) => b.lastScore! - a.lastScore!);
  const unscored = list.filter((p) => p.lastScore === null);
  return [...scored, ...unscored];
};

export function ParticipantList({ participants }: { participants: Participant[] }) {
  return (
    <div data-testid="participant-list" className="mt-4 flex flex-col gap-2">
      {rank(participants).map((p) => {
        const style = chipStyleFor(p.nickname);
        const slug = p.nickname.toLowerCase().replace(/\s+/g, "-");
        return (
          <motion.div
            key={p.nickname}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            data-testid={`participant-row-${slug}`}
            className="flex items-center justify-between rounded-[4px] border-2 border-[#3A2B66] bg-cab-700 px-2 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 ${style.dot}`} />
              <span
                data-testid={`participant-name-${slug}`}
                className="truncate text-xs font-bold text-arc-100"
              >
                {p.nickname}
              </span>
              {p.isHost && (
                <Star role="img" aria-label="Host" className="h-4 w-4 shrink-0 text-gold-500" />
              )}
            </span>
            <span
              data-testid={`participant-score-${slug}`}
              className="font-press text-[11px] text-gold-500"
            >
              {p.lastScore !== null ? p.lastScore : "—"}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}