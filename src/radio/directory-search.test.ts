import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { createDirectorySearch } from "./directory-search";
import type { RadioCriteria } from "./search";
const france: RadioCriteria = { name: "", country: "FR", tag: "", secureOnly: true };
const station = {
  stationuuid: "12345678-1234-1234-1234-123456789012",
  name: "French station",
  country: "France",
  countrycode: "FR",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
it("does not leave another country's stations visible when a newly submitted search fails", async () => {
  await createRoot(async (dispose) => {
    let draft = france;
    const fetch = vi.fn(async (criteria: RadioCriteria) => {
      if (criteria.country === "US") throw Error("provider unavailable");
      return [station];
    });
    const directory = createDirectorySearch(
      () => draft,
      fetch,
      () => {},
      () => {},
    );
    try {
      await directory.search(0, true);
      expect(directory.stations()).toHaveLength(1);
      draft = { ...draft, country: "US" };
      await directory.search(0, true);
      expect(directory.error()).toBe("provider unavailable");
      expect(directory.stations()).toEqual([]);
      expect(directory.loaded()).toBe(false);
      expect(directory.more()).toBe(false);
    } finally {
      dispose();
    }
  });
});
it("does not dispatch provider reads after its view owner has been disposed", async () => {
  let directory!: ReturnType<typeof createDirectorySearch>;
  const fetch = vi.fn(async () => [station]);
  const remember = vi.fn();
  createRoot((dispose) => {
    directory = createDirectorySearch(
      () => france,
      fetch,
      () => {},
      remember,
    );
    dispose();
  });
  await directory.search(0, true);
  expect(fetch).not.toHaveBeenCalled();
  expect(remember).not.toHaveBeenCalled();
});

it("keeps queued submitted criteria and persistence intent instead of later unsubmitted drafts", async () => {
  await createRoot(async (dispose) => {
    let draft = france;
    let finish!: (value: unknown) => void;
    const firstReply = new Promise((resolve) => {
      finish = resolve;
    });
    const fetch = vi
      .fn<(criteria: RadioCriteria, page: number) => Promise<unknown>>()
      .mockImplementationOnce(() => firstReply)
      .mockResolvedValue([]);
    const remember = vi.fn();
    const directory = createDirectorySearch(
      () => draft,
      fetch,
      () => {},
      remember,
    );
    try {
      const first = directory.search(0, true, false);
      draft = { ...draft, country: "US" };
      await directory.search(0, true, false);
      draft = { ...draft, name: "unsubmitted draft" };
      finish([]);
      await first;
      await Promise.resolve();
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1]?.[0]).toEqual({ ...france, country: "US" });
      expect(remember).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});

it("coalesces rapid country submissions and publishes only the latest confirmed page", async () => {
  await createRoot(async (dispose) => {
    let draft = france;
    let finish!: (value: unknown) => void;
    const firstReply = new Promise((resolve) => {
      finish = resolve;
    });
    const fetch = vi
      .fn<(criteria: RadioCriteria, page: number) => Promise<unknown>>()
      .mockImplementationOnce(() => firstReply)
      .mockResolvedValue([
        { ...station, name: "Canadian station", country: "Canada", countrycode: "CA" },
      ]);
    const completed = vi.fn(),
      remember = vi.fn();
    const directory = createDirectorySearch(() => draft, fetch, completed, remember);
    try {
      const first = directory.search(0, true);
      draft = { ...draft, country: "US" };
      await directory.search(0, true);
      draft = { ...draft, country: "CA" };
      await directory.search(0, true);
      expect(directory.stations()).toEqual([]);
      expect(remember.mock.calls.map(([country]) => country)).toEqual(["FR", "US", "CA"]);
      finish([station]);
      await first;
      await Promise.resolve();
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1]?.[0].country).toBe("CA");
      expect(completed).toHaveBeenCalledOnce();
      expect(directory.stations()[0]?.countryCode).toBe("CA");
    } finally {
      dispose();
    }
  });
});

it("retains the current confirmed page if only pagination fails", async () => {
  await createRoot(async (dispose) => {
    const fetch = vi
      .fn<(criteria: RadioCriteria, page: number) => Promise<unknown>>()
      .mockResolvedValueOnce(Array.from({ length: 51 }, () => station))
      .mockRejectedValueOnce(Error("next page unavailable"));
    const directory = createDirectorySearch(
      () => france,
      fetch,
      () => {},
      () => {},
    );
    try {
      await directory.search(0, true);
      directory.setSelected(2);
      await directory.search(50);
      expect(directory.error()).toBe("next page unavailable");
      expect(directory.stations()).toHaveLength(50);
      expect(directory.offset()).toBe(0);
      expect(directory.selected()).toBe(2);
      expect(directory.more()).toBe(true);
    } finally {
      dispose();
    }
  });
});

it("restores a departed view's public result page and selected dial position without a new read", async () => {
  let saved!: ReturnType<ReturnType<typeof createDirectorySearch>["snapshot"]>;
  await createRoot(async (dispose) => {
    const directory = createDirectorySearch(
      () => france,
      async () => [station, { ...station, name: "Second station" }],
      () => {},
      () => {},
    );
    await directory.search(50, true);
    directory.setSelected(1);
    saved = directory.snapshot();
    dispose();
  });
  createRoot((dispose) => {
    const fetch = vi.fn(async () => []);
    const directory = createDirectorySearch(
      () => france,
      fetch,
      () => {},
      () => {},
      saved,
    );
    expect(directory.loaded()).toBe(true);
    expect(directory.offset()).toBe(50);
    expect(directory.selected()).toBe(1);
    expect(directory.stations()[1]?.name).toBe("Second station");
    expect(fetch).not.toHaveBeenCalled();
    dispose();
  });
});
it("retains submitted search criteria independently of unsent drafts on restored pagination", async () => {
  let saved!: ReturnType<ReturnType<typeof createDirectorySearch>["snapshot"]>;
  await createRoot(async (dispose) => {
    const directory = createDirectorySearch(
      () => france,
      async () => [station],
      () => {},
      () => {},
    );
    await directory.search(0, true);
    saved = directory.snapshot();
    dispose();
  });
  await createRoot(async (dispose) => {
    const fetch = vi.fn(async () => []);
    const draft = { ...france, name: "unsent edit" };
    const directory = createDirectorySearch(
      () => draft,
      fetch,
      () => {},
      () => {},
      saved,
    );
    await directory.search(50);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(france, 50);
    dispose();
  });
});
