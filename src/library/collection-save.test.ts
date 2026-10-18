import { expect, it, vi } from "vitest";
import {
  saveBrowsingCollection,
  deleteSavedCollection,
  createSavedCollection,
} from "./collection-save";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("deletes only the explicitly chosen owner collection and never reports a replacement session's success", async () => {
  vi.mocked(requestAede).mockClear();
  expect(await deleteSavedCollection("Road", "local", () => false)).toBe(false);
  expect(requestAede).not.toHaveBeenCalled();
  let current = true;
  vi.mocked(requestAede).mockImplementationOnce(async () => {
    current = false;
    return null;
  });
  expect(await deleteSavedCollection("Road", "local", () => current)).toBe(false);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { name: "Road" },
    "DELETE",
    null,
    "local",
  );
});
it("explains an outdated server before sending unsupported collection writes", async () => {
  vi.mocked(requestAede).mockResolvedValue({ api_version: 1 });
  await expect(saveBrowsingCollection("Era", "browse-v1:{}", () => true)).rejects.toThrow(
    /redémarr/i,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
});
it("creates a rule only for the same session after capability confirmation", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await saveBrowsingCollection("Era", "browse-v1:{}", () => false);
  expect(requestAede).toHaveBeenCalledTimes(1);
  await saveBrowsingCollection("Era", "browse-v1:{}", () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Era" }, "PUT", {
    expression: "browse-v1:{}",
    create_only: true,
  });
});

it("refuses multi-genre rules on servers supporting only legacy browsing", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await expect(
    saveBrowsingCollection("Styles", 'browse-v1:{"genres":["Metal","Rock"]}', () => true),
  ).rejects.toThrow(/plusieurs genres/);
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_genres"],
  });
  await saveBrowsingCollection("Styles", 'browse-v1:{"genres":["Metal","Rock"]}', () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Styles" }, "PUT", {
    expression: 'browse-v1:{"genres":["Metal","Rock"]}',
    create_only: true,
  });
});

it("refuses personal browse criteria on legacy servers and preserves their rating bounds", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  const expression = 'browse-v1:{"view":"rated","ratings":[2,4]}';
  await expect(saveBrowsingCollection("Rated", expression, () => true)).rejects.toThrow(
    /notes|notés/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_personal"],
  });
  await saveBrowsingCollection("Rated", expression, () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Rated" }, "PUT", {
    expression,
    create_only: true,
  });
});

it("refuses tag rules on legacy servers before any mutation", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  const expression = 'browse-v1:{"view":"tags","tags":["music"]}';
  await expect(saveBrowsingCollection("Tags", expression, () => true)).rejects.toThrow(/tags/);
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_tags"],
  });
  await saveBrowsingCollection("Tags", expression, () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Tags" }, "PUT", {
    expression,
    create_only: true,
  });
});

it("saves label rules on their captured source and refuses unsupported labels before mutation", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  const expression = 'browse-v1:{"view":"label","label":"label:independent"}';
  await expect(saveBrowsingCollection("Label", expression, () => true, "local")).rejects.toThrow(
    /label/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  expect(requestAede).toHaveBeenLastCalledWith("/api/v1/status", {}, "GET", undefined, "local");
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_label"],
  });
  await saveBrowsingCollection("Label", expression, () => true, "local");
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { name: "Label" },
    "PUT",
    { expression, create_only: true },
    "local",
  );
});

it("refuses a colliding new collection without overwriting its existing rule", async () => {
  vi.mocked(requestAede).mockReset();
  let saved = "genre:Jazz";
  vi.mocked(requestAede).mockImplementation(async (_path, _query, _method, body) => {
    const input = body as { expression: string; create_only?: boolean };
    if (input.create_only) throw new Error("Collection already exists");
    saved = input.expression;
    return {};
  });
  await expect(createSavedCollection("Road", "genre:Rock", () => true, "local")).rejects.toThrow(
    "Collection already exists",
  );
  expect(saved).toBe("genre:Jazz");
  vi.mocked(requestAede).mockClear();
  expect(await createSavedCollection("Road", "genre:Rock", () => false, "local")).toBe(false);
  expect(requestAede).not.toHaveBeenCalled();
});

it("refuses track-filter collections on older engines before any write", async () => {
  vi.mocked(requestAede).mockReset();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await expect(
    saveBrowsingCollection("Tracks", 'browse-v1:{"view":"tracks"}', () => true),
  ).rejects.toThrow("filtres de pistes");
  expect(vi.mocked(requestAede).mock.calls.some((call) => call[2] === "PUT")).toBe(false);
});

it("negotiates composer collections before writing and retains exact engine identities", async () => {
  vi.mocked(requestAede).mockClear();
  const expression = 'browse-v1:{"view":"composers","composers":["artist:writer"]}';
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await expect(saveBrowsingCollection("Writers", expression, () => true)).rejects.toThrow(
    /compositeurs/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_composers"],
  });
  await saveBrowsingCollection("Writers", expression, () => true);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { name: "Writers" },
    "PUT",
    { expression, create_only: true },
  );
});
