import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it } from "vitest";
import { createServerRootEditor } from "./server-root-editor";
import type { AccountSession } from "./server";
const first: AccountSession = {
  server: "https://first.example",
  account: { id: "admin", username: "admin", role: "admin" },
};
let dispose: () => void;
afterEach(() => dispose?.());
function setup() {
  return createRoot((end) => {
    dispose = end;
    const [owner, setOwner] = createSignal<AccountSession | undefined>(first);
    const [answer, setAnswer] = createSignal<{ owner: AccountSession; paths: string[] }>({
      owner: first,
      paths: ["/first-server/music"],
    });
    const editor = createServerRootEditor(owner, () =>
      answer().owner === owner() ? answer().paths : undefined,
    );
    return { ...editor, owner, setOwner, setAnswer };
  });
}
it("does not offer a former server's edited paths when replacement discovery is unavailable", () => {
  const editor = setup();
  expect(editor.rows.map((r) => r.path)).toEqual(["/first-server/music"]);
  editor.setRows(0, "path", "/first-server/edited");
  editor.setOwner({ ...first, server: "https://second.example" });
  expect(editor.rows).toHaveLength(0);
});
it("clears former account paths on logout", () => {
  const editor = setup();
  editor.setOwner(undefined);
  expect(editor.rows).toHaveLength(0);
});

it("keeps unsaved edits during an unavailable refresh for the same owner", () => {
  const editor = setup();
  editor.setRows(0, "path", "/first-server/edited");
  editor.setAnswer({ owner: { ...first }, paths: [] });
  expect(editor.rows.map((r) => r.path)).toEqual(["/first-server/edited"]);
});
it("accepts only the replacement owner's confirmed paths after logout and re-login", () => {
  const editor = setup();
  editor.setOwner(undefined);
  const second = { ...first, server: "https://second.example" };
  editor.setOwner(second);
  editor.setAnswer({ owner: first, paths: ["/late/old"] });
  expect(editor.rows).toHaveLength(0);
  editor.setAnswer({ owner: second, paths: ["/second/music"] });
  expect(editor.rows.map((r) => r.path)).toEqual(["/second/music"]);
});
it("replaces the editable list when a confirmed refresh reports no watched roots", () => {
  const editor = setup();
  editor.setAnswer({ owner: first, paths: [] });
  expect(editor.rows).toHaveLength(0);
});
