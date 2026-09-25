import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import { JukeboxIntro } from "../components/JukeboxIntro";
import { clearGuest, loadGuest, saveGuest } from "./guest/Guest";
import { clearHost, loadHost } from "./host/Host";

interface Props {
  joinCode: string | null;
  onCreate: (code: string, token: string, name: string) => void;
  onJoin: (code: string, nickname: string) => void;
}

export function Home({ joinCode, onCreate, onJoin }: Props) {
  const savedGuest = loadGuest();
  const [tab, setTab] = useState<"host" | "join">(
    joinCode ? "join" : savedGuest ? "join" : "host",
  );
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [codeInput, setCodeInput] = useState(joinCode?.replace(/^TARA-/, "") ?? "");
  const [hostError, setHostError] = useState<string | null>(null);
  const [joinNameError, setJoinNameError] = useState<string | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [created, setCreated] = useState<{ code: string; token: string } | null>(
    null,
  );
  const [coinInserted, setCoinInserted] = useState(false);
  const savedHost = loadHost();

  useEffect(() => {
    if (created && coinInserted) {
      onCreate(created.code, created.token, hostName.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, coinInserted]);

  function createRoom() {
    if (!hostName.trim()) {
      setHostError("Hostname required");
      return;
    }
    setInserting(true);
    socket.emit("room:create", (res) => {
      setCreated({ code: res.code, token: res.hostToken });
    });
  }

  function joinRoom() {
    if (!joinName.trim()) {
      setJoinNameError("Nickname required");
      return;
    }
    const code = `TARA-${codeInput.trim().toUpperCase()}`;
    if (!codeInput.trim()) {
      setJoinCodeError("Enter the 4-character code");
      return;
    }
    socket.emit("room:check", code, null, (res) => {
      if (res.ok) onJoin(code, joinName.trim());
      else setJoinCodeError(res.error ?? "Could not join");
    });
  }

  function rejoinRoom() {
    const saved = loadGuest();
    if (!saved) return;
    socket.emit("room:check", saved.code, null, (res) => {
      if (res.ok) onJoin(saved.code, saved.nickname);
      else {
        clearGuest();
        setTab("join");
        setJoinCodeError(res.error ?? "That room has ended");
      }
    });
  }

  function resumeHosting() {
    const saved = loadHost();
    if (!saved) return;
    const name = saved.name ?? hostName.trim() ?? "Host";
    socket.emit("room:check", saved.code, saved.token, (res) => {
      if (res.ok) onCreate(saved.code, saved.token, name);
      else {
        clearHost();
        setHostError("That room has ended — create a new one");
      }
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <header className="text-center">
        <img
          src="/icon.png"
          alt=""
          aria-hidden="true"
          className="mx-auto h-20 w-20 [filter:drop-shadow(6px_6px_0_#05030C)]"
        />
        <h1
          data-testid="home-heading"
          className="mt-4 font-press text-[22px] text-neon-500 [text-shadow:0_0_14px_rgba(228,59,255,.8)]"
        >
          Taraoke
        </h1>
        <p className="mt-3 text-arc-500">Insert coin. Grab a mic. No signups, endless karaoke.</p>
      </header>

      <section className="crt panel w-full max-w-sm p-6" data-testid="home-panel">
        <div className="mb-5 grid grid-cols-2 gap-2.5" role="tablist" aria-label="Host or join a room">
          <button
            role="tab"
            aria-selected={tab === "host"}
            data-testid="home-tab-host"
            onClick={() => setTab("host")}
            className={`btn h-12 py-3 text-[10px] ${tab === "host" ? "btn-primary" : "btn-ghost text-arc-500"}`}
          >
            Host
          </button>
          <button
            role="tab"
            aria-selected={tab === "join"}
            data-testid="home-tab-join"
            onClick={() => setTab("join")}
            className={`btn h-12 py-3 text-[10px] ${tab === "join" ? "btn-accent" : "btn-ghost text-arc-500"}`}
          >
            Join
          </button>
        </div>

        {tab === "host" ? (
          <>
            <label
              data-testid="home-label-hostname"
              className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase"
            >
              Hostname
            </label>
            <input
              data-testid="home-input-hostname"
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
            {hostError && (
              <p data-testid="home-error-hostname" className="mb-1.5 text-sm text-red-500">
                {hostError}
              </p>
            )}

            <button
              data-testid="home-btn-create"
              onClick={createRoom}
              className="btn btn-primary w-full px-6 py-4 text-[10px]"
            >
              Taraoke! Create room
            </button>

            {savedHost && !hostError && (
              <button
                data-testid="home-btn-resume"
                onClick={resumeHosting}
                className="btn btn-ghost mt-4 w-full px-6 py-3 text-[9px] text-gold-500"
              >
                Resume hosting {savedHost.code}
              </button>
            )}
          </>
        ) : (
          <>
            <label
              data-testid="home-label-nickname"
              className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase"
            >
              Nickname
            </label>
            <input
              data-testid="home-input-nickname"
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
            {joinNameError && (
              <p data-testid="home-error-nickname" className="mb-1.5 text-sm text-red-500">
                {joinNameError}
              </p>
            )}

            <label
              data-testid="home-label-code"
              className="mb-1 block text-xs font-semibold tracking-widest text-arc-500 uppercase"
            >
              Room code
            </label>
            <div
              className={`crt flex items-center rounded-[4px] border-[3px] border-cab-700 focus-within:border-cyan-500 ${joinCodeError ? "" : "mb-5"}`}
            >
              <span className="pl-3 font-press text-[13px] text-arc-500">TARA-</span>
              <input
                data-testid="home-input-code"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase().slice(0, 4));
                  setJoinCodeError(null);
                }}
                maxLength={4}
                placeholder="XXXX"
                aria-label="Room code — last 4 characters"
                className="w-full bg-transparent py-3 pr-3 pl-1 text-left font-press text-[13px] text-cyan-500 outline-none placeholder:text-arc-500"
              />
            </div>
            {joinCodeError && (
              <p data-testid="home-error-code" className="mb-1.5 text-sm text-red-500">
                {joinCodeError}
              </p>
            )}

            <button
              data-testid="home-btn-join"
              onClick={joinRoom}
              className="btn btn-accent w-full px-6 py-4 text-[10px]"
            >
              Insert coin
            </button>

            {savedGuest && (
              <button
                data-testid="home-btn-rejoin"
                onClick={rejoinRoom}
                className="btn btn-ghost mt-4 w-full px-6 py-3 text-[9px] text-cyan-500"
              >
                Rejoin {savedGuest.code} as {savedGuest.nickname}
              </button>
            )}
          </>
        )}
      </section>

      <p data-testid="home-blink" className="coin-blink font-press text-[9px] text-gold-500">
        Insert coin to start
      </p>

      {inserting && <JukeboxIntro onCoinInserted={() => setCoinInserted(true)} />}
    </main>
  );
}