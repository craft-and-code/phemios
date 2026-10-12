import { expect, it, vi } from "vitest";
import { translate } from "../i18n";
import {
  createAnnotationLoader,
  parseAnnotation,
  parseAnnotationResponse,
} from "./annotation-loading";
import { referenceSource, type SourceId } from "./sources";
import type { AccountSession, Annotation } from "./server";
const owner = (server: string): AccountSession => ({
  server,
  account: { id: "same-id", username: "listener", role: "user" },
});
const annotation = (reference: string, tag: string): Annotation => ({
  reference,
  loved: false,
  rating: null,
  note: null,
  tags: [tag],
});
const page = (rows: Annotation[], total = rows.length, offset = 0) => ({
  items: rows,
  total,
  offset,
  limit: 200,
  scanned_at: 1,
});
function setup(request: (source: SourceId, offset: number) => Promise<unknown>) {
  const sessions: Record<SourceId, AccountSession | undefined> = {
    local: owner("local"),
    server: owner("https://first.example"),
  };
  const rows = new Map<string, Annotation>();
  const error = vi.fn();
  const loader = createAnnotationLoader({
    session: (source) => sessions[source],
    request,
    error,
    clear: (source) => {
      for (const key of rows.keys()) if (referenceSource(key) === source) rows.delete(key);
    },
    publish: (_source, values) => {
      for (const row of values) rows.set(row.reference, row);
    },
  });
  return { sessions, rows, error, loader };
}
it("clears only the replaced source and ignores old pages even when another authority has the same account id", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  target.rows.set("artist:old", annotation("artist:old", "private"));
  target.rows.set("artist:@phemios/local/kept", annotation("artist:@phemios/local/kept", "local"));
  const read = target.loader.load("server");
  target.sessions.server = owner("https://second.example");
  target.loader.reset("server");
  expect([...target.rows.keys()]).toEqual(["artist:@phemios/local/kept"]);
  finish(page([annotation("artist:late", "old private tag")]));
  await read;
  expect([...target.rows.keys()]).toEqual(["artist:@phemios/local/kept"]);
  expect(target.error).not.toHaveBeenCalled();
});
it("replaces a complete source projection after validated paging while keeping confirmed concurrent edits", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(async (_source, offset) =>
    offset
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : page([annotation("artist:new", "snapshot")], 2),
  );
  target.rows.set("artist:deleted", annotation("artist:deleted", "old"));
  const read = target.loader.load("server");
  await Promise.resolve();
  expect([...target.rows.keys()]).toEqual(["artist:deleted"]);
  const saved = annotation("artist:new", "confirmed edit");
  target.rows.set(saved.reference, saved);
  target.loader.updated(saved.reference, saved);
  finish(page([annotation("release:other", "new")], 2, 1));
  await read;
  expect([...target.rows.keys()]).toEqual(["artist:new", "release:other"]);
  expect(target.rows.get(saved.reference)?.tags).toEqual(["confirmed edit"]);
});
it("retains the old projection and reports malformed cross-source or duplicate page data", async () => {
  for (const malformed of [
    page([annotation("artist:@phemios/local/wrong", "foreign")]),
    page([annotation("artist:same", "one"), annotation("artist:same", "two")]),
    { ...page([]), total: -1 },
    { ...page([]), total: 1000001 },
    page([annotation("unknown:fixture", "invalid kind")]),
    {
      ...page([]),
      items: [{ ...annotation("label:fixture", "invalid value"), note: 7 }],
      total: 1,
    },
  ]) {
    const target = setup(async () => malformed);
    target.rows.set("artist:previous", annotation("artist:previous", "keep"));
    await target.loader.load("server");
    expect([...target.rows.keys()]).toEqual(["artist:previous"]);
    expect(target.error).toHaveBeenCalledOnce();
  }
});
it("discards errors after application disposal", async () => {
  let reject!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const read = target.loader.load("server");
  target.loader.dispose();
  reject(new Error("Old account error"));
  await read;
  expect(target.error).not.toHaveBeenCalled();
});

it("discards replaced authority results without relying on a reset call or a changed account id", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const read = target.loader.load("server");
  target.sessions.server = owner("https://second.example");
  finish(page([annotation("artist:late", "old private tag")]));
  await read;
  expect(target.rows.size).toBe(0);
  expect(target.error).not.toHaveBeenCalled();
});
it("keeps a newer snapshot when an older read completes or fails afterwards", async () => {
  for (const fails of [false, true]) {
    let finish!: (value: unknown) => void,
      reject!: (value: unknown) => void,
      calls = 0;
    const target = setup(async () =>
      calls++ === 0
        ? new Promise((resolve, fail) => {
            finish = resolve;
            reject = fail;
          })
        : page([annotation("artist:new", "current")]),
    );
    const older = target.loader.load("server");
    await target.loader.load("server");
    if (fails) reject(new Error("Stale owner failure"));
    else finish(page([annotation("artist:old", "stale")]));
    await older;
    expect([...target.rows.keys()]).toEqual(["artist:new"]);
    expect(target.error).not.toHaveBeenCalled();
  }
});

