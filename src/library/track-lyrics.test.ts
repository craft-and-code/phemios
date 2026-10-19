import {
  createComponent,
  createMemo,
  createRoot,
  createSignal,
  Suspense,
  type JSX,
} from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { createTrackLyrics } from "./track-lyrics";
import type { AccountSession } from "./server";
import type { Job } from "./jobs";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const session: AccountSession = {
  server: "http://localhost:3412",
  account: { id: "one", username: "one", role: "user" },
};
const answer = {
  track: "track:one",
  lyrics: {
    source: "tag",
    synced: false,
    lines: [{ at_ms: null, text: "Original control words" }],
  },
};
const settle = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};
it("reads only expanded words, routes their origin and retains text after collapsing", async () => {
  vi.mocked(requestAede).mockResolvedValue(answer);
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => true,
      session: () => session,
      jobs: () => [],
    });
  });
  await settle();
  expect(requestAede).not.toHaveBeenCalled();
  expect(words.available()).toBe(true);
  words.toggle();
  await settle();
  expect(requestAede).toHaveBeenCalledWith(
    "/api/v1/lyrics",
    { track: "track:one" },
    "GET",
    null,
    "server",
    session,
  );
  expect(words.lyrics()?.lines[0]?.text).toBe("Original control words");
  words.toggle();
  expect(words.visible()).toBe(false);
  dispose();
});
it("does not publish a late answer after an account replacement", async () => {
  let finish!: (raw: unknown) => void;
  vi.mocked(requestAede).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const [account, setAccount] = createSignal<AccountSession | undefined>(session);
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => false,
      session: account,
      jobs: () => [],
    });
  });
  words.toggle();
  await settle();
  setAccount(undefined);
  finish(answer);
  await settle();
  expect(words.lyrics()).toBeUndefined();
  expect(words.available()).toBe(false);
  dispose();
});
it("reveals newly acquired lyrics without a catalog rescan and exposes read failures", async () => {
  vi.mocked(requestAede).mockResolvedValue(answer);
  const [jobs, setJobs] = createSignal<Job[]>([]);
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => false,
      session: () => session,
      jobs,
    });
  });
  setJobs([
    { task_id: 3, source: "server", release: "track:one", kind: "lyrics", status: "completed" },
  ]);
  await settle();
  expect(words.available()).toBe(true);
  expect(words.visible()).toBe(false);
  vi.mocked(requestAede).mockRejectedValue(new Error("source changed"));
  words.toggle();
  await settle();
  expect(words.error()).toContain("source changed");
  expect(() => words.available()).not.toThrow();
  dispose();
});
it("only probes legacy details, and keeps absent words distinct from malformed answers", async () => {
  vi.mocked(requestAede).mockResolvedValue({ track: "track:one", lyrics: null });
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => undefined,
      session: () => session,
      jobs: () => [],
      detail: true,
    });
  });
  await settle();
  expect(words.available()).toBe(false);
  expect(words.error()).toBe("");
  vi.mocked(requestAede).mockResolvedValue({ ...answer, track: "track:other" });
  words.toggle();
  await settle();
  expect(words.error()).toContain("invalides");
  dispose();
});

it("keeps loaded playback words stable through same-reference clock polls", async () => {
  vi.mocked(requestAede).mockResolvedValue(answer);
  const [clock, setClock] = createSignal(0);
  let dispose!: () => void;
  createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => {
        clock();
        return "track:one";
      },
      available: () => undefined,
      session: () => session,
      jobs: () => [],
      detail: true,
    });
  });
  await settle();
  expect(requestAede).toHaveBeenCalledOnce();
  setClock(100);
  await settle();
  setClock(200);
  await settle();
  expect(requestAede).toHaveBeenCalledOnce();
  dispose();
});

it("refreshes the active detail when a completed server lyrics job omits its optional source", async () => {
  const [jobs, setJobs] = createSignal<Job[]>([]);
  vi.mocked(requestAede).mockResolvedValue({ track: "track:one", lyrics: null });
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => undefined,
      session: () => session,
      jobs,
      detail: true,
    });
  });
  await settle();
  expect(words.lyrics()).toBeNull();
  vi.mocked(requestAede).mockResolvedValue(answer);
  setJobs([{ task_id: 99, kind: "lyrics", release: "track:one", status: "completed" }]);
  await settle();
  expect(words.lyrics()?.lines[0]?.text).toBe("Original control words");
  dispose();
});

/** Optional words must not suspend the parent workspace and collapse its scrolled queue. */
it("keeps the workspace mounted during initial and replacement lyric reads", async () => {
  const replies: ((raw: unknown) => void)[] = [];
  vi.mocked(requestAede).mockImplementation(() => new Promise((resolve) => replies.push(resolve)));
  const [reference, setReference] = createSignal("track:one");
  let dispose!: () => void;
  const view = createRoot((end) => {
    dispose = end;
    return createComponent(Suspense, {
      fallback: "workspace-loading",
      get children() {
        const words = createTrackLyrics({
          reference,
          available: () => undefined,
          session: () => session,
          jobs: () => [],
          detail: true,
        });
        return createMemo(
          () => words.lyrics()?.lines[0]?.text ?? "workspace-without-words",
        ) as unknown as JSX.Element;
      },
    });
  });
  const rendered = () => {
    let value: unknown = view;
    while (typeof value === "function") value = value();
    return value;
  };
  try {
    await settle();
    expect(rendered()).toBe("workspace-without-words");
    replies.shift()!(answer);
    await settle();
    expect(rendered()).toBe("Original control words");
    setReference("track:next");
    await settle();
    expect(rendered()).toBe("workspace-without-words");
    replies.shift()!({ ...answer, track: "track:next" });
    await settle();
    expect(rendered()).toBe("Original control words");
  } finally {
    dispose();
  }
});

it("hides retained words immediately after logout and re-login with the same session object", async () => {
  vi.mocked(requestAede).mockResolvedValueOnce(answer);
  const [owner, setOwner] = createSignal<AccountSession | undefined>(session);
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => false,
      session: owner,
      jobs: () => [],
      detail: true,
    });
  });
  try {
    words.toggle();
    await settle();
    expect(words.lyrics()?.lines[0]?.text).toBe("Original control words");
    setOwner(undefined);
    vi.mocked(requestAede).mockImplementationOnce(() => new Promise(() => {}));
    setOwner(session);
    expect(words.lyrics()).toBeUndefined();
    expect(words.error()).toBe("");
  } finally {
    dispose();
  }
});

it("does not expose a lyrics reply after the optional reader is disposed", async () => {
  let finish!: (raw: unknown) => void;
  vi.mocked(requestAede).mockImplementation(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  let dispose!: () => void;
  const words = createRoot((end) => {
    dispose = end;
    return createTrackLyrics({
      reference: () => "track:one",
      available: () => true,
      session: () => session,
      jobs: () => [],
    });
  });
  words.toggle();
  await settle();
  dispose();
  finish(answer);
  await settle();
  expect(words.lyrics()).toBeUndefined();
});
