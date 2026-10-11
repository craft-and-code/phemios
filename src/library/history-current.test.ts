import { expect, it } from "vitest";
import { currentHistoryListen } from "./history-current";
import type { AccountSession } from "./server";
const session: AccountSession = {
  server: "http://127.0.0.1:8787",
  account: { id: "listener", username: "listener", role: "user" },
};
const item = {
  reference: "track:first",
  title: "First",
  artist: "Artist",
  album: null,
  number: 1,
  albumTotal: 1,
};
it("shows the actual active owner's output without waiting for a saved visit", () => {
  expect(
    currentHistoryListen({ item, owner: session, session, status: "playing", offset: 0 }),
  ).toBe(item);
  expect(currentHistoryListen({ item, owner: session, session, status: "paused", offset: 0 })).toBe(
    item,
  );
});
it("never exposes another owner's current track, signed-out output or completed visits as active", () => {
  const input = { item, owner: session, session, status: "playing", offset: 0 };
  expect(currentHistoryListen({ ...input, session: undefined })).toBeUndefined();
  expect(currentHistoryListen({ ...input, owner: { ...session } })).toBeUndefined();
  expect(currentHistoryListen({ ...input, status: "ended" })).toBeUndefined();
  expect(currentHistoryListen({ ...input, offset: 50 })).toBeUndefined();
});
