import { describe, expect, it } from "vitest";
import { restoreView } from "./sessionRestore";

describe("restoreView", () => {
  it("restores the guest view when the URL matches a saved guest session", () => {
    const view = restoreView(
      "TARA-ABCD",
      null,
      { code: "TARA-ABCD", nickname: "Gwen" },
    );
    expect(view).toEqual({
      view: "guest",
      code: "TARA-ABCD",
      nickname: "Gwen",
    });
  });

  it("restores the host view (with token) when the URL matches a saved host session", () => {
    const view = restoreView(
      "TARA-ABCD",
      { code: "TARA-ABCD", token: "tok", name: "Host" },
      null,
    );
    expect(view).toEqual({
      view: "host",
      code: "TARA-ABCD",
      token: "tok",
      nickname: "Host",
    });
  });

  it("prefers the host session when both sessions match the URL", () => {
    const view = restoreView(
      "TARA-ABCD",
      { code: "TARA-ABCD", token: "tok", name: "Host" },
      { code: "TARA-ABCD", nickname: "Gwen" },
    );
    expect(view.view).toBe("host");
  });

  it("lands on Home with the code prefilled when the URL has no matching session", () => {
    const view = restoreView(
      "TARA-OTHER",
      { code: "TARA-ABCD", token: "tok" },
      { code: "TARA-ABCD", nickname: "Gwen" },
    );
    expect(view).toEqual({ view: "home", joinCode: "TARA-OTHER" });
  });

  it("lands on Home when there is no room URL", () => {
    const view = restoreView(
      null,
      { code: "TARA-ABCD", token: "tok" },
      { code: "TARA-ABCD", nickname: "Gwen" },
    );
    expect(view).toEqual({ view: "home", joinCode: null });
  });

  it("falls back to Home when no sessions exist", () => {
    expect(restoreView("TARA-ABCD", null, null)).toEqual({
      view: "home",
      joinCode: "TARA-ABCD",
    });
  });
});