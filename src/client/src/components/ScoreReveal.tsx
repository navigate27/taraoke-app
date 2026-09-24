import { useEffect, useState } from "react";
import { Play } from "pixelarticons/react";
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
  nextChannel: string | null;
  nextThumbnail: string | null;
  onAdvance: () => void;
}

export function ScoreReveal({
  score,
  nickname,
  nextTitle,
  nextChannel,
  nextThumbnail,
  onAdvance,
}: Props) {
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
    <div
      data-testid="score-reveal"
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
            <div className="flex flex-col items-center gap-2">
              <span
                data-testid="score-reveal-countdown"
                className="font-press text-[9px] uppercase tracking-[0.12em] text-cyan-500"
              >
                Next song in {Math.max(0, countdown)}s
              </span>
              <button
                type="button"
                data-testid="score-reveal-next"
                aria-label={`Play next: ${nextTitle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance();
                }}
                className="panel flex max-w-[320px] cursor-pointer items-center gap-3 p-2 text-left transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none hover:brightness-110"
              >
                <img
                  src={nextThumbnail ?? ""}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded-[4px] border-2 border-cab-700 object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-arc-100">
                    {nextTitle}
                  </span>
                  {nextChannel && (
                    <span className="block truncate text-xs text-arc-500">
                      {nextChannel}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-cyan-700 bg-cyan-500 text-cab-900 [box-shadow:2px_2px_0_var(--color-crt-000)]"
                >
                  <Play className="h-4 w-4" />
                </span>
              </button>
            </div>
          )}
          <span className="font-press text-[9px] uppercase tracking-[0.12em] text-arc-500">
            Tap anywhere to continue
          </span>
        </>
      )}
    </div>
  );
}