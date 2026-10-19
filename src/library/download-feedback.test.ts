import { createRoot } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createDownloadFeedback } from "./download-feedback";
afterEach(() => vi.useRealTimers());
it("acknowledges completed work temporarily and never a canceled transfer", async () => {
  vi.useFakeTimers();
  let dispose = () => {};
  const state = createRoot((end) => {
    dispose = end;
    return createDownloadFeedback();
  });
  await state.run(async () => false);
  expect(state.phase()).toBe("idle");
  await state.run(async () => "saved");
  expect(state.phase()).toBe("complete");
  vi.advanceTimersByTime(3000);
  expect(state.phase()).toBe("idle");
  dispose();
});
it("refuses late acknowledgements after target replacement or disposal", async () => {
  let done = (_value: unknown) => {};
  let dispose = () => {};
  const state = createRoot((end) => {
    dispose = end;
    return createDownloadFeedback();
  });
  const pending = state.run(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  expect(state.phase()).toBe("busy");
  state.reset();
  done("old-owner-file");
  await pending;
  expect(state.phase()).toBe("idle");
  const later = state.run(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  dispose();
  done("file");
  await later;
  expect(state.phase()).toBe("idle");
});
it("retains failures and admits one pending transfer", async () => {
  let done = () => {};
  let dispose = () => {};
  const state = createRoot((end) => {
    dispose = end;
    return createDownloadFeedback();
  });
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  const first = state.run(action);
  await state.run(action);
  expect(action).toHaveBeenCalledTimes(1);
  done();
  await first;
  await expect(
    state.run(async () => {
      throw new Error("disk full");
    }),
  ).rejects.toThrow("disk full");
  expect(state.phase()).toBe("idle");
  dispose();
});

it("suppresses old-owner errors after replacement", async () => {
  let fail = (_error: Error) => {};
  let dispose = () => {};
  const state = createRoot((end) => {
    dispose = end;
    return createDownloadFeedback();
  });
  const pending = state.run(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  state.reset();
  fail(new Error("previous account"));
  await pending;
  expect(state.phase()).toBe("idle");
  dispose();
});

it("does not let a retired download failure clear or acknowledge a newer pending download", async () => {
  let dispose!: () => void, rejectOld!: (error: Error) => void, finishNew!: () => void;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createDownloadFeedback();
  });
  try {
    const old = state.run(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectOld = reject;
        }),
    );
    state.reset();
    const next = state.run(
      () =>
        new Promise<void>((resolve) => {
          finishNew = resolve;
        }),
    );
    rejectOld(Error("Retired private export"));
    await old;
    expect(state.phase()).toBe("busy");
    finishNew();
    await next;
    expect(state.phase()).toBe("complete");
  } finally {
    dispose();
  }
});
