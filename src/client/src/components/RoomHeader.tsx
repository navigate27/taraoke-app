import { useEffect, useState } from "react";
import { formatElapsed } from "../lib/sessionClock";

interface Props {
  code: string;
  remaining: string;
  sessionStartedAt: number | null;
}

export function RoomHeader({ code, remaining, sessionStartedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header
      className="crt mx-6 mt-4 flex items-center justify-between gap-4 rounded-[4px] border-[3px] border-cab-700 px-5 py-3"
      aria-label="Room status"
      data-testid="marquee-panel"
    >
      <span
        data-testid="marquee-brand"
        className="flex items-center gap-2.5 font-press text-[14px] text-neon-500 [text-shadow:0_0_10px_rgba(228,59,255,.8),2px_2px_0_#4A0E5C]"
      >
        <img
          src="/icon.png"
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
        />
        Taraoke
      </span>
      <span
        data-testid="marquee-code"
        className="font-press text-[14px] text-cyan-500 [text-shadow:0_0_10px_rgba(62,240,255,.7)]"
      >
        {code}
      </span>
      <span
        data-testid="marquee-clock"
        title="Session runtime"
        className="font-press text-[14px] text-gold-500 [text-shadow:0_0_10px_rgba(255,210,62,.6)]"
      >
        {formatElapsed(sessionStartedAt, now)}
      </span>
    </header>
  );
}