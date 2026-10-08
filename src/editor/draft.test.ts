import { expect, it, vi } from "vitest";
import { markdownDraft } from "./draft";
it("does not rewrite untouched server Markdown when the editor normalizes it", () => {
  const publish = vi.fn(),
    draft = markdownDraft("__Original__", publish);
  draft.changed("**Original**\n");
  draft.initialized("**Original**\n");
  draft.changed("**Original**\n");
  expect(publish).not.toHaveBeenCalled();
  expect(draft.differs("__Original__")).toBe(false);
  draft.changed("**Edited**\n");
  expect(publish).toHaveBeenCalledWith("**Edited**\n");
  expect(draft.differs("**Edited**\n")).toBe(false);
});
it("replacing a loaded note suppresses editor change callbacks but allows the next user edit", () => {
  const publish = vi.fn(),
    draft = markdownDraft("", publish);
  draft.initialized("");
  draft.replace("_loaded_", () => {
    draft.changed("*loaded*\n");
    return "*loaded*\n";
  });
  expect(publish).not.toHaveBeenCalled();
  expect(draft.differs("_loaded_")).toBe(false);
  draft.changed("*changed*\n");
  expect(publish).toHaveBeenCalledOnce();
});

it("reads the latest editor state on immediate save while retaining untouched source", () => {
  const publish = vi.fn(),
    draft = markdownDraft("__Original__", publish);
  draft.initialized("**Original**\n");
  expect(draft.read("**Original**\n")).toBe("__Original__");
  expect(publish).not.toHaveBeenCalled();
  expect(draft.read("**Latest**\n")).toBe("**Latest**\n");
  expect(publish).toHaveBeenCalledOnce();
});
