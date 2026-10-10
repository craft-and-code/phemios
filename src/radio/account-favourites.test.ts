import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createAccountRadioFavourites } from "./account-favourites";
it("requires a current account only for favourites and discards an old owner's delayed response", async () => {
  let owner!: (value: string | undefined) => void,
    finish!: (value: unknown) => void,
    dispose!: () => void;
  let favourites!: ReturnType<typeof createAccountRadioFavourites>;
  const request = vi.fn(() => new Promise((resolve) => (finish = resolve)));
  createRoot((end) => {
    dispose = end;
    const [current, set] = createSignal<string>();
    owner = set;
    favourites = createAccountRadioFavourites(current, request);
  });
  await Promise.resolve();
  expect(request).not.toHaveBeenCalled();
  expect(favourites.stations()).toEqual([]);
  owner("one");
  expect(request).toHaveBeenCalledOnce();
  owner(undefined);
  finish({ values: {} });
  await Promise.resolve();
  await Promise.resolve();
  expect(favourites.stations()).toEqual([]);
  expect(favourites.available()).toBe(false);
  dispose();
});
it("stores favourites in the authenticated preferences and never stores stream tokens", async () => {
  let dispose!: () => void, favourites!: ReturnType<typeof createAccountRadioFavourites>;
  const request = vi.fn(async (_owner, method, value) =>
    method === "GET" ? { values: {} } : value,
  );
  createRoot((end) => {
    dispose = end;
    favourites = createAccountRadioFavourites(() => "one", request);
  });
  await Promise.resolve();
  await Promise.resolve();
  await favourites.toggle({
    uuid: "12345678-1234-1234-1234-123456789012",
    name: "Station",
    country: "France",
    tags: "",
    codec: "MP3",
    bitrate: 128,
  });
  expect(favourites.stations()).toHaveLength(1);
  expect(request.mock.calls[1]?.[1]).toBe("PATCH");
  expect(JSON.stringify(request.mock.calls[1])).not.toContain("token");
  dispose();
});
