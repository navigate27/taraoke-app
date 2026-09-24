import { ParticipantChip } from "./ParticipantChip";

export function ParticipantChips({
  participants,
}: {
  participants: { nickname: string; isHost: boolean }[];
}) {
  return (
    <div data-testid="chip-list" className="mt-4 flex flex-wrap gap-2">
      {participants.map((p) => (
        <ParticipantChip key={p.nickname} nickname={p.nickname} isHost={p.isHost} />
      ))}
    </div>
  );
}