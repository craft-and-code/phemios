import { expect, it, vi } from "vitest";
import { searchQueue, type QueueSearchScope } from "./queue-search";
const owner = {
  server: "http://fixture.invalid",
  account: { id: "owner", username: "example", role: "user" },
};
const scope: QueueSearchScope = {
  category: "albums",
  query: "été",
  offset: 0,
  owners: [{ source: "server", session: owner }],
  albums: [
    {
      reference: "release:one",
      title: "Un été",
      artist: null,
      year: 2000,
      compilation: false,
      tags: [],
    },
  ],
  artists: [],
};
it("searches cached albums accent-insensitively without requests, including retained disconnected sources", async () => {
  const request = vi.fn();
  const page = await searchQueue(scope, request, () => true);
  expect(page.items.map((r) => r.reference)).toEqual(["release:one"]);
  expect(request).not.toHaveBeenCalled();
  expect(
    (await searchQueue({ ...scope, owners: [] }, request, () => true)).items.map(
      (row) => row.reference,
    ),
  ).toEqual(["release:one"]);
});
it("keeps incomplete source failures visible instead of reporting an empty successful result", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Unavailable"));
  const page = await searchQueue({ ...scope, category: "tracks" }, request, () => true);
  expect(page.errors).toEqual(["Serveur · Unavailable"]);
  expect(page.items).toEqual([]);
});
it("drops delayed private results when their captured scope is retired", async () => {
  let current = true;
  const request = vi.fn(async () => {
    current = false;
    return { items: [{ name: "Private", expression: "*" }], total: 1, offset: 0 };
  });
  const page = await searchQueue(
    { ...scope, query: "", category: "collections" },
    request,
    () => current,
  );
  expect(page.items).toEqual([]);
  expect(page.errors).toEqual([]);
});
it("searches both watched files and private M3U exports with exact source and owner", async () => {
  const request = vi.fn(async (path: string) => ({
    items: [
      {
        id: (path.endsWith("m3u-files") ? "m3u-file-" : "playlist-") + "a".repeat(64),
        name: "Example",
        path: "/music/list.m3u",
        track_count: path.endsWith("m3u-files") ? null : 1,
      },
    ],
    total: 1,
    offset: 0,
    unavailable_roots: 0,
    unreadable_directories: 0,
  }));
  const page = await searchQueue(
    { ...scope, category: "m3u", query: "Example" },
    request,
    () => true,
  );
  expect(page.errors).toEqual([]);
  expect(page.items.map((i) => i.playlist?.kind)).toEqual(["files", "exports"]);
  expect(request.mock.calls[0]?.[0]).toBe("/api/me/v1/m3u-files");
});
it("keeps private M3U exports searchable when watched-file inventory is unavailable", async () => {
  const request = vi.fn(async (path: string) => {
    if (path.endsWith("m3u-files")) throw Error("Inventory unavailable");
    return {
      items: [
        {
          id: "playlist-" + "b".repeat(64),
          name: "Wanted",
          path: "/exports/wanted.m3u",
          track_count: 1,
        },
      ],
      total: 1,
      offset: 0,
    };
  });
  const page = await searchQueue(
    { ...scope, category: "m3u", query: "Wanted" },
    request,
    () => true,
  );
  expect(page.items.map((row) => row.title)).toEqual(["Wanted"]);
  expect(page.errors).toEqual(["Serveur · Inventory unavailable"]);
});
it("keeps cached album pagination complete and principal-artist searches distinct from contributors", async () => {
  const request = vi.fn(),
    albums = Array.from({ length: 101 }, (_, index) => ({
      ...scope.albums[0]!,
      reference: `release:${index}`,
      title: `Album ${String(index).padStart(3, "0")}`,
      artist: "artist:principal",
    }));
  const artists = [
    {
      reference: "artist:principal",
      name: "Été",
      genre: "",
      country: null,
      biography: "",
      artwork: false,
    },
    {
      reference: "artist:contributor",
      name: "Été Guest",
      genre: "",
      country: null,
      biography: "",
      artwork: false,
    },
  ];
  const seen = [];
  for (const offset of [0, 50, 100]) {
    const page = await searchQueue(
      { ...scope, albums, artists, query: "ete", offset },
      request,
      () => true,
    );
    expect(page.more).toBe(offset < 100);
    seen.push(...page.items.map((row) => row.reference));
  }
  expect(new Set(seen).size).toBe(101);
  const page = await searchQueue(
    { ...scope, albums, artists, query: "ete", category: "artists" },
    request,
    () => true,
  );
  expect(page.items.map((row) => row.reference)).toEqual(["artist:principal"]);
  expect(request).not.toHaveBeenCalled();
});
it("searches exact track windows and owner scope without changing query punctuation", async () => {
  const request = vi.fn(async () => ({
    items: [],
    offset: 50,
    limit: 50,
    total: 50,
    scanned_at: 1,
  }));
  const page = await searchQueue(
    { ...scope, category: "tracks", query: "  A/B & É  ", offset: 50 },
    request,
    () => true,
  );
  expect(page.errors).toEqual([]);
  expect(page.more).toBe(false);
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/api/v1/presentation/tracks",
    { offset: "50", limit: "50", q: "A/B & É" },
    "server",
    owner,
  );
});

