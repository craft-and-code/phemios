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

it("preserves explicit logo presence in public pages, details and legacy omissions", () => {
  const reference = "label:@phemios/server/fixture";
  for (const logo of [true, false, undefined]) {
    const fields = logo === undefined ? {} : { logo };
    const detail = { reference, name: "Fixture", releases: [], ...fields };
    expect(parseLabelDetail(detail, reference)).toEqual(detail);
    const page = parseLabelPage(
      {
        items: [{ reference, name: "Fixture", release_count: 0, ...fields }],
        total: 1,
        offset: 0,
        scanned_at: 1,
      },
      0,
      "server",
      1,
    );
    expect(page.items[0]?.logo).toBe(logo);
  }
});

it("rejects malformed logo hints instead of silently treating them as an older server", () => {
  const reference = "label:fixture";
  for (const logo of [null, 1, "true", {}, []]) {
    expect(() =>
      parseLabelDetail({ reference, name: "Fixture", releases: [], logo }, reference),
    ).toThrow();
    expect(() =>
      parseLabelPage(
        {
          items: [{ reference, name: "Fixture", release_count: 0, logo }],
          total: 1,
          offset: 0,
          scanned_at: 1,
        },
        0,
        "server",
        1,
      ),
    ).toThrow();
  }
});
