import { expect, it } from "vitest";
import {
  contextualReference,
  repeatDisabled,
  footerTransport,
  isQueueWorkspace,
} from "./contextual-play";
it("prefers the detail target, then the front cover, then the first enabled visible result", () => {
  const rows = [
    { reference: "track:first", disabled: false, central: false, visible: true },
    { reference: "album:front", disabled: false, central: true, visible: true },
  ];
  expect(contextualReference("album:detail", rows)).toBe("album:detail");
  expect(contextualReference("", rows)).toBe("album:front");
  expect(contextualReference("", [{ ...rows[1]!, disabled: true }, rows[0]!])).toBe("track:first");
  expect(contextualReference("", [{ ...rows[0]!, visible: false }])).toBe("");
});
it("repeat is unavailable until audio is actually active", () => {
  for (const status of ["idle", "connecting", "ended", "error"])
    expect(repeatDisabled(status, false, true, false)).toBe(true);
  for (const status of ["playing", "paused"])
    expect(repeatDisabled(status, false, true, false)).toBe(false);
  expect(repeatDisabled("playing", true, true, false)).toBe(true);
  expect(repeatDisabled("playing", false, true, true)).toBe(true);
});

it("lets a prepared playlist own footer Play without changing other views or empty queues", () => {
  expect(footerTransport({ queueView: true, queued: true, podcast: true, radio: true })).toBe(
    "catalog",
  );
  expect(footerTransport({ queueView: true, queued: true, podcast: false, radio: true })).toBe(
    "catalog",
  );
  expect(footerTransport({ queueView: true, queued: false, podcast: true, radio: true })).toBe(
    "podcast",
  );
  expect(footerTransport({ queueView: true, queued: false, podcast: false, radio: true })).toBe(
    "radio",
  );
  expect(footerTransport({ queueView: false, queued: true, podcast: true, radio: true })).toBe(
    "podcast",
  );
  expect(footerTransport({ queueView: false, queued: true, podcast: false, radio: true })).toBe(
    "radio",
  );
  expect(footerTransport({ queueView: false, queued: true, podcast: false, radio: false })).toBe(
    "catalog",
  );
});

it("limits queue-footer priority to the workspace route, not a detail opened from it", () => {
  expect(isQueueWorkspace({ kind: "section", section: "playlists" })).toBe(true);
  expect(isQueueWorkspace({ kind: "album", reference: "release:one" })).toBe(false);
  expect(isQueueWorkspace({ kind: "track", reference: "track:one" })).toBe(false);
  expect(isQueueWorkspace({ kind: "section", section: "playback" })).toBe(false);
});
