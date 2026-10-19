import { expect, it, vi } from "vitest";
import { albumLabelReferences, albumLabels } from "./album-metadata";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("retains the exact edition label associations, including no known label", () => {
  expect(
    albumLabelReferences(
      { reference: "release:fixture", labels: ["label:one", "label:two"] },
      "release:fixture",
    ),
  ).toEqual(["label:one", "label:two"]);
  expect(
    albumLabelReferences({ reference: "release:fixture", labels: [] }, "release:fixture"),
  ).toEqual([]);
});
it("refuses malformed, duplicate, excessive or cross-source label associations", () => {
  for (const raw of [
    null,
    {},
    { reference: "release:other", labels: [] },
    { reference: "release:fixture", labels: ["artist:one"] },
    { reference: "release:fixture", labels: ["label:one", "label:one"] },
    { reference: "release:fixture", labels: ["label:@phemios/local/one"] },
    { reference: "release:fixture", labels: Array.from({ length: 65 }, (_, i) => `label:${i}`) },
  ])
    expect(() => albumLabelReferences(raw, "release:fixture")).toThrow();
});
it("resolves exact label display names and refuses labels detached from the edition", async () => {
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ reference: "release:fixture", labels: ["label:one"] })
    .mockResolvedValueOnce({
      reference: "label:one",
      name: "Fixture Studio",
      releases: ["release:fixture"],
    });
  expect(await albumLabels("release:fixture")).toEqual([
    { reference: "label:one", name: "Fixture Studio" },
  ]);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/v1/label",
    { ref: "label:one" },
    "GET",
    null,
    "server",
    undefined,
  );
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ reference: "release:fixture", labels: ["label:one"] })
    .mockResolvedValueOnce({
      reference: "label:one",
      name: "Fixture Studio",
      releases: ["release:other"],
    });
  await expect(albumLabels("release:fixture")).rejects.toThrow();
});

it("does not continue label resolution after the captured detail is retired", async () => {
  let current = true;
  const owner = {
    server: "https://music.example",
    account: { id: "one", username: "one", role: "user" },
  };
  vi.mocked(requestAede).mockReset();
  vi.mocked(requestAede).mockImplementation(async () => {
    current = false;
    return { reference: "release:fixture", labels: ["label:one"] };
  });
  await expect(albumLabels("release:fixture", { owner, current: () => current })).resolves.toEqual(
    [],
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
});

it("stops between labels and binds every submitted read to the captured owner", async () => {
  let current = true;
  const owner = {
    server: "https://music.example",
    account: { id: "one", username: "one", role: "user" },
  };
  vi.mocked(requestAede).mockReset();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ reference: "release:fixture", labels: ["label:one", "label:two"] })
    .mockImplementationOnce(async () => {
      current = false;
      return { reference: "label:one", name: "One", releases: ["release:fixture"] };
    });
  expect(await albumLabels("release:fixture", { owner, current: () => current })).toEqual([]);
  expect(requestAede).toHaveBeenCalledTimes(2);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/v1/label",
    { ref: "label:one" },
    "GET",
    null,
    "server",
    owner,
  );
});
