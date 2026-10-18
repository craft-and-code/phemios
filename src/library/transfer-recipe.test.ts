import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createTransferRecipe } from "./transfer-recipe";
import type { PlayerVolume } from "./players";
const folder: PlayerVolume = {
  id: "mount:1",
  name: "Exports",
  path: "/output",
  kind: "folder",
  format: "",
  adapter: "mounted",
};
const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
it("resets the recipe after deselection and loss of the selected destination, retaining it during refresh", async () => {
  const state = createRoot((dispose) => {
    const [volumes, setVolumes] = createSignal<readonly PlayerVolume[]>([folder]);
    const [pending, setPending] = createSignal(false);
    return { dispose, setVolumes, setPending, recipe: createTransferRecipe(volumes, pending) };
  });
  try {
    await tick();
    state.recipe.select("mount:1");
    state.recipe.setOptions({ format: "mp3", verify: false, replace: true });
    await tick();
    state.setPending(true);
    state.setVolumes([]);
    await tick();
    expect(state.recipe.options().format).toBe("mp3");
    state.setPending(false);
    await tick();
    expect(state.recipe.selected()).toBe("");
    expect(state.recipe.options()).toEqual({ format: "original", verify: true, replace: false });
    state.setVolumes([folder]);
    state.recipe.select("mount:1");
    state.recipe.setOptions({ format: "aac", verify: false, replace: true });
    state.recipe.select("");
    await tick();
    expect(state.recipe.options()).toEqual({ format: "original", verify: true, replace: false });
  } finally {
    state.dispose();
  }
});
it("keeps adapter restrictions when switching between iPod, MTP and a folder", async () => {
  const state = createRoot((dispose) => ({
    dispose,
    recipe: createTransferRecipe(
      () => [
        folder,
        { ...folder, id: "mount:2", adapter: "ipod" },
        { ...folder, id: "mtp:3", adapter: "mtp" },
      ],
      () => false,
    ),
  }));
  try {
    await tick();
    state.recipe.select("mount:1");
    state.recipe.setOptions({ format: "mp3", verify: true, replace: true });
    state.recipe.select("mtp:3");
    expect(state.recipe.options()).toEqual({ format: "mp3", verify: true, replace: false });
    state.recipe.select("mount:2");
    expect(state.recipe.options()).toEqual({ format: "original", verify: false, replace: false });
  } finally {
    state.dispose();
  }
});
