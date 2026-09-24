interface Props {
  code: string;
  remaining: string;
}

export function RoomHeader({ code, remaining }: Props) {
  return (
    <header
      className="crt mx-6 mt-4 flex items-center justify-between gap-4 rounded-[4px] border-[3px] border-cab-700 px-5 py-3"
      aria-label="Room status"
    >
      <span className="font-press text-[14px] text-neon-500 [text-shadow:0_0_10px_rgba(228,59,255,.8),2px_2px_0_#4A0E5C]">
        ★ Taraoke ★
      </span>
      <span className="font-press text-[14px] text-cyan-500 [text-shadow:0_0_10px_rgba(62,240,255,.7)]">
        {code}
      </span>
      <span className="font-press text-[14px] text-gold-500 [text-shadow:0_0_10px_rgba(255,210,62,.6)]">
        {remaining}
      </span>
    </header>
  );
}