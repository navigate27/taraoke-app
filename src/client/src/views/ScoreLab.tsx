import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceScorer, type ScorerStatus } from "../scoring/VoiceScorer";
import { PHRASE_TARGET_SEC } from "../scoring/metrics";
import type { FrameAnalysis, Grade, ScoreResult } from "../scoring/types";

// Live streak readout derives from the preview's phrases component, using
// metrics' exported phrase-target constant so it can't desync from tuning.
const TRACE_WINDOW_MS = 15_000;
// Log pitch band for the trace. The brief's 200–800 Hz floor would hide male
// fundamentals; 100 Hz keeps the same log shape and covers bass voices.
const PITCH_MIN_HZ = 100;
const PITCH_MAX_HZ = 800;
// Gaps longer than this draw as a break in the trace (silence between phrases).
const TRACE_GAP_MS = 250;

const GRADE_COLOR: Record<Grade, string> = {
  "PERFECT!": "text-gold-500",
  GREAT: "text-gold-500",
  GOOD: "text-cyan-500",
  OKAY: "text-arc-100",
  "KEEP SINGING": "text-arc-500",
};

const STATUS_CHIP: Record<ScorerStatus["mode"], { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "text-arc-500" },
  crepe: { label: "Listening — CREPE", cls: "text-cyan-500" },
  heuristic: { label: "Listening — heuristic", cls: "text-gold-500" },
  denied: { label: "Mic denied", cls: "text-red-500" },
};

const TRACE_COLORS = {
  line: "#3EF0FF", // --cyan-500 (canvas can't resolve CSS vars)
  grid: "#2E2150", // --cab-700
  label: "#A79FC4", // --arc-500
};

