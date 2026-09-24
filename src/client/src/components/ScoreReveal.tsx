import { useEffect, useState } from "react";
import { gradeFor } from "../scoring/curve";

export function randomScore(): number {
  return 60 + Math.floor(Math.random() * 41);
}

const COUNT_UP_MS = 1500;
const AUTO_DISMISS_MS = 6000;

interface Props {
  score: number;
  nickname: string;
  onDismiss: () => void;
}

export function ScoreReveal({ score, nickname, onDismiss }: Props) {
  const [shown, setShown] = useState(score);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      setShown(Math.round(60 + (score - 60) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const grade = gradeFor(score);
  const gradeGold = score >= 85;

  return (
    <button
      type="button"
      data-testid="score-reveal"
      aria-label={`Score ${score}. ${grade}. Tap to dismiss`}
      onClick={onDismiss}
      className="crt absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-5 rounded-[4px] px-4 text-center"
    >
      <span className="font-press text-[9px] uppercase tracking-[0.12em] text-cyan-500">
        Performance complete
      </span>
      <span
        data-testid="score-reveal-grade"
        className={`font-press text-xl [text-shadow:3px_3px_0_var(--color-crt-000)] ${
          gradeGold
            ? "text-gold-500 [filter:drop-shadow(0_0_10px_rgba(255,210,62,.5))]"
            : "text-cyan-500 [filter:drop-shadow(0_0_10px_rgba(62,240,255,.45))]"
        }`}
      >
        {grade}
      </span>
      <span
        data-testid="score-reveal-value"
        className="font-press text-6xl text-gold-500 [text-shadow:0_0_18px_rgba(255,210,62,.6),4px_4px_0_var(--color-crt-000)]"
      >
        {shown}
      </span>
      <span className="text-sm text-arc-100">
        Nice one, <span className="font-semibold">{nickname}</span>
      </span>
      <span className="font-press text-[9px] uppercase tracking-[0.12em] text-arc-500">
        Tap to continue
      </span>
    </button>
  );
}