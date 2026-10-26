import { beforeEach, expect, it, vi } from "vitest";
const output = vi.hoisted(() => ({
  media: new EventTarget() as EventTarget & {
    paused: boolean;
    ended: boolean;
    src: string;
    duration: number;
    currentTime: number;
    error: null;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  },
  prepare: vi.fn(),
  stop: vi.fn(),
  volume: vi.fn(),
  sampleRate: () => 48000,
  levels: () => Array(24).fill(0),
}));
vi.mock("./audio-output", () => ({
  WebAudioOutput: class {
    media = output.media;
    prepare = output.prepare;
    stop = output.stop;
    volume = output.volume;
    sampleRate = output.sampleRate;
    levels = output.levels;
  },
}));
import { WebPlayer } from "./player";
beforeEach(() => {
  vi.clearAllMocks();
  output.media = Object.assign(new EventTarget(), {
    paused: true,
    ended: false,
    src: "",
    duration: 10,
    currentTime: 0,
    error: null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  });
  output.prepare.mockResolvedValue(undefined);
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
it("returns a connecting snapshot while preparation remains cancellable and rejects its late audio URL", async () => {
  let resolve!: (source: { url: string; release: () => void }) => void;
  const release = vi.fn();
  const player = new WebPlayer(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await player.start(["track:first"], 0, "", "without-effects");
  await flush();
  expect(player.snapshot().status).toBe("connecting");
  await player.control("stop", null);
  resolve({ url: "blob:retired", release });
  await flush();
  expect(output.media.play).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
  expect(player.snapshot().status).toBe("idle");
});
it("a stale preparation cannot replace a new source or stop its output", async () => {
  let first!: (source: { url: string }) => void;
  const player = new WebPlayer((ref) =>
    ref === "track:first"
      ? new Promise((done) => {
          first = done;
        })
      : Promise.resolve({ url: "blob:second" }),
  );
  await player.start(["track:first"], 0, "", "without-effects");
  await flush();
  await player.start(["track:second"], 0, "", "without-effects");
  await flush();
  first({ url: "blob:first" });
  await flush();
  expect(output.media.src).toBe("blob:second");
  expect(player.snapshot().reference).toBe("track:second");
  expect(player.snapshot().status).toBe("playing");
});
it("keeps pause/resume, exact mute, repeat and occurrence-based queue edits on the shared controller contract", async () => {
  const player = new WebPlayer(async (ref) => ({ url: `blob:${ref}` }));
  await player.start(["track:first", "track:first", "track:second"], 0, "", "without-effects");
  await flush();
  const id = player.snapshot().queue_id;
  await player.control("pause", null);
  expect(player.snapshot().status).toBe("paused");
  await player.control("resume", null);
  await player.control("volume", 0);
  expect(output.volume).toHaveBeenLastCalledWith(0);
  expect(player.snapshot().volume).toBe(0);
  await player.control("repeat", "all");
  await player.control("queue", { queue_id: id, order: [0, 2, 1] });
  await player.control("remove", { queue_id: id, index: 1 });
  expect(player.snapshot().queue).toEqual([0, 2]);
  expect(player.snapshot().total).toBe(3);
  await expect(player.control("remove", { queue_id: id - 1, index: 0 })).rejects.toThrow();
  await player.control("clear", null);
  expect(player.snapshot().status).toBe("idle");
  expect(player.snapshot().queue).toEqual([]);
});

it("pause retires an unresolved visit and resume prepares it again without publishing its late source", async () => {
  let old!: (source: { url: string; release: () => void }) => void;
  const release = vi.fn();
  const resolve = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          old = done;
        }),
    )
    .mockResolvedValue({ url: "blob:resumed" });
  const player = new WebPlayer(resolve);
  await player.start(["track:first"], 0, "", "without-effects");
  await flush();
  await player.control("pause", null);
  old({ url: "blob:cancelled", release });
  await flush();
  expect(output.media.play).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
  expect(player.snapshot().status).toBe("paused");
  await player.control("resume", null);
  await flush();
  expect(output.media.src).toBe("blob:resumed");
  expect(player.snapshot().status).toBe("playing");
});
it("a deferred resume cannot overwrite a later pause or keep the controller busy", async () => {
  const player = new WebPlayer(async () => ({ url: "blob:first" }));
  await player.start(["track:first"], 0, "", "without-effects");
  await flush();
  await player.control("pause", null);
  let done!: () => void;
  output.prepare.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  await player.control("resume", null);
  await player.control("pause", null);
  output.media.play.mockClear();
  done();
  await flush();
  expect(player.snapshot().status).toBe("paused");
  expect(output.media.play).not.toHaveBeenCalled();
});

it("a boundary Next cancels a connecting final visit instead of letting its late file restart playback", async () => {
  let finish!: (source: { url: string; release: () => void }) => void;
  const release = vi.fn(),
    player = new WebPlayer(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  await player.start(["track:last"], 0, "", "without-effects");
  await flush();
  await player.control("next", null);
  expect(player.snapshot().status).toBe("ended");
  finish({ url: "blob:late", release });
  await flush();
  expect(player.snapshot().status).toBe("ended");
  expect(output.media.play).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
});

it("keeps the consumed endpoint when the final track naturally ends", async () => {
  const player = new WebPlayer(async () => ({ url: "blob:final" }));
  await player.start(["track:final"], 0, "", "without-effects");
  await flush();
  output.media.currentTime = 10;
  output.media.duration = 10;
  output.media.ended = true;
  output.media.dispatchEvent(new Event("ended"));
  expect(player.snapshot().status).toBe("ended");
  expect(player.snapshot().position_ms).toBe(10000);
  expect(player.snapshot().duration_ms).toBe(10000);
});