it.each(["local", "server"] as const)(
  "finds the numeric album title 13 in the connected %s catalogue without HTTP or a year conversion",
  async (source) => {
    const request = vi.fn();
    const reference = `release:@phemios/${source}/numeric`;
    const page = await searchQueue(
      {
        ...scope,
        owners: [{ source, session: owner }],
        query: " 13 ",
        albums: [{ ...scope.albums[0]!, reference, title: "13", year: 2012 }],
      },
      request,
      () => true,
    );
    expect(page.errors).toEqual([]);
    expect(page.items.map((row) => [row.title, row.reference])).toEqual([["13", reference]]);
    expect(request).not.toHaveBeenCalled();
  },
);

it("retains a numeric remote album when only the local account is connected, without reading remote private data", async () => {
  const request = vi.fn();
  const page = await searchQueue(
    {
      ...scope,
      query: "13",
      owners: [{ source: "local", session: owner }],
      albums: [{ ...scope.albums[0]!, reference: "release:@phemios/server/numeric", title: "13" }],
    },
    request,
    () => true,
  );
  expect(page.items.map((row) => [row.title, row.source])).toEqual([["13", "server"]]);
  expect(request).not.toHaveBeenCalled();
  for (const category of ["collections", "m3u", "tracks"] as const) {
    const privatePage = await searchQueue({ ...scope, owners: [], category }, request, () => true);
    expect(privatePage.items).toEqual([]);
  }
  expect(request).not.toHaveBeenCalled();
});

it("searches disconnected public principal artists without exposing contributor-only or private results", async () => {
  const request = vi.fn();
  const artist = {
    reference: "artist:principal",
    name: "Nocturne",
    genre: "",
    country: null,
    biography: "",
    artwork: false,
  };
  const page = await searchQueue(
    {
      ...scope,
      category: "artists",
      query: "Nocturne",
      owners: [],
      albums: [{ ...scope.albums[0]!, artist: artist.reference }],
      artists: [artist, { ...artist, reference: "artist:guest", name: "Nocturne Guest" }],
    },
    request,
    () => true,
  );
  expect(page.items.map((row) => row.reference)).toEqual(["artist:principal"]);
  expect(request).not.toHaveBeenCalled();
});

