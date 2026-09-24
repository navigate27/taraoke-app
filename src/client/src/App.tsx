import { useEffect, useState } from "react";
import { Home } from "./views/Home";
import { Host, saveHost } from "./views/Host";
import { Guest } from "./views/Guest";

type Screen =
  | { view: "home"; joinCode: string | null }
  | { view: "host"; code: string; token: string }
  | { view: "guest"; code: string; nickname: string };

const ROOM_PATH = /\/r\/([A-Za-z0-9-]+)/;

function codeFromUrl(): string | null {
  const match = window.location.pathname.match(ROOM_PATH);
  return match ? match[1]!.toUpperCase() : null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({
    view: "home",
    joinCode: codeFromUrl(),
  });

  useEffect(() => {
    const onPop = () => setScreen({ view: "home", joinCode: codeFromUrl() });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (screen.view === "host") {
    return (
      <Host
        code={screen.code}
        token={screen.token}
        onExit={() => setScreen({ view: "home", joinCode: null })}
      />
    );
  }
  if (screen.view === "guest") {
    return (
      <Guest
        code={screen.code}
        nickname={screen.nickname}
        onExit={() => setScreen({ view: "home", joinCode: codeFromUrl() })}
      />
    );
  }
  return (
    <Home
      joinCode={screen.joinCode}
      onCreate={(code, token) => {
        saveHost(code, token);
        window.history.pushState(null, "", `/r/${code}`);
        setScreen({ view: "host", code, token });
      }}
      onJoin={(code, nickname) => {
        window.history.pushState(null, "", `/r/${code}`);
        setScreen({ view: "guest", code, nickname });
      }}
    />
  );
}