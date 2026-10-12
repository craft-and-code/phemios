import { expect, it, vi } from "vitest";
import { writeRoonImport } from "./roon-write";
import type { RoonRow } from "./roon-plan";
import { annotation, deferred } from "./test-fixtures";
const rows: RoonRow[] = [
  {
    line: 2,
    title: "Boreal",
    artist: "Example",
    reference: "release:c",
    desired: { rating: 4, loved: true },
    status: "ready",
  },
  {
    line: 3,
    title: "Aether",
    artist: "Example",
    reference: "release:a",
    desired: { rating: 5 },
    status: "ready",
  },
];
const ports = () => ({
  active: () => true,
  read: vi.fn(async (reference: string) => ({ reference, annotation: null })),
  write: vi.fn(async (reference: string, patch: object) => ({
    reference,
    annotation: annotation(reference, patch),
  })),
  publish: vi.fn(),
  progress: vi.fn(),
});
it("rechecks saved annotations, skips new conflicts and publishes only exact confirmed targets", async () => {
  const io = ports();
  io.read.mockImplementation(
    async (reference) =>
      ({
        reference,
        annotation: reference === "release:c" ? annotation(reference, { rating: 3 }) : null,
      }) as never,
  );
  expect(await writeRoonImport(rows, io)).toEqual({ saved: 1, skipped: 1, stopped: false });
  expect(io.write.mock.calls).toEqual([["release:a", { rating: 5 }]]);
  expect(io.publish).toHaveBeenCalledOnce();
});
it("logout while reading prevents all writes", async () => {
  const io = ports(),
    pending = deferred<{ reference: string; annotation: null }>();
  let active = true;
  io.active = () => active;
  io.read.mockImplementation(() => pending.promise);
  const work = writeRoonImport(rows, io);
  active = false;
  pending.resolve({ reference: "release:c", annotation: null });
  expect((await work).stopped).toBe(true);
  expect(io.write).not.toHaveBeenCalled();
});
it("an account replaced while writing receives no old private result or remaining requests", async () => {
  const io = ports(),
    pending = deferred<{ reference: string; annotation: ReturnType<typeof annotation> }>();
  let active = true;
  io.active = () => active;
  io.write.mockImplementation(() => pending.promise);
  const work = writeRoonImport(rows, io);
  await Promise.resolve();
  active = false;
  pending.resolve({ reference: "release:c", annotation: annotation("release:c", { rating: 4 }) });
  expect((await work).stopped).toBe(true);
  expect(io.publish).not.toHaveBeenCalled();
  expect(io.read).toHaveBeenCalledOnce();
});
it("Stop confirms the admitted row but does not start another", async () => {
  const io = ports(),
    pending = deferred<{ reference: string; annotation: ReturnType<typeof annotation> }>();
  let cancelled = false;
  io.write.mockImplementation(() => pending.promise);
  const work = writeRoonImport(rows, { ...io, cancelled: () => cancelled });
  await Promise.resolve();
  cancelled = true;
  pending.resolve({ reference: "release:c", annotation: annotation("release:c", { rating: 4 }) });
  expect(await work).toEqual({ saved: 1, skipped: 0, stopped: true });
  expect(io.publish).toHaveBeenCalledOnce();
  expect(io.read).toHaveBeenCalledOnce();
});
it("failed or mismatched confirmations stop without retrying or accepting another album", async () => {
  const io = ports();
  io.write.mockRejectedValue(new Error("offline"));
  await expect(writeRoonImport(rows, io)).rejects.toThrow("offline");
  expect(io.write).toHaveBeenCalledOnce();
  expect(io.publish).not.toHaveBeenCalled();
  io.write.mockResolvedValue({ reference: "release:a", annotation: annotation("release:a") });
  await expect(writeRoonImport(rows.slice(0, 1), io)).rejects.toThrow();
  expect(io.publish).not.toHaveBeenCalled();
});
