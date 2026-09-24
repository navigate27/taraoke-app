import { useState } from "react";
import { socket } from "../lib/socket";
import { loadHost } from "./Host";

interface Props {
  joinCode: string | null;
  onCreate: (code: string, token: string) => void;
  onJoin: (code: string, nickname: string) => void;
}

export function Home({ joinCode, onCreate, onJoin }: Props) {
  const [nickname, setNickname] = useState("");
  const [codeInput, setCodeInput] = useState(joinCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const savedHost = loadHost();

  function createRoom() {
    socket.emit("room:create", (res) => {
      onCreate(res.code, res.hostToken);
    });
  }

  function joinRoom() {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setError("Enter a room code");
      return;
    }
    socket.emit(
      "room:join",
      code,
      nickname.trim() || "Guest",
      null,
      (res) => {
        if (res.ok) onJoin(code, nickname.trim() || "Guest");
        else setError(res.error ?? "Could not join");
      },
    );
  }

  function resumeHosting() {
    const saved = loadHost();
    if (!saved) return;
    socket.emit(
      "room:join",
      saved.code,
      nickname.trim() || "Host",
      saved.token,
      (res) => {
        if (res.ok) onCreate(saved.code, saved.token);
        else setError(res.error ?? "Could not resume");
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
        <label className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase">
          Your nickname
        </label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="Player 1"
          className="crt mb-5 w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-3 text-arc-100 outline-none placeholder:text-arc-500 focus:border-cyan-500"
        />

        <button
          onClick={createRoom}
          className="btn btn-primary w-full px-6 py-4 text-[10px]"
        >
          Taraoke! Create room
        </button>

        <div className="my-5 flex items-center gap-3 text-arc-500">
          <span className="h-[2px] flex-1 bg-cab-700" />
          <span className="text-xs font-semibold">or join one</span>
          <span className="h-[2px] flex-1 bg-cab-700" />
        </div>

        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="TARA-XXXX"
          className="crt mb-5 w-full rounded-[4px] border-[3px] border-cab-700 px-3 py-3 text-center font-press text-[13px] text-cyan-500 outline-none placeholder:text-arc-500 focus:border-cyan-500"
        />
        <button
          onClick={joinRoom}
          className="btn btn-ghost w-full px-6 py-4 text-[10px]"
        >
          Join
        </button>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        {savedHost && !error && (
          <button
            onClick={resumeHosting}
            className="btn btn-ghost mt-4 w-full px-6 py-3 text-[9px] text-gold-500"
          >
            Resume hosting {savedHost.code}
          </button>
        )}
      </section>

      <p className="coin-blink font-press text-[9px] text-gold-500">
        Insert coin to start
      </p>
    </main>
  );
}