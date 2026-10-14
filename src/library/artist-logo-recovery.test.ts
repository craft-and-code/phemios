import { expect, it, vi } from "vitest";
import { createArtistLogoRecovery } from "./artist-logo-recovery";
it("recovers visible legacy logos once per scope and never asks offline or for retained images", async () => {
  let scope: object | undefined;
  const load = vi.fn(async () => {}),
    failed = vi.fn();
  const reader = createArtistLogoRecovery({
    enabled: () => true,
    scope: () => scope,
    cached: (ref) => ref === "cached",
    load,
    failed,
  });
  reader.visibility("legacy", true);
  expect(load).not.toHaveBeenCalled();
  scope = {};
  reader.visibility("cached", true);
  reader.refresh();
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  reader.refresh();
  expect(load).toHaveBeenCalledWith("legacy");
  expect(load).toHaveBeenCalledOnce();
  scope = {};
  reader.refresh();
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  reader.dispose();
});
it("serializes reads and discards a queued card when it leaves the viewport", async () => {
  const scope = {},
    releases: (() => void)[] = [];
  const load = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
  const reader = createArtistLogoRecovery({
    enabled: () => true,
    scope: () => scope,
    cached: () => false,
    load,
    failed: vi.fn(),
  });
  reader.visibility("one", true);
  reader.visibility("two", true);
  expect(load).toHaveBeenCalledTimes(1);
  reader.visibility("two", false);
  releases[0]!();
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  reader.dispose();
});
it("retires queued work when a source changes or the gallery is disposed", async () => {
  let scope: object = {};
  let release!: () => void;
  const load = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const reader = createArtistLogoRecovery({
    enabled: () => true,
    scope: () => scope,
    cached: () => false,
    load,
    failed: vi.fn(),
  });
  reader.visibility("one", true);
  reader.visibility("two", true);
  scope = {};
  release();
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  reader.refresh();
  expect(load).toHaveBeenCalledTimes(2);
  reader.dispose();
  release();
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(2);
});
it("reports failed reads and continues while an inactive presentation starts no read", async () => {
  let enabled = false;
  const scope = {},
    failure = new Error("fictional read failed"),
    failed = vi.fn();
  const load = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
  const reader = createArtistLogoRecovery({
    enabled: () => enabled,
    scope: () => scope,
    cached: () => false,
    load,
    failed,
  });
  reader.visibility("one", true);
  reader.visibility("two", true);
  expect(load).not.toHaveBeenCalled();
  enabled = true;
  reader.refresh();
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  expect(failed).toHaveBeenCalledWith(failure);
  reader.dispose();
});
