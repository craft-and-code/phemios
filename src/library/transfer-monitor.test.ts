import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createTransferMonitor } from "./transfer-monitor";
import type { TransferStatus } from "./transfers";
it("hides retained transfer paths on owner replacement while preserving the global running lock", async () => {
  const [owner, setOwner] = createSignal<object>({});
  let dispose!: () => void;
  const monitor = createRoot((cleanup) => {
    dispose = cleanup;
    return createTransferMonitor(
      owner,
      async () => ({
        phase: "copying",
        running: true,
        current: "Private/Album/Track.flac",
        done: 1,
        total: 3,
      }),
      () => true,
      vi.fn(),
    );
  });
  try {
    await monitor.poll();
    expect(monitor.status().current).toContain("Private");
    setOwner({});
    expect(monitor.status()).toEqual({ phase: "idle", running: true });
  } finally {
    dispose();
  }
});
it.each(["resolve", "reject"] as const)(
  "rejects a retired transfer status %s after an account round trip",
  async (reply) => {
    const original = {},
      [owner, setOwner] = createSignal<object>(original);
    let dispose!: () => void,
      finish!: (value: TransferStatus) => void,
      fail!: (error: Error) => void;
    const error = vi.fn();
    const monitor = createRoot((cleanup) => {
      dispose = cleanup;
      return createTransferMonitor(
        owner,
        () =>
          new Promise<TransferStatus>((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
        () => true,
        error,
      );
    });
    try {
      const pending = monitor.poll();
      setOwner({});
      setOwner(original);
      if (reply === "resolve")
        finish({
          phase: "failed",
          running: false,
          current: "Private path",
          error: "Private error",
        });
      else fail(Error("Private transport diagnostic"));
      await pending;
      expect(monitor.status()).toEqual({ phase: "idle", running: false });
      expect(error).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  },
);

it("allows one read at a time and recovers under the new owner after a retired reply", async () => {
  const [owner, setOwner] = createSignal<object>({});
  let finish!: (value: TransferStatus) => void, dispose!: () => void;
  const read = vi
    .fn<() => Promise<TransferStatus>>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ phase: "copying", running: true, current: "Current owner file" });
  const monitor = createRoot((cleanup) => {
    dispose = cleanup;
    return createTransferMonitor(owner, read, () => true, vi.fn());
  });
  try {
    const old = monitor.poll();
    setOwner({});
    await monitor.poll();
    expect(read).toHaveBeenCalledOnce();
    finish({ phase: "complete", running: false, current: "Old file" });
    await old;
    expect(monitor.status().current).toBeUndefined();
    await monitor.poll();
    expect(monitor.status().current).toBe("Current owner file");
  } finally {
    dispose();
  }
});
it("keeps current-owner errors visible but never dispatches or publishes after disposal", async () => {
  let dispose!: () => void;
  const read = vi.fn<() => Promise<TransferStatus>>().mockRejectedValue(Error("Current failure")),
    error = vi.fn();
  const monitor = createRoot((cleanup) => {
    dispose = cleanup;
    return createTransferMonitor(
      () => "owner",
      read,
      () => true,
      error,
    );
  });
  await monitor.poll();
  expect(error).toHaveBeenCalledOnce();
  let fail!: (value: Error) => void;
  read.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const pending = monitor.poll();
  dispose();
  fail(Error("Retired failure"));
  await pending;
  await monitor.poll();
  expect(error).toHaveBeenCalledOnce();
  expect(read).toHaveBeenCalledTimes(2);
});

it.each(["replacement", "round-trip", "disposal"] as const)(
  "never publishes retired transfer command feedback after %s",
  async (retirement) => {
    const original = {},
      [owner, setOwner] = createSignal<object>(original);
    let dispose!: () => void, reject!: (failure: Error) => void;
    const failure = vi.fn(),
      accepted = vi.fn(),
      read = vi.fn(async () => ({ phase: "idle", running: false }));
    const monitor = createRoot((cleanup) => {
      dispose = cleanup;
      return createTransferMonitor(owner, read, () => true, failure);
    });
    try {
      const pending = monitor.command(
        () =>
          new Promise((_resolve, refuse) => {
            reject = refuse;
          }),
        accepted,
      );
      if (retirement === "disposal") dispose();
      else {
        setOwner({});
        if (retirement === "round-trip") setOwner(original);
      }
      reject(Error("Retired transfer command refused"));
      await pending;
      expect(failure).not.toHaveBeenCalled();
      expect(accepted).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  },
);

it("keeps current transfer command failures visible and refreshes only confirmed starts", async () => {
  const failure = vi.fn(),
    accepted = vi.fn(),
    read = vi.fn(async () => ({ phase: "copying", running: true }));
  let dispose!: () => void;
  const monitor = createRoot((cleanup) => {
    dispose = cleanup;
    return createTransferMonitor(
      () => "owner",
      read,
      () => true,
      failure,
    );
  });
  try {
    const refusal = Error("Current transfer refused");
    await monitor.command(async () => {
      throw refusal;
    }, accepted);
    expect(failure).toHaveBeenCalledWith(refusal);
    expect(accepted).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    await monitor.command(async () => undefined, accepted);
    expect(accepted).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
    expect(monitor.status()).toEqual({ phase: "copying", running: true });
  } finally {
    dispose();
  }
});

it.each(["replacement", "round-trip", "disposal"] as const)(
  "never acknowledges a retired transfer command or polls a successor after %s",
  async (retirement) => {
    const original = {},
      [owner, setOwner] = createSignal<object>(original);
    let dispose!: () => void, finish!: () => void;
    const failure = vi.fn(),
      accepted = vi.fn(),
      read = vi.fn(async () => ({ phase: "copying", running: true }));
    const monitor = createRoot((cleanup) => {
      dispose = cleanup;
      return createTransferMonitor(owner, read, () => true, failure);
    });
    try {
      const pending = monitor.command(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        accepted,
      );
      if (retirement === "disposal") dispose();
      else {
        setOwner({});
        if (retirement === "round-trip") setOwner(original);
      }
      finish();
      await pending;
      expect(accepted).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      expect(failure).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  },
);

it("never dispatches transfer commands after disposal or outside the native host", async () => {
  const work = vi.fn(async () => undefined);
  let dispose!: () => void;
  const [native, setNative] = createSignal(false);
  const monitor = createRoot((cleanup) => {
    dispose = cleanup;
    return createTransferMonitor(() => "owner", vi.fn(), native, vi.fn());
  });
  await monitor.command(work);
  expect(work).not.toHaveBeenCalled();
  setNative(true);
  dispose();
  await monitor.command(work);
  expect(work).not.toHaveBeenCalled();
});
