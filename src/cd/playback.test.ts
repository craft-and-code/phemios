import { createRoot } from "solid-js";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createPlayback } from "../library/playback";
import { idlePlayback } from "../library/playback-state";
import {
  startCd,
  playbackState,
  playbackStart,
  playbackControl,
  playbackOutputs,
  requestAede,
} from "../platform/desktop";
vi.mock("../platform/desktop", () => ({
  startCd: vi.fn(),
  playbackAppend: vi.fn(),
  playbackState: vi.fn(),
  playbackStart: vi.fn(),
  playbackControl: vi.fn(),
  playbackOutputs: vi.fn(),
  requestAede: vi.fn(),
}));
const disc = {
  token: "0000000000000001",
  tracks: [
    { reference: "track:cd/0000000000000001/1", number: 1, duration_ms: 3000 },
    { reference: "track:cd/0000000000000001/7", number: 7, duration_ms: 4000 },
  ],
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  vi.mocked(playbackControl).mockResolvedValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function state(index = 0, status = "playing") {
  return {
    ...idlePlayback,
    source: "cd",
    status,
    reference: disc.tracks[index]!.reference,
    index,
    total: 2,
    queue: [0, 1],
    queue_id: 4,
  };
}
it("plays a CD through the shared player with no Aède session or request", async () => {
  await createRoot(async (dispose) => {
    const sessions = vi.fn();
    const player = createPlayback(
      () => false,
      undefined,
      () => {},
      sessions,
      () => false,
      { native: () => true, allowed: () => true },
    );
    vi.mocked(playbackState).mockResolvedValue(state(1));
    await player.startDisc(disc, 1);
    expect(startCd).toHaveBeenCalledWith(
      disc.token,
      disc.tracks.map((t) => t.reference),
      "",
      1,
    );
    expect(player.current()).toMatchObject({ title: "Piste 7", number: 2, durationMs: 4000 });
    expect(player.queue()).toHaveLength(2);
    expect(player.canTogglePlayback()).toBe(true);
    expect(playbackStart).not.toHaveBeenCalled();
    expect(requestAede).not.toHaveBeenCalled();
    expect(sessions).not.toHaveBeenCalled();
    expect(player.ownsSource("server")).toBe(false);
    dispose();
  });
});
it("retains exact CD queue order for footer replay after Stop without a server", async () => {
  await createRoot(async (dispose) => {
    const player = createPlayback(
      () => false,
      undefined,
      () => {},
      undefined,
      undefined,
      { native: () => true, allowed: () => true },
    );
    vi.mocked(playbackState).mockResolvedValue(state());
    await player.startDisc(disc);
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      source: "cd",
      queue: [0, 1],
      total: 2,
      queue_id: 4,
    });
    await player.action("stop");
    vi.mocked(playbackState).mockResolvedValue(state());
    await player.togglePlayback();
    expect(startCd).toHaveBeenCalledTimes(2);
    expect(requestAede).not.toHaveBeenCalled();
    dispose();
  });
});
it("refuses CD admission for a supervised account or a browser preview", async () => {
  await createRoot(async (dispose) => {
    for (const [native, allowed] of [
      [true, false],
      [false, true],
    ]) {
      const player = createPlayback(
        () => false,
        undefined,
        () => {},
        undefined,
        undefined,
        { native: () => native!, allowed: () => allowed! },
      );
      await player.startDisc(disc);
      expect(player.canStart(disc.tracks[0]!.reference)).toBe(false);
    }
    expect(startCd).not.toHaveBeenCalled();
    dispose();
  });
});
it("keeps native device discovery and volume independent of server authentication", async () => {
  await createRoot(async (dispose) => {
    const player = createPlayback(
      () => false,
      undefined,
      () => {},
      undefined,
      undefined,
      { native: () => true, allowed: () => true },
    );
    vi.mocked(playbackOutputs).mockResolvedValue([]);
    const discover = player.discover();
    await vi.advanceTimersByTimeAsync(1000);
    await discover;
    await player.volume(0.25);
    expect(playbackOutputs).toHaveBeenCalledOnce();
    expect(playbackControl).toHaveBeenCalledWith("volume", 0.25);
    expect(player.state().volume).toBe(0.25);
    dispose();
  });
});
it("does not append server music into a physical-CD queue", async () => {
  await createRoot(async (dispose) => {
    const player = createPlayback(
      () => true,
      () => ({ albums: [], artists: [] }),
      () => {},
      undefined,
      undefined,
      { native: () => true, allowed: () => true },
    );
    vi.mocked(playbackState).mockResolvedValue(state());
    await player.startDisc(disc);
    const load = vi.fn();
    await expect(player.appendSelection(load, "server")).rejects.toThrow("file CD");
    expect(load).not.toHaveBeenCalled();
    dispose();
  });
});

it("starts the visible CD from idle footer Play and contextual Space without querying Aède", async () => {
  await createRoot(async (dispose) => {
    const player = createPlayback(
      () => false,
      undefined,
      () => {},
      undefined,
      undefined,
      { native: () => true, allowed: () => true },
    );
    player.setDiscTarget(disc);
    expect(player.canTogglePlayback()).toBe(true);
    vi.mocked(playbackState).mockResolvedValue(state());
    await player.togglePlayback();
    await player.startReference(disc.tracks[1]!.reference);
    expect(startCd).toHaveBeenNthCalledWith(
      2,
      disc.token,
      disc.tracks.map((t) => t.reference),
      "",
      1,
    );
    expect(requestAede).not.toHaveBeenCalled();
    dispose();
  });
});
