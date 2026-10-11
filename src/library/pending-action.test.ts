import { createRoot } from "solid-js";
import { expect, it } from "vitest";
import { createPendingAction } from "./pending-action";
it("identifies import independently from export and refuses a concurrent dialog", async () => {
  const state = createRoot(() => createPendingAction<"import" | "export">());
  let finish!: () => void;
  const imported = state.run(
    "import",
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
  );
  expect(state.pending()).toBe("import");
  let duplicate = false;
  await state.run("export", async () => {
    duplicate = true;
  });
  expect(duplicate).toBe(false);
  expect(state.pending()).toBe("import");
  finish();
  await imported;
  expect(state.pending()).toBeUndefined();
  const exported = state.run("export", async () => {
    expect(state.pending()).toBe("export");
  });
  await exported;
  expect(state.pending()).toBeUndefined();
});
it("releases the active action after failure or a cancelled dialog", async () => {
  const state = createRoot(() => createPendingAction<"import" | "export">());
  await expect(
    state.run("import", async () => {
      throw new Error("Unreadable file");
    }),
  ).rejects.toThrow("Unreadable");
  expect(state.pending()).toBeUndefined();
  expect(await state.run("export", async () => null)).toBeNull();
  expect(state.pending()).toBeUndefined();
});