it("does not match short numeric text solely inside a technical MusicBrainz identifier, but accepts the full identifier", async () => {
  const id = "11111111-2222-4333-8444-b13900000000";
  const artist = {
    reference: "artist:example",
    name: "Example Artist",
    genre: "",
    country: null,
    biography: "",
    artwork: false,
    searchFields: ["Example Artist", id],
  };
  const input = {
    ...scope,
    category: "artists" as const,
    owners: [],
    albums: [{ ...scope.albums[0]!, artist: artist.reference }],
    artists: [artist],
  };
  const request = vi.fn();
  expect((await searchQueue({ ...input, query: "13" }, request, () => true)).items).toEqual([]);
  expect(
    (await searchQueue({ ...input, query: id.toUpperCase() }, request, () => true)).items.map(
      (row) => row.reference,
    ),
  ).toEqual([artist.reference]);
  expect(
    (await searchQueue({ ...input, query: "example" }, request, () => true)).items,
  ).toHaveLength(1);
});
it("keeps numeric text in actual artist names, aliases and annotations searchable", async () => {
  const artist = {
    reference: "artist:example",
    name: "13 Stories",
    genre: "",
    country: null,
    biography: "",
    artwork: false,
    searchFields: ["Live since 2013"],
  };
  const input = {
    ...scope,
    category: "artists" as const,
    query: "13",
    owners: [],
    albums: [{ ...scope.albums[0]!, artist: artist.reference }],
    artists: [artist],
  };
  expect((await searchQueue(input, vi.fn(), () => true)).items).toHaveLength(1);
  expect(
    (
      await searchQueue(
        { ...input, artists: [{ ...artist, name: "Stories" }] },
        vi.fn(),
        () => true,
      )
    ).items,
  ).toHaveLength(1);
});
it("combines all categories with exact title matches first and retains account-bound reads", async () => {
  const request = vi.fn(async (path: string) => {
    if (path.endsWith("tracks"))
      return {
        items: [
          {
            reference: "track:one",
            title: "Track 13",
            release: "release:numeric",
            album_title: "13",
            disc_no: 1,
            track_no: 1,
            album_position: 1,
            duration_ms: 1000,
            analysis_available: false,
            spectrum_available: false,
          },
        ],
        total: 1,
        offset: 0,
        limit: 50,
        scanned_at: 1,
      };
    if (path.endsWith("collections"))
      return { items: [{ name: "13 Mix", expression: "*" }], total: 1, offset: 0 };
    return {
      items: [
        {
          id: (path.endsWith("m3u-files") ? "m3u-file-" : "playlist-") + "a".repeat(64),
          name: "13 Set",
          path: "/music/list.m3u",
          track_count: path.endsWith("m3u-files") ? null : 1,
        },
      ],
      total: 1,
      offset: 0,
      unavailable_roots: 0,
      unreadable_directories: 0,
    };
  });
  const page = await searchQueue(
    {
      ...scope,
      category: "all",
      query: "13",
      albums: [{ ...scope.albums[0]!, reference: "release:numeric", title: "13" }],
    },
    request,
    () => true,
  );
  expect(page.errors).toEqual([]);
  expect(page.items[0]).toMatchObject({ reference: "release:numeric", category: "albums" });
  expect(new Set(page.items.map((row) => row.category))).toEqual(
    new Set(["tracks", "albums", "m3u", "collections"]),
  );
  expect(request).toHaveBeenCalledTimes(4);
  for (const call of request.mock.calls)
    expect(call).toEqual([expect.any(String), expect.any(Object), "server", owner]);
});
it("searches all cached public categories without a session and retires a canceled combined result", async () => {
  const request = vi.fn();
  const page = await searchQueue({ ...scope, category: "all", owners: [] }, request, () => true);
  expect(page.items.map((row) => row.reference)).toEqual(["release:one"]);
  expect(request).not.toHaveBeenCalled();
  const canceled = await searchQueue(
    { ...scope, category: "all", owners: [] },
    request,
    () => false,
  );
  expect(canceled).toEqual({ items: [], more: false, errors: [] });
});

it("keeps combined cached pagination and partial service failures explicit", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Unavailable"));
  const albums = Array.from({ length: 101 }, (_, i) => ({
    ...scope.albums[0]!,
    reference: `release:${i}`,
    title: `13 - ${String(i).padStart(3, "0")}`,
  }));
  const offline = await searchQueue(
    { ...scope, query: "13", category: "all", owners: [], albums, offset: 50 },
    request,
    () => true,
  );
  expect(offline.items).toHaveLength(50);
  expect(offline.more).toBe(true);
  expect(request).not.toHaveBeenCalled();
  const partial = await searchQueue(
    { ...scope, query: "13", category: "all", albums },
    request,
    () => true,
  );
  expect(partial.items).toHaveLength(50);
  expect(partial.errors).toEqual(["Serveur · Unavailable"]);
});
it("retires a combined public/private result when its captured owner changes during a delayed read", async () => {
  let active = true,
    complete!: (value: unknown) => void;
  const request = vi.fn(async (path: string) => {
    if (path.endsWith("collections"))
      return new Promise((resolve) => {
        complete = resolve;
      });
    if (path.endsWith("tracks"))
      return { items: [], total: 0, offset: 0, limit: 50, scanned_at: 1 };
    return { items: [], total: 0, offset: 0, unavailable_roots: 0, unreadable_directories: 0 };
  });
  const pending = searchQueue({ ...scope, category: "all" }, request, () => active);
  expect(complete).toBeTypeOf("function");
  active = false;
  complete({ items: [{ name: "Private collection", expression: "*" }], total: 1, offset: 0 });
  expect(await pending).toEqual({ items: [], more: false, errors: [] });
});
