import { useEffect, useRef, useState } from "react";
import { Close, Play } from "pixelarticons/react";

export function randomScore(): number {
  return 60 + Math.floor(Math.random() * 41);
}

const ROLL_MS = 4000;
const REVEAL_MS = 8000;
const CELEBRATE_ABOVE = 80;
const DRUM_ROLL_URL = "/audio/drum-roll.mp3";
const STING_URL = "/audio/score-reveal.mp3";

type GradeTone = "gold" | "cyan" | "muted" | "red";

interface GradeTier {
  min: number;
  badge: string;
  tone: GradeTone;
  comments: string[];
}

// Ten videoke tiers over the 60..100 roll; comments roast harder the lower you land.
// Roast copy is half Taglish by design (Ivan's call) — badges and UI labels stay English.
export const GRADE_TIERS: GradeTier[] = [
  {
    min: 96,
    badge: "PERFECT!",
    tone: "gold",
    comments: [
      "Walang paltos — perpekto!",
      "Grabe, ibang level!",
      "Legendary. Frame this score.",
    ],
  },
  {
    min: 92,
    badge: "AMAZING",
    tone: "gold",
    comments: [
      "The mic owes you money.",
      "Crowd went absolutely feral.",
      "Ang galing! Bongga talaga.",
    ],
  },
  {
    min: 88,
    badge: "GREAT",
    tone: "gold",
    comments: [
      "Big voice energy detected.",
      "Lakas ng dating, panalo!",
      "Kinabog mo silang lahat!",
    ],
  },
  {
    min: 84,
    badge: "SOLID",
    tone: "gold",
    comments: [
      "Smooth. Suspiciously smooth.",
      "Parang studio version — konti na lang!",
      "Queue another one, you're on a roll.",
    ],
  },
  {
    min: 80,
    badge: "NICE",
    tone: "cyan",
    comments: [
      "Respectable. Almost too respectable.",
      "Pasok sa pusta!",
      "Hataw talaga — may puso.",
    ],
  },
  {
    min: 76,
    badge: "NOT BAD",
    tone: "cyan",
    comments: [
      "You've done worse. We all saw it.",
      "Half hero, half karaoke victim.",
      "Puso lang ang kulang, ika nga.",
    ],
  },
  {
    min: 72,
    badge: "PASSABLE",
    tone: "cyan",
    comments: [
      "The dog liked it. The dog likes everything.",
      "May melodya naman kahit papaano.",
      "Konting practice, champion ka na!",
    ],
  },
  {
    min: 68,
    badge: "MEH",
    tone: "muted",
    comments: [
      "The mic is filing a complaint.",
      "Notes were suggested, not sung.",
      "Nakakaawa naman ang mic.",
    ],
  },
  {
    min: 64,
    badge: "OOF",
    tone: "red",
    comments: [
      "The neighbors have questions.",
      "Grabe, dinurog mo ang kanta.",
      "Kapitbahay, pasensya na po.",
    ],
  },
  {
    min: 60,
    badge: "YIKES",
    tone: "red",
    comments: [
      "The mic survived. Barely.",
      "That melody did nothing to you.",
      "Isa pa — para sa science!",
    ],
  },
];

export function tierFor(score: number): GradeTier {
  return GRADE_TIERS.find((t) => score >= t.min) ?? GRADE_TIERS[GRADE_TIERS.length - 1]!;
}

function pickComment(tier: GradeTier): string {
  return tier.comments[Math.floor(Math.random() * tier.comments.length)] ?? "";
}

const TONE_CLASS: Record<GradeTone, string> = {
  gold: "text-gold-500 [filter:drop-shadow(0_0_10px_rgba(255,210,62,.5))]",
  cyan: "text-cyan-500 [filter:drop-shadow(0_0_10px_rgba(62,240,255,.45))]",
  muted: "text-arc-500",
  red: "text-red-500 [filter:drop-shadow(0_0_10px_rgba(255,61,90,.45))]",
};

const CONFETTI_COLORS = ["#FFD23E", "#3EF0FF", "#E43BFF", "#F2EDFF"];

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    if (!w || !h) return;
    const pieces = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.5,
      vx: (Math.random() - 0.5) * 14,
      vy: -(5 + Math.random() * 10),
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? "#FFD23E",
      life: 1,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of pieces) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;
        if (p.life <= 0 || p.y > h + 12) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (alive) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}

interface Props {
  score: number;
  nickname: string;
  nextTitle: string | null;
  nextChannel: string | null;
  nextThumbnail: string | null;
  onAdvance: () => void;
  onSkip: () => void;
}

export function ScoreReveal({
  score,
  nickname,
  nextTitle,
  nextChannel,
  nextThumbnail,
  onAdvance,
  onSkip,
}: Props) {
  const [rolling, setRolling] = useState(true);
  const [shown, setShown] = useState(60);
  const [comment, setComment] = useState("");
  const [countdown, setCountdown] = useState(REVEAL_MS / 1000);
  const drumRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!rolling) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(score);
      setComment(pickComment(tierFor(score)));
      setRolling(false);
      new Audio(STING_URL).play().catch(() => {});
      return;
    }
    const drum = new Audio(DRUM_ROLL_URL);
    drumRef.current = drum;
    drum.play().catch(() => {});
    let timer = 0;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ROLL_MS);
      if (t >= 1) {
        drum.pause();
        new Audio(STING_URL).play().catch(() => {});
        setShown(score);
        setComment(pickComment(tierFor(score)));
        setRolling(false);
        return;
      }
      setShown(60 + Math.floor(Math.random() * 41));
      timer = window.setTimeout(tick, 45 + 255 * t * t);
    };
    timer = window.setTimeout(tick, 45);
    return () => {
      window.clearTimeout(timer);
      drum.pause();
      drumRef.current = null;
    };
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
  const tier = tierFor(score);

  return (
    <div
      data-testid="score-reveal"
      onClick={onAdvance}
      className="crt absolute inset-0 z-20 cursor-pointer overflow-hidden rounded-[4px]"
    >
      {celebrate && <ConfettiBurst />}
      <button
        type="button"
        data-testid="score-reveal-skip"
        aria-label="Skip scoring and play the next song"
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
        }}
        className="absolute top-3 right-3 z-30 flex cursor-pointer items-center gap-1.5 rounded-[4px] border-2 border-cab-700 bg-cab-800/80 px-2.5 py-1.5 font-press text-[9px] uppercase text-arc-500 transition-colors hover:border-red-500 hover:text-red-500"
      >
        <Close className="h-3.5 w-3.5" />
        Skip scoring
      </button>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
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
          rolling ? "opacity-0" : celebrate ? `${TONE_CLASS[tier.tone]} score-celebrate` : TONE_CLASS[tier.tone]
        }`}
      >
        {tier.badge}
      </span>
      {!rolling && (
        <>
          <span className="text-lg text-arc-100">
            Nice one, <span className="font-semibold">{nickname}</span> —{" "}
            <span className="text-arc-500">{comment}</span>
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
    </div>
  );
}