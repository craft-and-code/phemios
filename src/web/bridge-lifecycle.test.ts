import { afterEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ stop: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./player", () => ({
  WebPlayer: class {
    stop = actions.stop;
  },
}));
vi.mock("./session", () => ({
  WebSession: class {
    logout = actions.logout;
  },
}));
afterEach(() => vi.unstubAllGlobals());
it("retires the old session on leaving and starts a fresh frontend when restored from the back-forward cache", async () => {
  const target = new EventTarget(),
    reload = vi.fn();
  vi.stubGlobal("window", target);
  vi.stubGlobal("location", { origin: "https://music.example", reload });
  await import("./bridge");
  target.dispatchEvent(new Event("pagehide"));
  expect(actions.stop).toHaveBeenCalledOnce();
  expect(actions.logout).toHaveBeenCalledOnce();
  target.dispatchEvent(new Event("pageshow"));
  expect(reload).not.toHaveBeenCalled();
  const restored = new Event("pageshow");
  Object.defineProperty(restored, "persisted", { value: true });
  target.dispatchEvent(restored);
  expect(reload).toHaveBeenCalledOnce();
});
