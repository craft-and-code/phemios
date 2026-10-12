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
  const first = deferred<unknown>();
  const request = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue({ reference: saved.reference, annotation: saved });
  const publish = vi.fn(),
    pending = vi.fn();
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => true,
    request,
    publish,
    pending,
  });
  const star = writer.write({ rating: 4 });
  const heart = writer.write({ loved: true });
  const clear = writer.write({ rating: null });
  await Promise.resolve();
  expect(request).toHaveBeenCalledExactlyOnceWith({ rating: 4 });
  expect(pending).toHaveBeenLastCalledWith(3);
  first.resolve({ reference: saved.reference, annotation: saved });
  await Promise.all([star, heart, clear]);
  expect(request.mock.calls).toEqual([[{ rating: 4 }], [{ loved: true }], [{ rating: null }]]);
  expect(publish).toHaveBeenCalledTimes(3);
  expect(pending).toHaveBeenLastCalledWith(0);
});
it("saves notes and tags without overwriting rating or favourite", async () => {
  const request = vi.fn().mockResolvedValue({ reference: saved.reference, annotation: saved });
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => true,
    request,
    publish: vi.fn(),
    pending: vi.fn(),
  });
  await writer.write({ note: "**Draft**", tags: ["draft"] });
  expect(request).toHaveBeenCalledExactlyOnceWith({ note: "**Draft**", tags: ["draft"] });
});
it("does not retry failed writes and allows a later explicit change", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ reference: saved.reference, annotation: null });
  const publish = vi.fn();
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => true,
    request,
    publish,
    pending: vi.fn(),
  });
  await expect(writer.write({ loved: true })).rejects.toThrow("Offline");
  expect(publish).not.toHaveBeenCalled();
  await expect(writer.write({ loved: false })).resolves.toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledExactlyOnceWith(null);
});
it("does not send queued writes or publish late responses after the session changes", async () => {
  const first = deferred<unknown>();
  let active = true;
  const request = vi.fn().mockReturnValue(first.promise),
    publish = vi.fn();
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => active,
    request,
    publish,
    pending: vi.fn(),
  });
  const star = writer.write({ rating: 4 }),
    heart = writer.write({ loved: true });
  await Promise.resolve();
  active = false;
  first.resolve({ reference: saved.reference, annotation: saved });
  await Promise.all([star, heart]);
  expect(request).toHaveBeenCalledOnce();
  expect(publish).not.toHaveBeenCalled();
});

it("refuses invalid response targets including null without publishing or discarding the notes draft", async () => {
  const patch = { note: "**Retained draft**", tags: ["draft tag"] };
  const request = vi.fn();
  let confirmed: Annotation | null = saved;
  const publish = vi.fn((annotation: Annotation | null) => {
    confirmed = annotation;
  });
  const pending = vi.fn();
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => true,
    request,
    publish,
    pending,
  });
  for (const raw of [
    { reference: "artist:other", annotation: null },
    { annotation: null },
    { reference: 7, annotation: null },
    { reference: "unknown:fixture", annotation: null },
    { reference: "artist:other", annotation: saved },
    { reference: saved.reference, annotation: { ...saved, reference: "artist:other" } },
    { reference: saved.reference },
  ]) {
    request.mockResolvedValueOnce(raw);
    await expect(writer.write(patch)).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
    expect(confirmed).toBe(saved);
    expect(patch).toEqual({ note: "**Retained draft**", tags: ["draft tag"] });
    expect(pending).toHaveBeenLastCalledWith(0);
  }
  expect(request).toHaveBeenCalledTimes(7);
  request.mockResolvedValueOnce({ reference: saved.reference, annotation: null });
  await expect(writer.write({ note: null, tags: [] })).resolves.toBeNull();
  expect(publish).toHaveBeenCalledExactlyOnceWith(null);
  expect(confirmed).toBeNull();
});
it("discards an invalid late write response before parsing when the captured owner is inactive", async () => {
  const response = deferred<unknown>();
  let active = true;
  const publish = vi.fn();
  const writer = annotationWriter({
    reference: saved.reference,
    active: () => active,
    request: () => response.promise,
    publish,
    pending: vi.fn(),
  });
  const write = writer.write({ loved: true });
  await Promise.resolve();
  active = false;
  response.resolve({ reference: "artist:other", annotation: null });
  await expect(write).resolves.toBeUndefined();
  expect(publish).not.toHaveBeenCalled();
});