it("accepts every valid Aède annotation kind while preserving private values and exact identities", () => {
  for (const kind of [
    "artist",
    "release",
    "track",
    "recording",
    "work",
    "release_group",
    "label",
    "genre",
  ])
    for (const owner of ["local", "server"]) {
      const reference = `${kind}:@phemios/${owner}/fixture`,
        row = {
          ...annotation(reference, "artist:literal tag"),
          note: "work:literal note",
          rating: 4,
          loved: true,
        };
      expect(parseAnnotation(row, reference)).toEqual(row);
    }
});
it("publishes valid mixed-kind owner annotations without discarding the private snapshot", async () => {
  for (const source of ["local", "server"] as const) {
    const rows = [
      "artist",
      "release",
      "track",
      "recording",
      "work",
      "release_group",
      "label",
      "genre",
    ].map((kind) => annotation(`${kind}:@phemios/${source}/fixture`, `${kind} private tag`));
    const target = setup(async () => page(rows));
    await target.loader.load(source);
    expect([...target.rows.values()]).toEqual(rows);
    expect(target.error).not.toHaveBeenCalled();
  }
});
it("explains malformed annotations and still refuses foreign targets and invalid values", () => {
  const row = annotation("artist:fixture", "private");
  expect(() => parseAnnotation(undefined)).toThrow("Réponse d’annotation Aède invalide.");
  for (const reference of ["unknown:fixture", "artist:", "release_group:", "genre:"])
    expect(() => parseAnnotation({ ...row, reference })).toThrow(
      "Référence d’annotation Aède invalide.",
    );
  expect(() => parseAnnotation(row, "artist:other")).toThrow(
    "L’annotation reçue ne correspond pas à l’élément demandé.",
  );
  for (const invalid of [{ rating: 0 }, { rating: 6 }, { loved: null }, { note: 7 }, { tags: [7] }])
    expect(() => parseAnnotation({ ...row, ...invalid })).toThrow(
      "Les valeurs d’annotation Aède sont invalides.",
    );
});

it("retains valid remote annotation keys containing literal local-marker text", async () => {
  const row = annotation(
    "track:@phemios/server/music/artist:@phemios/local/unrelated/fixture.flac",
    "retained",
  );
  const target = setup(async () => page([row]));
  await target.loader.load("server");
  expect([...target.rows.values()]).toEqual([row]);
  expect(target.error).not.toHaveBeenCalled();
});

it("provides bilingual validation details without repeating the unreadable-panel heading", () => {
  for (const [message, english] of [
    ["Réponse d’annotation Aède invalide.", "Invalid Aède annotation response."],
    ["Référence d’annotation Aède invalide.", "Invalid Aède annotation reference."],
    [
      "L’annotation reçue ne correspond pas à l’élément demandé.",
      "The received annotation does not match the requested item.",
    ],
    ["Les valeurs d’annotation Aède sont invalides.", "The Aède annotation values are invalid."],
    [
      "Les annotations dépassent la limite de lecture de 100 Mio.",
      "The annotations exceed the 100 MiB read limit.",
    ],
  ]) {
    expect(translate("fr", message!)).toBe(message);
    expect(translate("en", message!)).toBe(english);
    expect(message).not.toContain("Annotations illisibles");
  }
});

it("validates the whole Aède response identity for every canonical kind including empty annotations", () => {
  for (const kind of [
    "artist",
    "release",
    "track",
    "recording",
    "work",
    "release_group",
    "label",
    "genre",
  ])
    for (const source of ["local", "server"]) {
      const reference = `${kind}:@phemios/${source}/fixture`,
        row = annotation(reference, "retained tag");
      expect(parseAnnotationResponse({ reference, annotation: row }, reference)).toBe(row);
      expect(parseAnnotationResponse({ reference, annotation: null }, reference)).toBeNull();
    }
  const reference = "artist:fixture",
    row = annotation(reference, "retained tag");
  for (const raw of [undefined, null, [], {}, { reference }])
    expect(() => parseAnnotationResponse(raw, reference)).toThrow(
      "Réponse d’annotation Aède invalide.",
    );
  for (const target of [undefined, null, 7, "artist:", "unknown:fixture"])
    expect(() =>
      parseAnnotationResponse({ reference: target, annotation: null }, reference),
    ).toThrow("Référence d’annotation Aède invalide.");
  for (const nested of [null, row])
    expect(() =>
      parseAnnotationResponse({ reference: "artist:other", annotation: nested }, reference),
    ).toThrow("L’annotation reçue ne correspond pas à l’élément demandé.");
  expect(() =>
    parseAnnotationResponse(
      { reference, annotation: { ...row, reference: "artist:other" } },
      reference,
    ),
  ).toThrow("L’annotation reçue ne correspond pas à l’élément demandé.");
});