function Meter({
  label,
  value,
  fraction,
  color,
}: {
  label: string;
  value: string;
  fraction: number;
  color: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-arc-500">{label}</span>
        <span className="font-press text-[9px] text-arc-100 tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full rounded-[2px] bg-crt-000">
        <div
          className="h-full rounded-[2px] transition-[width] duration-100 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function ScoreLab() {
  const scorerRef = useRef<VoiceScorer | null>(null);
  const traceRef = useRef<{ t: number; hz: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ScorerStatus>({ mode: "idle" });
  const [starting, setStarting] = useState(false);
  const [lastFrame, setLastFrame] = useState<FrameAnalysis | null>(null);
  const [preview, setPreview] = useState<ScoreResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [final, setFinal] = useState<ScoreResult | null>(null);

  const listening = status.mode === "crepe" || status.mode === "heuristic";
  const running = preview !== null;

  const handleFrame = useCallback((f: FrameAnalysis) => {
    setLastFrame(f);
    if (f.voiced && f.hz !== null) {
      const buf = traceRef.current;
      buf.push({ t: performance.now(), hz: f.hz });
      if (buf.length > 4096) buf.splice(0, buf.length - 4096);
    }
  }, []);

  async function startMic() {
    setStarting(true);
    try {
      // A retry after a denied/failed session must release the prior scorer
      // (mic tracks, worker, AudioContext) before replacing it.
      scorerRef.current?.stop();
      scorerRef.current = null;
      const scorer = new VoiceScorer();
      scorer.onStatus = setStatus;
      scorer.onFrame = handleFrame;
      scorerRef.current = scorer;
      await scorer.start();
    } finally {
      setStarting(false);
    }
  }

  function stopMic() {
    scorerRef.current?.stop();
    traceRef.current.length = 0;
    setLastFrame(null);
    setPreview(null);
    setPaused(false);
  }

  function startRun() {
    scorerRef.current?.startRun();
    setPaused(false);
    setFinal(null);
  }

  function endRun() {
    const result = scorerRef.current?.finalizeRun() ?? null;
    setPreview(null);
    setPaused(false);
    if (result) setFinal(result);
  }

  function reset() {
    scorerRef.current?.discardRun();
    traceRef.current.length = 0;
    setLastFrame(null);
    setPreview(null);
    setPaused(false);
    setFinal(null);
  }

  // Live preview at 4 Hz while the mic is up (preview() is null unless a run
  // is active, so the running score shows "—" between runs).
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(
      () => setPreview(scorerRef.current?.preview() ?? null),
      250,
    );
    return () => clearInterval(id);
  }, [listening]);

  // Pitch trace: rAF loop capped to ~30 fps while the mic is up.
  useEffect(() => {
    if (!listening) return;
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 33) return;
      last = t;
      drawTrace(canvasRef.current, traceRef.current);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  // Release the mic if the page ever unmounts (StrictMode-safe: the scorer
  // only exists after "Start mic", so double-mount cleanup hits null).
  useEffect(
    () => () => {
      scorerRef.current?.stop();
    },
    [],
  );

  const chip = STATUS_CHIP[status.mode];
  const pct = preview?.components.presence ?? null;
  const streakSec = preview ? preview.components.phrases * PHRASE_TARGET_SEC : null;

  return (
    <div className="min-h-screen bg-cab-900 text-arc-100">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-press text-[13px] uppercase tracking-[0.12em] text-arc-100">
            Scoring Lab
          </h1>
          <span
            className={`rounded-[4px] border-2 border-cab-700 bg-cab-800 px-2 py-1.5 font-press text-[9px] uppercase tracking-[0.12em] ${chip.cls}`}
            data-testid="lab-status-chip"
          >
            {chip.label}
          </span>
        </header>

        <p className="text-xs text-arc-500">
          Dev tool for tuning the scoring engine. Audio stays in this tab — nothing
          is sent anywhere.
        </p>

        {status.mode === "heuristic" && (
          <div
            className="rounded-[4px] border-2 border-red-500 px-3 py-2 text-xs text-red-500"
            data-testid="lab-heuristic-banner"
          >
            Heuristic mode — the pitch model didn't load. Scores come from the
            fallback engine and are approximate.
          </div>
        )}
        {status.mode === "denied" && (
          <div className="rounded-[4px] border-2 border-red-500 px-3 py-2 text-xs text-red-500">
            Microphone access was refused. Allow it in the browser, then press
            Start mic again.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startMic}
            disabled={listening || starting}
            className="btn btn-primary px-4 py-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start mic
          </button>
          <button
            type="button"
            onClick={stopMic}
            disabled={!listening}
            className="btn btn-ghost px-4 py-3 text-[10px] text-arc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop mic
          </button>
          <button
            type="button"
            onClick={startRun}
            disabled={!listening || running}
            className="btn btn-accent px-4 py-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start run
          </button>
          <button
            type="button"
            onClick={() => {
              if (paused) {
                scorerRef.current?.resume();
                setPaused(false);
              } else {
                scorerRef.current?.pause();
                setPaused(true);
              }
            }}
            disabled={!running}
            className="btn btn-ghost px-4 py-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={endRun}
            disabled={!running}
            className="btn btn-primary px-4 py-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            End run &amp; score
          </button>
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost px-4 py-3 text-[10px] text-red-500"
          >
            Reset
          </button>
        </div>

        <section className="panel p-4">
          <h2 className="mb-3 font-press text-[9px] uppercase tracking-[0.2em] text-arc-500">
            Live meters
          </h2>
          {listening && !running && (
            <p className="mb-3 text-xs text-arc-500" data-testid="lab-mic-check-hint">
              Mic check — the bars and trace should move as you speak or sing.
              Press Start run when ready.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Meter
              label="Voicing confidence"
              value={lastFrame ? `${Math.round(lastFrame.confidence * 100)}%` : "—"}
              fraction={lastFrame?.confidence ?? 0}
              color="var(--cyan-500)"
            />
            <Meter
              label="Energy"
              value={lastFrame ? `${Math.round(lastFrame.energy * 100)}%` : "—"}
              fraction={lastFrame?.energy ?? 0}
              color="var(--gold-500)"
            />
            <div className="flex items-baseline justify-between gap-2 sm:col-span-2">
              <span className="text-xs text-arc-500">Current pitch</span>
              <span className="font-press text-[13px] text-arc-100 tabular-nums">
                {lastFrame?.hz != null ? `${lastFrame.hz.toFixed(1)} Hz` : "— Hz"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-arc-500">Voice presence</span>
              <span className="font-press text-[9px] text-arc-100 tabular-nums">
                {pct != null ? `${Math.round(pct * 100)}%` : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-arc-500">Longest phrase</span>
              <span className="font-press text-[9px] text-arc-100 tabular-nums">
                {streakSec != null ? `${streakSec.toFixed(1)} s` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t-2 border-cab-700 pt-3 sm:col-span-2">
              <div>
                <h3 className="font-press text-[9px] uppercase tracking-[0.2em] text-arc-500">
                  Running score
                </h3>
                <p className="mt-1 text-xs text-arc-500">
                  {running
                    ? paused
                      ? "Paused — press Resume."
                      : "Sing — score updates live."
                    : "Press Start run, then sing."}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`font-press text-[32px] leading-none tabular-nums ${preview ? GRADE_COLOR[preview.grade] : "text-arc-500"}`}
                  data-testid="lab-running-score"
                >
                  {preview ? preview.score : "--"}
                </span>
                <span
                  className={`ml-2 font-press text-[9px] uppercase tracking-[0.12em] ${preview ? GRADE_COLOR[preview.grade] : "text-arc-500"}`}
                >
                  {preview ? preview.grade : "not running"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-press text-[9px] uppercase tracking-[0.2em] text-arc-500">
              Pitch trace — last 15 s
            </h2>
            <span
              className={`font-press text-[9px] uppercase tracking-[0.12em] ${
                status.mode === "crepe"
                  ? "text-cyan-500"
                  : status.mode === "heuristic"
                    ? "text-gold-500"
                    : "text-arc-500"
              }`}
              data-testid="lab-engine-badge"
            >
              Engine: {status.mode === "crepe" ? "CREPE" : status.mode === "heuristic" ? "Heuristic" : "—"}
            </span>
          </div>
          <div className="crt rounded-[4px] border-[3px] border-cab-700">
            <canvas ref={canvasRef} className="block h-[176px] w-full" />
          </div>
        </section>

        {final && (
          <section className="panel p-4" data-testid="lab-final-card">
            <h2 className="mb-3 font-press text-[9px] uppercase tracking-[0.2em] text-arc-500">
              Final score
            </h2>
            <div className="flex items-center gap-4">
              <span
                className={`font-press text-[48px] leading-none tabular-nums ${GRADE_COLOR[final.grade]}`}
              >
                {final.score}
              </span>
              <span
                className={`font-press text-[13px] uppercase tracking-[0.12em] ${GRADE_COLOR[final.grade]}`}
              >
                {final.grade}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              {(
                [
                  ["Presence", final.components.presence],
                  ["Phrases", final.components.phrases],
                  ["Steadiness", final.components.steadiness],
                  ["Energy", final.components.energy],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-arc-500">{label}</dt>
                  <dd className="font-press text-[9px] text-arc-100 tabular-nums">
                    {Math.round(v * 100)}%
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-arc-500">
              Press Start run for another attempt, or Reset to clear this card.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

// --- Pitch trace canvas (drawn with raw hex — canvas can't resolve CSS vars) ---

function drawTrace(
  canvas: HTMLCanvasElement | null,
  buf: { t: number; hz: number }[],
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Reference gridlines at 200 / 400 / 800 Hz (log Y band 100–800).
  const yFor = (hz: number) => {
    const clamped = Math.min(PITCH_MAX_HZ, Math.max(PITCH_MIN_HZ, hz));
    return h - (Math.log2(clamped / PITCH_MIN_HZ) / Math.log2(PITCH_MAX_HZ / PITCH_MIN_HZ)) * h;
  };
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const hz of [200, 400, 800]) {
    const y = yFor(hz);
    ctx.strokeStyle = TRACE_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = TRACE_COLORS.label;
    ctx.fillText(`${hz}`, 4, y + 3);
  }

  const now = performance.now();
  while (buf.length && now - buf[0]!.t > TRACE_WINDOW_MS) buf.shift();
  if (buf.length < 2) return;

  const xFor = (t: number) => w - (now - t) / TRACE_WINDOW_MS * w;
  ctx.strokeStyle = TRACE_COLORS.line;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(62, 240, 255, 0.6)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  let prevT = -Infinity;
  let drawing = false;
  for (const p of buf) {
    if (prevT !== -Infinity && p.t - prevT > TRACE_GAP_MS) {
      ctx.stroke();
      ctx.beginPath();
      drawing = false;
    }
    const x = xFor(p.t);
    const y = yFor(p.hz);
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
    prevT = p.t;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
