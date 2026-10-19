import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createSeekProgress } from "./seek-progress";
import { type PlaybackState, idlePlayback } from "./playback-state";
it("keeps the chosen position until its native ticket is applied and coalesces fast requests", async () => {
  await createRoot(async (dispose) => {
    const [state, setState] = createSignal({
      ...idlePlayback,
      status: "playing" as const,
      reference: "track:one",
      duration_ms: 10000,
    });
    let resolve!: (v: unknown) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
      .mockResolvedValue({ seek_id: 2 });
    const progress = createSeekProgress(state, send, () => {});
    const first = progress.seek(4000);
    await progress.seek(5000);
    await progress.seek(6000);
    setState((s) => ({ ...s, position_ms: 1000 }));
    expect(progress.position()).toBe(6000);
    resolve({ seek_id: 1 });
    await first;
    expect(send.mock.calls.map((c) => c[0])).toEqual([4000, 6000]);
    setState((s) => ({ ...s, seek_id: 1, position_ms: 4000 }));
    expect(progress.position()).toBe(6000);
    setState((s) => ({ ...s, seek_id: 2, position_ms: 6100 }));
    expect(progress.position()).toBe(6100);
    const late = progress.seek(7000);
    progress.reset();
    await late;
    expect(progress.position()).toBe(6100);
    dispose();
  });
});
it("keeps a drag preview across clock updates and drops it when the track changes", () => {
  createRoot((dispose) => {
    const [state, setState] = createSignal({
      ...idlePlayback,
      status: "playing" as const,
      reference: "track:one",
      duration_ms: 10000,
    });
    const progress = createSeekProgress(
      state,
      async () => ({ seek_id: 1 }),
      () => {},
    );
    progress.preview(7000);
    setState((s) => ({ ...s, position_ms: 1100 }));
    expect(progress.position()).toBe(7000);
    progress.clearPreview();
    expect(progress.position()).toBe(1100);
    progress.preview(5000);
    setState((s) => ({ ...s, reference: "track:two", position_ms: 0 }));
    expect(progress.position()).toBe(0);
    dispose();
  });
});
it("cannot let a late seek from a reset session overwrite its replacement", async () => {
  await createRoot(async (dispose) => {
    const [state, setState] = createSignal({
      ...idlePlayback,
      status: "playing" as const,
      reference: "track:one",
      duration_ms: 10000,
    });
    let old!: (v: unknown) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (old = r)))
      .mockResolvedValue({ seek_id: 2 });
    const progress = createSeekProgress(state, send, () => {});
    const held = progress.seek(4000);
    progress.reset();
    setState((s) => ({ ...s, reference: "track:two", position_ms: 0 }));
    await progress.seek(7000);
    old({ seek_id: 1 });
    await held;
    expect(progress.position()).toBe(7000);
    setState((s) => ({ ...s, seek_id: 2, position_ms: 7100 }));
    expect(progress.position()).toBe(7100);
    dispose();
  });
});
it("reports a refused seek and restores the confirmed clock", async () => {
  await createRoot(async (dispose) => {
    const error = vi.fn(),
      state = {
        ...idlePlayback,
        status: "paused" as const,
        reference: "track:one",
        position_ms: 1234,
        duration_ms: 10000,
      };
    const progress = createSeekProgress(
      () => state,
      async () => {
        throw new Error("refused");
      },
      error,
    );
    await progress.seek(5000);
    expect(progress.position()).toBe(1234);
    expect(progress.pending()).toBe(false);
    expect(error).toHaveBeenCalledWith("refused");
    dispose();
  });
});
it.each([
  { reference: "track:two", index: 1, queue_id: 0 },
  { reference: "track:one", index: 1, queue_id: 0 },
  { reference: "track:one", index: 0, queue_id: 1 },
])(
  "does not lose a new occurrence seek behind an unfinished previous request: %j",
  async (next) => {
    await createRoot(async (dispose) => {
      const [state, setState] = createSignal({
        ...idlePlayback,
        status: "playing" as const,
        reference: "track:one",
        duration_ms: 10000,
      });
      let finish!: (value: unknown) => void;
      const send = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue({ seek_id: 2 });
      const progress = createSeekProgress(state, send, () => {});
      const previous = progress.seek(4000);
      setState((value) => ({ ...value, ...next }));
      await progress.seek(7000);
      expect(send.mock.calls.map((call) => call[0])).toEqual([4000, 7000]);
      finish({ seek_id: 1 });
      await previous;
      expect(progress.position()).toBe(7000);
      setState((value) => ({ ...value, seek_id: 2, position_ms: 7100 }));
      expect(progress.position()).toBe(7100);
      dispose();
    });
  },
);

it.each([
  ["ended", false],
  ["ended", true],
  ["error", false],
  ["error", true],
  ["idle", false],
  ["idle", true],
] as const)(
  "retires queued seeks when the occurrence becomes %s (late rejection: %s)",
  async (status, rejected) => {
    await createRoot(async (dispose) => {
      const [state, setState] = createSignal<PlaybackState>({
        ...idlePlayback,
        status: "playing",
        reference: "track:one",
        duration_ms: 10000,
      });
      let finish!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      const send = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve, fail) => {
              finish = resolve;
              reject = fail;
            }),
        )
        .mockResolvedValue({ seek_id: 2 });
      const failure = vi.fn();
      const progress = createSeekProgress(state, send, failure);
      const first = progress.seek(4000);
      await progress.seek(6000);
      setState((value) => ({ ...value, status, position_ms: 10000 }));
      if (rejected) reject(new Error("retired seek failed"));
      else finish({ seek_id: 1 });
      await first;
      await progress.seek(5000);
      expect(send.mock.calls.map((call) => call[0])).toEqual([4000]);
      expect(progress.pending()).toBe(false);
      expect(progress.position()).toBe(10000);
      expect(failure).not.toHaveBeenCalled();
      dispose();
    });
  },
);
