import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import type { PublicRoomState } from "../../../shared/types";
import { buildJoinUrl } from "../lib/joinUrl";
import { ParticipantChips } from "./ParticipantChips";

interface Props {
  code: string;
  participants: PublicRoomState["participants"];
  collapsibleJoin?: boolean;
  children?: ReactNode;
}

export function JoinPanel({ code, participants, collapsibleJoin = false, children }: Props) {
  const [qrUrl, setQrUrl] = useState("");
  const [joinOpen, setJoinOpen] = useState(!collapsibleJoin);

  useEffect(() => {
    buildJoinUrl(code)
      .then((url) =>
        QRCode.toDataURL(url, {
          margin: 1,
          color: { dark: "#3EF0FF", light: "#05030C" },
        }),
      )
      .then(setQrUrl)
      .catch(() => {});
  }, [code]);

  return (
    <section className="panel flex flex-col p-5" aria-label="Join the room" data-testid="join-panel">
      {collapsibleJoin ? (
        <button
          data-testid="join-toggle"
          onClick={() => setJoinOpen((open) => !open)}
          aria-expanded={joinOpen}
          className="btn btn-ghost mb-4 flex w-full items-center justify-center gap-3 rounded-[4px] border-[3px] border-gold-500/60 px-4 py-4 font-press text-[12px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E] [box-shadow:0_0_12px_rgba(255,210,62,.25)]"
        >
          Join the room
          <span aria-hidden className="text-[10px]">{joinOpen ? "▲" : "▼"}</span>
        </button>
      ) : (
        <h2
          data-testid="join-heading"
          className="mb-4 font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]"
        >
          Join the room
        </h2>
      )}
      {joinOpen && (
        <>
          {qrUrl ? (
            <div
              data-testid="join-qr"
              className="crt flex justify-center rounded-[4px] border-[3px] border-cab-700 p-4"
            >
              <img src={qrUrl} alt={`Room code ${code}`} width={150} height={150} />
            </div>
          ) : (
            <div
              data-testid="join-qr"
              className="crt h-[182px] rounded-[4px] border-[3px] border-cab-700"
            />
          )}
          <p
            data-testid="join-code"
            className="mt-4 text-center font-press text-[22px] text-cyan-500 [text-shadow:0_0_8px_rgba(62,240,255,.7)]"
          >
            {code}
          </p>
          <p data-testid="join-hint" className="mt-2 text-center text-sm text-arc-500">
            Scan the QR or type the room code
          </p>
          <p
            data-testid="join-blink"
            className="coin-blink mt-3 text-center font-press text-[9px] text-gold-500"
          >
            Insert coin to join
          </p>
        </>
      )}
      <ParticipantChips participants={participants} />
      {children}
    </section>
  );
}