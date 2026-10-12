import { expect, it } from "vitest";
import { createRadioBrowseSession } from "./browse-session";
import type { DirectorySnapshot } from "./directory-search";
const criteria = { name: "", country: "FR", tag: "rock", secureOnly: true };
const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Public station",
  country: "France",
  countryCode: "FR",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
const page = (): DirectorySnapshot => ({
  criteria,
  stations: [station],
  more: true,
  offset: 50,
  selected: 0,
  loaded: true,
  error: "",
});
it("retains an independent process-only public page with unsent fields and selected position", () => {
  const session = createRadioBrowseSession();
  expect(session.read()).toBeUndefined();
  const draft = { ...criteria, name: "unsent title" };
  session.remember(draft, page());
  draft.name = "later edit";
  const first = session.read()!;
  first.draft.name = "outside edit";
  first.directory.criteria.country = "US";
  first.directory.stations[0]!.name = "outside row edit";
  expect(session.read()).toEqual({
    draft: { ...criteria, name: "unsent title" },
    directory: page(),
  });
  expect(createRadioBrowseSession().read()).toBeUndefined();
});
it("retains at most one current 50-station page and refuses an oversized replacement", () => {
  const session = createRadioBrowseSession();
  session.remember(criteria, page());
  const second = {
    ...page(),
    offset: 100,
    selected: 49,
    stations: Array.from({ length: 50 }, () => station),
  };
  session.remember(criteria, second);
  expect(session.read()?.directory.stations).toHaveLength(50);
  expect(session.read()?.directory.selected).toBe(49);
  expect(() =>
    session.remember(criteria, { ...second, stations: [...second.stations, station] }),
  ).toThrow();
  expect(session.read()?.directory.offset).toBe(100);
});
