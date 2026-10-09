import { expect, it } from "vitest";
import { parseLabelDetail, parseLabelPage } from "./labels";
it("keeps label prose attributed and editions on their originating source", () => {
  const reference = "label:@phemios/server/label";
  const biography = {
    text: "Independent label.",
    url: "https://example.org/label",
    lang: "en",
    licence: "Terms",
    source: "discogs",
  };
  expect(
    parseLabelDetail(
      { reference, name: "Label", releases: ["release:@phemios/server/a"], biography },
      reference,
    ).biography,
  ).toEqual(biography);
  expect(() =>
    parseLabelDetail(
      { reference, name: "Label", releases: [], biography: { text: "Uncredited" } },
      reference,
    ),
  ).toThrow();
  expect(() =>
    parseLabelDetail(
      { reference, name: "Label", releases: ["release:@phemios/local/a"] },
      reference,
    ),
  ).toThrow();
  expect(() =>
    parseLabelPage({ items: [], total: 0, offset: 0, scanned_at: 3 }, 0, "server", 4),
  ).toThrow();
});

it("rejects invalid empty label page metadata", () => {
  for (const patch of [{ total: -1 }, { scanned_at: -1 }, { scanned_at: undefined }])
    expect(() =>
      parseLabelPage({ items: [], total: 0, offset: 0, scanned_at: 3, ...patch }, 0, "server"),
    ).toThrow();
});
