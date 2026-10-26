import { afterEach, expect, it, vi } from "vitest";
import { assertPersonalWeb, publicWebDemo, webMode } from "./runtime";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("a public demo ignores a saved personal mode and refuses personal-session admission", () => {
  vi.stubEnv("VITE_PHEMIOS_PUBLIC_DEMO", "true");
  const read = vi.fn(() => "personal");
  vi.stubGlobal("localStorage", { getItem: read });
  expect(publicWebDemo()).toBe(true);
  expect(webMode()).toBe("demo");
  expect(read).not.toHaveBeenCalled();
  expect(assertPersonalWeb).toThrow("publique");
});
it("the self-hosted build retains its explicit personal-mode choice", () => {
  vi.stubEnv("VITE_PHEMIOS_PUBLIC_DEMO", "false");
  vi.stubGlobal("localStorage", { getItem: () => "personal" });
  expect(webMode()).toBe("personal");
  expect(assertPersonalWeb).not.toThrow();
});
