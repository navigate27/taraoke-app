import { useEffect, useRef, useState } from "react";
import { Check } from "pixelarticons/react";
import type { SearchResult } from "../../../server/youtube";

const FLIP_MS = 180;
const COIN_MS = 760; // coin-insert: 120ms delay + 620ms fall

type Phase = "idle" | "out" | "slot" | "check";

interface Props {
  result: SearchResult;
  added: boolean;
  onAdd: (result: SearchResult) => void;
  testId?: string;
  className: string;
}

export function CoinAddButton({ result, added, onAdd, testId, className }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (phase === "out") {
      const t = window.setTimeout(() => setPhase("slot"), FLIP_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "slot") {
      const t = window.setTimeout(() => setPhase("check"), COIN_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === "check" || (added && phase === "idle")) {
    return (
      <Check
        role="img"
        aria-label="Added"
        className={`h-4 w-4 text-cyan-500 ${phase === "check" ? "face-flip-in" : ""}`}
      />
    );
  }

  if (phase === "out") {
    return (
      <button type="button" className={className} disabled aria-hidden="true">
        <span className="inline-block face-flip-out">Add</span>
      </button>
    );
  }

  if (phase === "slot") {
    return (
      <span
        data-testid={testId ? `${testId}-slot` : undefined}
        className={`${className} relative flex items-center justify-center !bg-transparent`}
      >
        <span className="face-flip-in relative flex h-7 w-6 items-end justify-center rounded-[3px] border-2 border-gold-500/70 bg-cab-900 [box-shadow:0_0_8px_rgba(255,210,62,.35)]">
          <span aria-hidden="true" className="mb-1 h-[2px] w-3 rounded bg-gold-500" />
        </span>
        <span
          aria-hidden="true"
          className="coin coin-sm coin-insert absolute left-1/2 top-[14px] z-10 -ml-[6px]"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        onAdd(result);
        setPhase(reduced.current ? "check" : "out");
      }}
      className={className}
      aria-label={`Add ${result.title} to queue`}
    >
      Add
    </button>
  );
}