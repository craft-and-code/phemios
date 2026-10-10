import { expect, it, vi } from "vitest";
import { createMissingCoverLoader } from "./missing-artwork";
import type { AccountSession } from "./server";
import type { MissingAlbum } from "./missing";
const row: MissingAlbum = {
  artist: "artist:@phemios/server/signal",
  artist_name: "Signal",
  release_group: "12345678-1234-1234-1234-123456789abc",
  title: "Missing",
  year: 2000,
  set_aside: false,
  source: "musicbrainz",
  url: "https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789abc",
};
it("deduplicates missing covers, keeps acquisition serial and ignores replaced account responses", async () => {
  let session = { account: { id: "first", role: "user" } } as AccountSession;
  let finish: (value: ArrayBuffer) => void = () => {};
  const request = vi.fn(
    () =>
      new Promise<ArrayBuffer>((resolve) => {
        finish = resolve;
      }),
  );
  const loader = createMissingCoverLoader(
    () => session,
    () => true,
    request,
    () => {},
  );
  expect(loader.status(row)).toBe("idle");
  const first = loader.load(row);
  expect(loader.status(row)).toBe("loading");
  expect(loader.load(row)).toBe(first);
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(1);
  session = { account: { id: "second", role: "user" } } as AccountSession;
  finish(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer);
  await first;
  expect(loader.image(row)).toBeUndefined();
  expect(loader.status(row)).toBe("idle");
  loader.dispose();
});
it("uses cache-only reads for auditors and never downloads unsupported sources", async () => {
  const session = { account: { role: "auditor" } } as AccountSession;
  const request = vi.fn(async () => new ArrayBuffer(0));
  const loader = createMissingCoverLoader(
    () => session,
    () => true,
    request,
    () => {},
  );
  await loader.load(row);
  await loader.load(row);
  expect(loader.status(row)).toBe("absent");
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(row.artist, row.release_group, false);
  createMissingCoverLoader(
    () => session,
    () => false,
    request,
    () => {},
  ).load({ ...row, release_group: "other" });
  expect(request).toHaveBeenCalledOnce();
});
it("retries a transient archive failure when the card is opened again", async () => {
  const session = { account: { role: "user" } } as AccountSession;
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("Archive temporarily unavailable"))
    .mockResolvedValue(new ArrayBuffer(0));
  const loader = createMissingCoverLoader(
    () => session,
    () => true,
    request,
    () => {},
  );
  await loader.load(row);
  expect(loader.error(row)).toBe("Archive temporarily unavailable");
  expect(loader.status(row)).toBe("failed");
  await loader.load(row);
  expect(request).toHaveBeenCalledTimes(2);
  expect(loader.error(row)).toBeUndefined();
  expect(loader.status(row)).toBe("absent");
});
it("runs one acquisition per source and keeps the two sources independent", async () => {
  const session = { account: { role: "user" } } as AccountSession;
  const pending: ((value: ArrayBuffer) => void)[] = [];
  const request = vi.fn(
    (_artist: string) => new Promise<ArrayBuffer>((resolve) => pending.push(resolve)),
  );
  const loader = createMissingCoverLoader(
    () => session,
    () => true,
    request,
    () => {},
  );
  const first = loader.load(row);
  const second = loader.load({ ...row, release_group: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
  const local = loader.load({ ...row, artist: "artist:@phemios/local/signal" });
  await Promise.resolve();
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    row.artist,
    "artist:@phemios/local/signal",
  ]);
  pending[0]?.(new ArrayBuffer(0));
  await first;
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(3);
  pending[1]?.(new ArrayBuffer(0));
  pending[2]?.(new ArrayBuffer(0));
  await Promise.all([second, local]);
});

it("explicit refresh retries an absent cover using its missing group, never an owned edition", async () => {
  const session = { account: { role: "user" } } as AccountSession;
  const request = vi.fn(async () => new ArrayBuffer(0));
  const loader = createMissingCoverLoader(
    () => session,
    () => true,
    request,
    () => {},
  );
  await loader.load(row);
  await loader.load(row, true);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenLastCalledWith(row.artist, row.release_group, true);
});
