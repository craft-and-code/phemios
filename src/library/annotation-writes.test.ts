import { expect, it, vi } from "vitest";
import { annotationWriter } from "./annotation-writes";
import type { Annotation } from "./server";
const saved: Annotation = {
  reference: "artist:sample",
  loved: true,
  rating: 4,
  note: "__Saved note__",
  tags: ["saved"],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("serializes rapid icon changes and sends only the activated field", async () => {
  const first = deferred<Annotation | null>();
  const request = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(saved);
  const publish = vi.fn(),
    pending = vi.fn();
  const writer = annotationWriter({ active: () => true, request, publish, pending });
  const star = writer.write({ rating: 4 });
  const heart = writer.write({ loved: true });
  const clear = writer.write({ rating: null });
  await Promise.resolve();
  expect(request).toHaveBeenCalledExactlyOnceWith({ rating: 4 });
  expect(pending).toHaveBeenLastCalledWith(3);
  first.resolve(saved);
  await Promise.all([star, heart, clear]);
  expect(request.mock.calls).toEqual([[{ rating: 4 }], [{ loved: true }], [{ rating: null }]]);
  expect(publish).toHaveBeenCalledTimes(3);
  expect(pending).toHaveBeenLastCalledWith(0);
});
it("saves notes and tags without overwriting rating or favourite", async () => {
  const request = vi.fn().mockResolvedValue(saved);
  const writer = annotationWriter({
    active: () => true,
    request,
    publish: vi.fn(),
    pending: vi.fn(),
  });
  await writer.write({ note: "**Draft**", tags: ["draft"] });
  expect(request).toHaveBeenCalledExactlyOnceWith({ note: "**Draft**", tags: ["draft"] });
});
it("does not retry failed writes and allows a later explicit change", async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(null);
  const publish = vi.fn();
  const writer = annotationWriter({ active: () => true, request, publish, pending: vi.fn() });
  await expect(writer.write({ loved: true })).rejects.toThrow("Offline");
  expect(publish).not.toHaveBeenCalled();
  await expect(writer.write({ loved: false })).resolves.toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledExactlyOnceWith(null);
});
it("does not send queued writes or publish late responses after the session changes", async () => {
  const first = deferred<Annotation | null>();
  let active = true;
  const request = vi.fn().mockReturnValue(first.promise),
    publish = vi.fn();
  const writer = annotationWriter({ active: () => active, request, publish, pending: vi.fn() });
  const star = writer.write({ rating: 4 }),
    heart = writer.write({ loved: true });
  await Promise.resolve();
  active = false;
  first.resolve(saved);
  await Promise.all([star, heart]);
  expect(request).toHaveBeenCalledOnce();
  expect(publish).not.toHaveBeenCalled();
});
