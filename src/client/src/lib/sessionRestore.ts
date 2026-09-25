export type RestoreView =
  | { view: "host"; code: string; token: string; nickname: string }
  | { view: "guest"; code: string; nickname: string }
  | { view: "home"; joinCode: string | null };

export interface SavedHostSession {
  code: string;
  token: string;
  name?: string;
}

export interface SavedGuestSession {
  code: string;
  nickname: string;
}

/**
 * A refresh while in a room should land back in that room, not on Home.
 * Only a room URL that matches a saved session restores; anything else
 * keeps the existing Home entry points.
 */
export function restoreView(
  urlCode: string | null,
  host: SavedHostSession | null,
  guest: SavedGuestSession | null,
): RestoreView {
  if (!urlCode) return { view: "home", joinCode: null };
  if (host && host.code === urlCode) {
    return {
      view: "host",
      code: host.code,
      token: host.token,
      nickname: host.name ?? "Host",
    };
  }
  if (guest && guest.code === urlCode) {
    return { view: "guest", code: guest.code, nickname: guest.nickname };
  }
  return { view: "home", joinCode: urlCode };
}