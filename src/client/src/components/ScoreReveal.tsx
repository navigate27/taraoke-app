import { useEffect, useState } from "react";
import { gradeFor } from "../scoring/curve";

export function randomScore(): number {
  return 60 + Math.floor(Math.random() * 41);
}

const ROLL_MS = 4000;
const REVEAL_MS = 8000;
const CELEBRATE_ABOVE = 80;

const SCORE_COMMENTS: { min: number; text: string }[] = [
  { min: 95, text: "A star is born!" },
  { min: 85, text: "Crowd favorite!" },
  { min: 70, text: "Solid performance!" },
  { min: 0, text: "Keep practicing!" },
];

function commentFor(score: number): string {
  return SCORE_COMMENTS.find((c) => score >= c.min)?.text ?? "";
}

interface Props {
  score: number;
  nickname: string;
  nextTitle: string | null;
  onAdvance: () => void;
}

export function ScoreReveal({ score, nickname, nextTitle, onAdvance }: Props) {
  const [rolling, setRolling] = useState(true);
  const [shown, setShown] = useState(60);
  const [countdown, setCountdown] = useState(REVEAL_MS / 1000);

  useEffect(() => {
    if (!rolling) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRolling(false);
      return;
    }
    let timer = 0;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ROLL_MS);
      if (t >= 1) {
        setShown(score);
        setRolling(false);
        return;
      }
      setShown(60 + Math.floor(Math.random() * 41));
      timer = window.setTimeout(tick, 45 + 255 * t * t);
    };
    timer = window.setTimeout(tick, 45);
    return () => window.clearTimeout(timer);
  }, [rolling, score]);

  useEffect(() => {
    if (rolling) return;
    const interval = window.setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    const timer = window.setTimeout(onAdvance, REVEAL_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [rolling, onAdvance]);

  const celebrate = !rolling && score > CELEBRATE_ABOVE;

  return (
    <button
      type="button"
      data-testid="score-reveal"
      aria-label={rolling ? `Scoring, tap to skip` : `Score ${score}. Tap to next song`}
      onClick={onAdvance}
      className="crt absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-5 rounded-[4px] px-4 text-center"
    >
      <span className="font-press text-[9px] uppercase tracking-[0.12em] text-cyan-500">
        {rolling ? "Scoring your performance" : "Your score is"}
      </span>
      <span
        data-testid="score-reveal-value"
        className={`font-press text-8xl text-gold-500 ${
          celebrate ? "score-celebrate-glow" : "[text-shadow:0_0_18px_rgba(255,210,62,.6),4px_4px_0_var(--color-crt-000)]"
        }`}
      >
        {rolling ? shown : score}
      </span>
      <span
        data-testid="score-reveal-grade"
        className={`font-press text-2xl [text-shadow:3px_3px_0_var(--color-crt-000)] ${
          rolling
            ? "opacity-0"
            : celebrate
              ? "text-gold-500 [filter:drop-shadow(0_0_10px_rgba(255,210,62,.5))] score-celebrate"
              : score >= 85
                ? "text-gold-500 [filter:drop-shadow(0_0_10px_rgba(255,210,62,.5))]"
                : "text-cyan-500 [filter:drop-shadow(0_0_10px_rgba(62,240,255,.45))]"
        }`}
      >
        {gradeFor(score)}
      </span>
      {!rolling && (
        <>
          <span className="text-lg text-arc-100">
            Nice one, <span className="font-semibold">{nickname}</span> —{" "}
            <span className="text-arc-500">{commentFor(score)}</span>
          </span>
          {nextTitle && (
            <span
              data-testid="score-reveal-next"
              className="max-w-full truncate px-6 text-sm text-arc-500"
            >
              Up next: <span className="text-arc-100">{nextTitle}</span>
            </span>
          )}
          <span className="font-press text-[9px] uppercase tracking-[0.12em] text-arc-500">
            Tap for next song · auto in {Math.max(0, countdown)}s
          </span>
        </>
      )}
    </button>
  );
}