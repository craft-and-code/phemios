import { expect, it, vi } from "vitest";
import { restoreTrackCache } from "./track-recovery";
const ports = () => ({
  connected: false,
  connectLocal: vi.fn(async () => {}),
  sync: vi.fn(async () => {}),
  hasTracks: vi.fn(() => true),
  failure: () => "",
});
it("explicitly reconnects a local engine and checks that its cache contains tracks", async () => {
  const p = ports();
  expect(await restoreTrackCache("local", p, () => true)).toBe(true);
  expect(p.connectLocal).toHaveBeenCalledOnce();
  expect(p.sync).not.toHaveBeenCalled();
});
it("synchronizes a connected source instead of rereading its incomplete cache", async () => {
  const p = ports();
  p.connected = true;
  expect(await restoreTrackCache("server", p, () => true)).toBe(true);
  expect(p.sync).toHaveBeenCalledWith("server");
});
it("requires remote authority and refuses success for an incomplete refreshed cache", async () => {
  const p = ports();
  await expect(restoreTrackCache("server", p, () => true)).rejects.toThrow(/Connectez/);
  expect(p.sync).not.toHaveBeenCalled();
  p.connected = true;
  p.hasTracks.mockReturnValue(false);
  await expect(restoreTrackCache("server", p, () => true)).rejects.toThrow(/Synchronisez/);
});
it("does not report success after cancellation during synchronization", async () => {
  const p = ports();
  let current = true;
  p.sync.mockImplementation(async () => {
    current = false;
  });
  p.connected = true;
  expect(await restoreTrackCache("server", p, () => current)).toBeUndefined();
  expect(p.hasTracks).not.toHaveBeenCalled();
});
