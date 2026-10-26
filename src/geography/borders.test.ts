import { afterEach, expect, it, vi } from "vitest";
import { readCountryBorders } from "./borders";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("loads bundled geometry relative to the deployed project rather than the domain root", async () => {
  vi.stubEnv("BASE_URL", "/phemios/demo/");
  const fetcher = vi.fn().mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetcher);
  expect(await readCountryBorders()).toEqual([]);
  expect(fetcher).toHaveBeenCalledWith("/phemios/demo/geography/countries.json");
});
it("retains the existing native root and reports a refused geometry response", async () => {
  vi.stubEnv("BASE_URL", "/");
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(readCountryBorders()).rejects.toThrow("Frontières");
  expect(fetcher).toHaveBeenCalledWith("/geography/countries.json");
});
