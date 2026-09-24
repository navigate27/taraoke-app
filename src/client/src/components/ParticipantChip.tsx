import { Star } from "pixelarticons/react";

const CHIP_STYLES = [
  { border: "border-neon-500", text: "text-neon-500", glow: "[text-shadow:0_0_7px_rgba(228,59,255,.7)]" },
  { border: "border-cyan-500", text: "text-cyan-500", glow: "[text-shadow:0_0_7px_rgba(62,240,255,.7)]" },
  { border: "border-gold-500", text: "text-gold-500", glow: "[text-shadow:0_0_7px_rgba(255,210,62,.7)]" },
  { border: "border-red-500", text: "text-red-500", glow: "[text-shadow:0_0_7px_rgba(255,61,90,.7)]" },
] as const;

export function chipStyleFor(nickname: string) {
  const idx =
    [...nickname].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
    CHIP_STYLES.length;
  return CHIP_STYLES[idx] ?? CHIP_STYLES[0]!;
}

interface Props {
  nickname: string;
  isHost?: boolean;
}

export function ParticipantChip({ nickname, isHost = false }: Props) {
  const style = chipStyleFor(nickname);
  return (
    <span
      title={isHost ? `${nickname} — host` : nickname}
      className="flex items-center gap-2 rounded-full border-2 border-cab-700 bg-cab-700 py-1 pr-3 pl-1.5"
    >
      <span
        className={`crt flex h-6 w-6 items-center justify-center rounded-full border-2 ${style.border} ${style.text} ${style.glow} font-press text-[8px]`}
      >
        {nickname.charAt(0).toUpperCase()}
      </span>
      <span className="text-xs font-bold text-arc-100">{nickname}</span>
      {isHost && (
        <Star
          role="img"
          aria-label="Host"
          className="h-4 w-4 text-gold-500 [filter:drop-shadow(0_0_4px_rgba(255,210,62,.7))]"
        />
      )}
    </span>
  );
}