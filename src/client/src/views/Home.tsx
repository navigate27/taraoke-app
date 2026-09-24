import { useState } from "react";
import { socket } from "../lib/socket";
import { loadHost } from "./Host";

interface Props {
  joinCode: string | null;
  onCreate: (code: string, token: string) => void;
  onJoin: (code: string, nickname: string) => void;
}

export function Home({ joinCode, onCreate, onJoin }: Props) {
  const [tab, setTab] = useState<"host" | "join">(joinCode ? "join" : "host");
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [codeInput, setCodeInput] = useState(joinCode ?? "");
  const [hostError, setHostError] = useState<string | null>(null);
  const [joinNameError, setJoinNameError] = useState<string | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const savedHost = loadHost();

  function createRoom() {
    if (!hostName.trim()) {
      setHostError("Hostname required");
      return;
    }
    socket.emit("room:create", (res) => {
      onCreate(res.code, res.hostToken);
    });
  }

  function joinRoom() {
    if (!joinName.trim()) {
      setJoinNameError("Nickname required");
      return;
    }
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setJoinCodeError("Enter a room code");
      return;
    }
    socket.emit("room:join", code, joinName.trim(), null, (res) => {
      if (res.ok) onJoin(code, joinName.trim());
      else setJoinCodeError(res.error ?? "Could not join");
    });
  }

  function resumeHosting() {
    const saved = loadHost();
    if (!saved) return;
    socket.emit(
      "room:join",
      saved.code,
      hostName.trim() || "Host",
      saved.token,
      (res) => {
        if (res.ok) onCreate(saved.code, saved.token);
        else setHostError(res.error ?? "Could not resume");
      },
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <header className="text-center">
        <h1 className="font-press text-[22px] text-neon-500 [text-shadow:0_0_14px_rgba(228,59,255,.8)]">
          ★ Taraoke ★
        </h1>
        <p className="mt-3 text-arc-500">Instant karaoke rooms. No account needed.</p>
      </header>

      <section className="crt scanlines panel w-full max-w-sm p-6">
        <div className="mb-5 grid grid-cols-2 gap-2.5" role="tablist" aria-label="Host or join a room">
          <button
            role="tab"
            aria-selected={tab === "host"}
            onClick={() => setTab("host")}
            className={`btn h-12 py-3 text-[10px] ${tab === "host" ? "btn-primary" : "btn-ghost text-arc-500"}`}
          >
            Host
          </button>
          <button
            role="tab"
            aria-selected={tab === "join"}
            onClick={() => setTab("join")}
            className={`btn h-12 py-3 text-[10px] ${tab === "join" ? "btn-primary" : "btn-ghost text-arc-500"}`}
          >
            Join
          </button>
        </div>

        {tab === "host" ? (
          <>
            <label className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase">
              Hostname
            </label>
            <input
              value={hostName}
              onChange={(e) => {
                setHostName(e.target.value);
                setHostError(null);
              }}
              maxLength={20}
              required
              placeholder="Mang Boy"
              className={`crt ${hostError ? "" : "mb-5"} w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-3 text-arc-100 outline-none placeholder:text-arc-500/60 focus:border-cyan-500`}
            />
            {hostError && <p className="mb-1.5 text-sm text-red-500">{hostError}</p>}

            <button
              onClick={createRoom}
              className="btn btn-primary w-full px-6 py-4 text-[10px]"
            >
              Taraoke! Create room
            </button>

            {savedHost && !hostError && (
              <button
                onClick={resumeHosting}
                className="btn btn-ghost mt-4 w-full px-6 py-3 text-[9px] text-gold-500"
              >
                Resume hosting {savedHost.code}
              </button>
            )}
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase">
              Nickname
            </label>
            <input
              value={joinName}
              onChange={(e) => {
                setJoinName(e.target.value);
                setJoinNameError(null);
              }}
              maxLength={20}
              required
              placeholder="Aling Nena"
              className={`crt ${joinNameError ? "" : "mb-5"} w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-3 text-arc-100 outline-none placeholder:text-arc-500/60 focus:border-cyan-500`}
            />
            {joinNameError && <p className="mb-1.5 text-sm text-red-500">{joinNameError}</p>}

            <label className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase">
              Room code
            </label>
            <input
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase());
                setJoinCodeError(null);
              }}
              placeholder="TARA-XXXX"
              className={`crt ${joinCodeError ? "" : "mb-5"} w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-3 text-center font-press text-[13px] text-cyan-500 outline-none placeholder:text-arc-500 focus:border-cyan-500`}
            />
            {joinCodeError && <p className="mb-1.5 text-sm text-red-500">{joinCodeError}</p>}

            <button
              onClick={joinRoom}
              className="btn btn-primary w-full px-6 py-4 text-[10px]"
            >
              Join
            </button>
          </>
        )}
      </section>

      <p className="coin-blink font-press text-[9px] text-gold-500">
        Insert coin to start
      </p>
    </main>
  );
}