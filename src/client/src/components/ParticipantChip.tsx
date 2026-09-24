import { Star } from "pixelarticons/react";

const CHIP_STYLES = [
  { dot: "bg-neon-500" },
  { dot: "bg-cyan-500" },
  { dot: "bg-gold-500" },
  { dot: "bg-red-500" },
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
  size?: "md" | "sm";
}

export function ParticipantChip({ nickname, isHost = false, size = "md" }: Props) {
  const style = chipStyleFor(nickname);
  const sm = size === "sm";
  const slug = nickname.toLowerCase().replace(/\s+/g, "-");
  return (
    <span
      title={isHost ? `${nickname} — host` : nickname}
      data-testid={`chip-${slug}`}
      className={`flex w-fit items-center rounded-[4px] border-2 border-[#3A2B66] bg-cab-700 ${
        sm ? "gap-1.5 py-0.5 pr-1.5 pl-1" : "gap-2 py-0.5 pr-2 pl-1.5"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 ${style.dot} ${
          sm ? "" : "[box-shadow:1px_1px_0_var(--color-crt-000)]"
        }`}
      />
      <span
        data-testid={`chip-name-${slug}`}
        className={`${sm ? "text-[11px]" : "text-xs"} font-bold text-arc-100`}
      >
        {nickname}
      </span>
      {isHost && (
        <Star role="img" aria-label="Host" className="h-4 w-4 text-gold-500" />
      )}
    </span>
  );
}