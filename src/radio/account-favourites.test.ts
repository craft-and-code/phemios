import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createAccountRadioFavourites, radioFavouriteOwner } from "./account-favourites";
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
it("refuses a malformed stored value rather than replacing it with an empty favourite list", async () => {
  let dispose!: () => void, favourites!: ReturnType<typeof createAccountRadioFavourites>;
  const request = vi.fn(async () => ({ values: { "phemios.radio-favourites": false } }));
  createRoot((end) => {
    dispose = end;
    favourites = createAccountRadioFavourites(() => "one", request);
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(favourites.available()).toBe(false);
  expect(favourites.error()).not.toBe("");
  dispose();
});

it("uses source authority and stable account ID instead of a reusable login name", () => {
  const first = {
    server: "https://radio-library.example",
    account: { id: "account-one", username: "listener", role: "user" },
  };
  const renamed = { ...first, account: { ...first.account, username: "renamed" } };
  const recreated = { ...first, account: { ...first.account, id: "account-two" } };
  expect(radioFavouriteOwner("server", first)).toBe(radioFavouriteOwner("server", renamed));
  expect(radioFavouriteOwner("server", first)).not.toBe(radioFavouriteOwner("server", recreated));
  expect(radioFavouriteOwner("local", first)).not.toBe(radioFavouriteOwner("server", first));
  expect(radioFavouriteOwner("server", { ...first, server: "https://other.example" })).not.toBe(
    radioFavouriteOwner("server", first),
  );
  expect(radioFavouriteOwner("server", undefined)).toBeUndefined();
});
it("retains favourites for a renamed account and clears them before reading a recreated same-name account", async () => {
  await createRoot(async (dispose) => {
    const original = {
      server: "https://radio-library.example",
      account: { id: "account-one", username: "listener", role: "user" },
    };
    const [session, setSession] = createSignal(original);
    const station = {
      uuid: "12345678-1234-1234-1234-123456789012",
      name: "Private favourite choice",
      country: "France",
      tags: "",
      codec: "MP3",
      bitrate: 128,
    };
    let finish!: (value: unknown) => void;
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        values: { "phemios.radio-favourites": { version: 1, stations: [station] } },
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const favourites = createAccountRadioFavourites(
      () => radioFavouriteOwner("server", session()),
      request,
    );
    try {
      for (let step = 0; step < 4; step++) await Promise.resolve();
      expect(favourites.stations()).toEqual([station]);
      setSession({ ...original, account: { ...original.account, username: "renamed" } });
      expect(request).toHaveBeenCalledOnce();
      expect(favourites.stations()).toEqual([station]);
      setSession({
        ...original,
        account: { ...original.account, id: "account-two", username: "renamed" },
      });
      expect(request).toHaveBeenCalledTimes(2);
      expect(favourites.stations()).toEqual([]);
      expect(favourites.available()).toBe(false);
      finish({ values: {} });
      for (let step = 0; step < 4; step++) await Promise.resolve();
      expect(favourites.available()).toBe(true);
      expect(favourites.stations()).toEqual([]);
    } finally {
      dispose();
    }
  });
});
