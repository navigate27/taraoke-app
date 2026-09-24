import { motion } from "framer-motion";

interface Props {
  onCoinInserted: () => void;
}

export function JukeboxIntro({ onCoinInserted }: Props) {
  return (
    <div
      data-testid="jukebox-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-cab-900/95"
      role="status"
    >
      <svg
        width="180"
        height="255"
        viewBox="0 0 120 170"
        aria-label="Jukebox"
        role="img"
        style={{ overflow: "visible" }}
      >
        {/* cabinet shake on coin insert */}
        <motion.g
          initial={{ y: 0 }}
          animate={{ y: [0, 3, 0, 1.5, 0] }}
          transition={{ delay: 0.72, duration: 0.35, times: [0, 0.3, 0.55, 0.8, 1] }}
        >
          {/* base + feet */}
          <rect x="6" y="158" width="108" height="8" fill="#2e2150" />
          <rect x="14" y="164" width="14" height="4" fill="#2e2150" />
          <rect x="92" y="164" width="14" height="4" fill="#2e2150" />
          {/* body */}
          <rect
            x="10"
            y="34"
            width="100"
            height="124"
            fill="#191233"
            stroke="#2e2150"
            strokeWidth="3"
          />
          {/* speaker grille */}
          <g stroke="#3ef0ff" strokeWidth="3" opacity="0.5">
            <line x1="26" y1="120" x2="70" y2="120" />
            <line x1="26" y1="129" x2="70" y2="129" />
            <line x1="26" y1="138" x2="70" y2="138" />
            <line x1="26" y1="147" x2="70" y2="147" />
          </g>
          {/* coin slot */}
          <rect
            x="86"
            y="101"
            width="12"
            height="6"
            rx="1"
            fill="#05030c"
            stroke="#ffd23e"
            strokeWidth="2"
          />
          {/* arch window */}
          <path
            d="M 22 96 L 22 62 A 38 38 0 0 1 98 62 L 98 96 Z"
            fill="#05030c"
            stroke="#ffd23e"
            strokeWidth="3"
          />
          {/* neon arch glow — pulses after the coin lands */}
          <motion.path
            d="M 32 96 L 32 66 A 28 28 0 0 1 88 66 L 88 96 Z"
            fill="none"
            stroke="#e43bff"
            strokeWidth="6"
            initial={{ opacity: 0.35 }}
            animate={{ opacity: [0.35, 1, 0.7] }}
            transition={{ delay: 0.78, duration: 0.6, times: [0, 0.4, 1] }}
            style={{ filter: "drop-shadow(0 0 6px rgba(228,59,255,.9))" }}
          />
        </motion.g>
        {/* coin: tossed in from the top right, arcs into the slot, squashes and bounces */}
        <motion.g
          initial={{ x: 110, y: -150, opacity: 0 }}
          animate={{
            x: [110, 55, 0, 0, 0],
            y: [-150, -115, 0, -10, 0],
            opacity: [0, 1, 1, 1, 1],
            rotate: [-170, -60, 0, 0, 0],
            scaleX: [1, 1, 1.18, 0.92, 1],
            scaleY: [1, 1, 0.85, 1.06, 1],
          }}
          transition={{
            duration: 1.15,
            times: [0, 0.45, 0.68, 0.85, 1],
            ease: ["easeOut", "easeIn", "easeOut", "easeIn"],
          }}
          onAnimationComplete={onCoinInserted}
        >
          <circle
            cx="92"
            cy="104"
            r="9"
            fill="#ffd23e"
            stroke="#5C4A0E"
            strokeWidth="2.5"
          />
          <circle cx="92" cy="104" r="4.5" fill="none" stroke="#5C4A0E" strokeWidth="1.5" />
        </motion.g>
      </svg>
      <p className="font-press text-[10px] text-gold-500">Starting your room…</p>
    </div>
  );
}