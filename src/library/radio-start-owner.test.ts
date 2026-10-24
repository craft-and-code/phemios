import { expect, it, vi } from "vitest";
import { disposeLibrary } from "./context-test-fixtures";
import { loginAede, requestAede } from "../platform/desktop";
import {
  radioOwners,
  holdRadioStart,
  leaseActions,
  leaseCalls,
  expectLeaseOwner,
  station,
  successorStation,
  type StartBarrier,
} from "./radio-start-owner-test-fixtures";
import { settleParental } from "./parental-test-fixtures";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return {
    ...(await mockLibraryDesktop()),
    resolveRadio: vi.fn(),
    playbackStart: vi.fn(),
    playbackControl: vi.fn(),
    playbackState: vi.fn(),
  };
});
vi.mock("../radio/playback", async (original) => ({
  ...(await original<typeof import("../radio/playback")>()),
  browserRadioMedia: vi.fn(),
}));
const barriers: StartBarrier[] = ["handoff", "volume", "directory"];

it.each(barriers)(
  "PH-009 retains the initiating allowed owner across a selected-source change during %s",
  async (barrier) => {
    const fixture = await radioOwners(true, false);
    const held = await holdRadioStart(fixture, barrier);
    const afterHold = vi.mocked(requestAede).mock.calls.length;
    try {
      fixture.library.chooseSource("local");
      expect(fixture.library.source()).toBe("local");
      await held.finish();
      expect(held.firstMedia.play).toHaveBeenCalledOnce();
      expectLeaseOwner("reserve", "server", fixture.owners.server);
      for (const [path, , , , source, owner] of vi
        .mocked(requestAede)
        .mock.calls.slice(afterHold)) {
        if (path === "/api/me/v1/parental") {
          expect(source).toBe("server");
          expect(owner).toBe(fixture.owners.server);
        }
      }
      fixture.library.radio.stop();
      await settleParental();
      expectLeaseOwner("release", "server", fixture.owners.server);
    } finally {
      await held.finish();
    }
  },
);

it.each(barriers)(
  "PH-009 keeps initiating-owner refusal when another source allows radio during %s",
  async (barrier) => {
    const fixture = await radioOwners(false, true);
    const held = await holdRadioStart(fixture, barrier);
    try {
      fixture.library.chooseSource("local");
      await held.finish();
      expect(held.firstMedia.play).not.toHaveBeenCalled();
      expect(leaseActions("reserve")).toHaveLength(0);
      expect(fixture.library.radio.error()).toContain("radios est interdit");
    } finally {
      await held.finish();
    }
  },
);

it.each(
  barriers.flatMap((barrier) =>
    ["logout", "replacement"].map((retirement) => ({ barrier, retirement })),
  ),
)(
  "PH-009 retires the initiating exact session after $retirement during $barrier",
  async ({ barrier, retirement }) => {
    const fixture = await radioOwners();
    const held = await holdRadioStart(fixture, barrier);
    try {
      if (retirement === "logout") await fixture.library.disconnect();
      else {
        const previous = fixture.owners.server;
        const replacement = {
          ...previous,
          nativeSession: "replacement-radio-session",
          account: { ...previous.account },
        };
        fixture.owners.server = replacement;
        vi.mocked(loginAede).mockResolvedValueOnce(replacement);
        await fixture.library.connect(replacement.server, replacement.account.username, "fixture");
        expect(fixture.library.serverSession()).toBe(replacement);
      }
      await held.finish();
      expect(held.firstMedia.play).not.toHaveBeenCalled();
      expect(leaseActions("reserve")).toHaveLength(0);
    } finally {
      await held.finish();
    }
  },
);

it.each(
  barriers.flatMap((barrier) =>
    ["stop", "dispose", "second-start"].map((retirement) => ({ barrier, retirement })),
  ),
)(
  "PH-009 retires an old radio attempt after $retirement during $barrier",
  async ({ barrier, retirement }) => {
    const fixture = await radioOwners();
    const held = await holdRadioStart(fixture, barrier);
    let successor: Promise<void> | undefined;
    try {
      if (retirement === "stop") fixture.library.radio.stop();
      else if (retirement === "dispose") disposeLibrary();
      else successor = fixture.library.radio.start(successorStation);
      await held.finish();
      await successor;
      expect(held.firstMedia.play).not.toHaveBeenCalled();
      if (retirement !== "second-start") expect(leaseActions("reserve")).toHaveLength(0);
      else {
        expect(fixture.library.radio.station()?.uuid).toBe(successorStation.uuid);
        expect(leaseActions("reserve").length).toBeLessThanOrEqual(1);
      }
    } finally {
      await held.finish();
      await successor;
    }
  },
);

it("PH-009 retains an already admitted stream's source-specific reserve, renewal and release", async () => {
  const fixture = await radioOwners(true, false);
  await fixture.library.radio.start(station);
  expect(fixture.library.radio.status()).toBe("playing");
  expectLeaseOwner("reserve", "server", fixture.owners.server);
  fixture.library.chooseSource("local");
  expect(fixture.library.radio.status()).toBe("playing");
  await vi.advanceTimersByTimeAsync(5000);
  expectLeaseOwner("renew", "server", fixture.owners.server);
  fixture.library.radio.stop();
  await settleParental();
  expectLeaseOwner("release", "server", fixture.owners.server);
  expect(leaseCalls().every(([, , , , source]) => source === "server")).toBe(true);
});
