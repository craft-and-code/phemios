import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { createPreferenceTransfer } from "./preference-transfer";
function setup() {
  let identity = {};
  const apply = vi.fn(),
    parse = vi.fn(() => ({ private: "Alice preferences" }));
  let finish!: (raw: string | null) => void;
  const imported = new Promise<string | null>((resolve) => {
    finish = resolve;
  });
  const transfer = createRoot(() =>
    createPreferenceTransfer({
      identity: () => identity,
      read: () => "Alice preferences",
      export: async () => "/fictional/alice.json",
      import: () => imported,
      parse,
      apply,
    }),
  );
  return {
    transfer,
    apply,
    parse,
    finish,
    replace: () => {
      identity = {};
      transfer.changed();
    },
  };
}
it("cannot show or apply an old native import after Alice becomes Bob or returns as a new session", async () => {
  const view = setup(),
    request = view.transfer.run(false);
  view.replace();
  view.replace();
  view.finish("Alice preferences");
  await request;
  expect(view.parse).not.toHaveBeenCalled();
  expect(view.transfer.pending()).toBeUndefined();
  view.transfer.apply();
  expect(view.apply).not.toHaveBeenCalled();
  view.transfer.dispose();
});
it("clears a reviewed import on owner replacement and prevents late export/error feedback", async () => {
  const view = setup(),
    request = view.transfer.run(false);
  view.finish("Alice preferences");
  await request;
  expect(view.transfer.pending()).toEqual({ private: "Alice preferences" });
  view.replace();
  view.transfer.apply();
  expect(view.apply).not.toHaveBeenCalled();
  const exported = view.transfer.run(true);
  view.replace();
  await exported;
  expect(view.transfer.message()).toBe("");
  view.transfer.dispose();
});
it("imports only on explicit approval and ignores a result after disposal", async () => {
  const view = setup(),
    request = view.transfer.run(false);
  view.finish("Alice preferences");
  await request;
  expect(view.apply).not.toHaveBeenCalled();
  view.transfer.apply();
  expect(view.apply).toHaveBeenCalledExactlyOnceWith({ private: "Alice preferences" });
  view.transfer.dispose();
  const closed = setup(),
    later = closed.transfer.run(false);
  closed.transfer.dispose();
  closed.finish("Alice preferences");
  await later;
  expect(closed.parse).not.toHaveBeenCalled();
  expect(closed.apply).not.toHaveBeenCalled();
});

it("does not publish a private backup fetched after its requesting owner has changed", async () => {
  let identity = {},
    finish!: (value: string) => void;
  const read = new Promise<string>((resolve) => {
      finish = resolve;
    }),
    exported = vi.fn(async () => "/fictional/private.json");
  const transfer = createRoot(() =>
    createPreferenceTransfer({
      identity: () => identity,
      read: () => read,
      export: exported,
      import: async () => null,
      parse: () => ({}),
      apply: () => {},
    }),
  );
  const operation = transfer.run(true);
  identity = {};
  transfer.changed();
  finish("Alice private podcast/article backup");
  await operation;
  expect(exported).not.toHaveBeenCalled();
  transfer.dispose();
});
it("keeps asynchronous restore pending and does not acknowledge it to a replacement owner", async () => {
  let identity = {},
    finish!: () => void;
  const restored = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const transfer = createRoot(() =>
    createPreferenceTransfer({
      identity: () => identity,
      read: () => "",
      export: async () => null,
      import: async () => "backup",
      parse: () => ({}),
      apply: () => restored,
    }),
  );
  await transfer.run(false);
  const operation = transfer.apply();
  expect(transfer.action()).toBe("restore");
  expect(transfer.pending()).toEqual({});
  identity = {};
  transfer.changed();
  finish();
  await operation;
  expect(transfer.message()).toBe("");
  expect(transfer.pending()).toBeUndefined();
  transfer.dispose();
});
