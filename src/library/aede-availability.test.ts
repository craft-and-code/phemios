import { createRoot, createSignal } from "solid-js";
import { vi } from "vitest";
import { expect, it } from "vitest";
import {
  createAedeAvailability,
  isAedeConnectionError,
  errorMessage,
  inlineAedeError,
  aedeAvailability,
  retryAedeReadOnRecovery,
} from "./aede-availability";
it("reports one outage per source and clears it on recovery or logout", () => {
  const state = createAedeAvailability();
  state.owner("server", "alice");
  state.failure("server", "alice", new Error("Impossible de joindre Aède."));
  expect(state.unavailable()).toEqual(["server"]);
  state.failure("server", "alice", new Error("Impossible de joindre Aède."));
  expect(state.unavailable()).toEqual(["server"]);
  state.success("server", "alice");
  expect(state.unavailable()).toEqual([]);
  state.failure("server", "alice", "Unable to reach Aède.");
  state.owner("server");
  expect(state.unavailable()).toEqual([]);
});
it("ignores late replies from an old account and keeps local/server independent", () => {
  const state = createAedeAvailability();
  state.owner("server", "alice");
  state.owner("server", "bob");
  state.owner("local", "local");
  state.failure("server", "alice", "Impossible de joindre Aède.");
  expect(state.unavailable()).toEqual([]);
  state.failure("server", "bob", "Impossible de joindre Aède.");
  state.success("local", "local");
  state.success("server", "alice");
  expect(state.unavailable()).toEqual(["server"]);
  state.owner("server");
  state.failure("server", undefined, "Impossible de joindre Aède.");
  expect(state.unavailable()).toEqual([]);
});
it("distinguishes transport failures from permissions, unreadable data and other services", () => {
  for (const value of [
    "Error: Impossible de joindre Aède.",
    "Serveur · Error: Impossible de joindre Aède.",
    "Unable to reach Aède.",
  ])
    expect(isAedeConnectionError(value)).toBe(true);
  for (const value of [
    "Accès refusé.",
    "Cache inaccessible.",
    "Impossible de joindre HQPlayer.",
    "Radio Browser indisponible.",
  ])
    expect(isAedeConnectionError(value)).toBe(false);
  expect(errorMessage(new Error("Accès refusé."))).toBe("Accès refusé.");
});

it("centralizes transport messages without hiding a partial failure or an unauthenticated login error", () => {
  expect(
    inlineAedeError(
      "Serveur · Error: Impossible de joindre Aède.\nLocal · Error: Accès refusé.",
      true,
    ),
  ).toBe("Local · Accès refusé.");
  expect(inlineAedeError("Error: Impossible de joindre Aède.", false)).toBe(
    "Impossible de joindre Aède.",
  );
  expect(inlineAedeError("Unable to reach Aède.", true)).toBe("");
});

it("retries an opted-in failed read once on recovery, never on a normal success, owner replacement or after disposal", () => {
  const retry = vi.fn();
  const view = createRoot((dispose) => {
    const [error, setError] = createSignal("Impossible de joindre Aède.");
    retryAedeReadOnRecovery(error, retry);
    return { dispose, setError };
  });
  aedeAvailability.owner("server", "recovery-fixture");
  aedeAvailability.success("server", "recovery-fixture");
  expect(retry).not.toHaveBeenCalled();
  aedeAvailability.failure("server", "recovery-fixture", "Impossible de joindre Aède.");
  aedeAvailability.success("server", "recovery-fixture");
  expect(retry).toHaveBeenCalledTimes(1);
  view.setError("Accès refusé.");
  aedeAvailability.failure("server", "recovery-fixture", "Impossible de joindre Aède.");
  aedeAvailability.success("server", "recovery-fixture");
  expect(retry).toHaveBeenCalledTimes(1);
  aedeAvailability.owner("server", "new-owner");
  expect(retry).toHaveBeenCalledTimes(1);
  view.dispose();
  aedeAvailability.failure("server", "new-owner", "Impossible de joindre Aède.");
  aedeAvailability.success("server", "new-owner");
  expect(retry).toHaveBeenCalledTimes(1);
  aedeAvailability.owner("server");
});
