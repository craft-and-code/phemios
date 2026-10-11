import { expect, it } from "vitest";
import { labelDestination } from "./label-navigation";
it("opens the exact Aède label detail rather than a catalogue search", () => {
  expect(
    labelDestination(
      { reference: "label:fixture", name: "Fixture Label", releases: [] },
      "fixture label",
      "server",
    ),
  ).toBe("#/label/label%3Afixture");
  expect(
    labelDestination(
      { reference: "label:@phemios/local/fixture", name: "Fixture Label", releases: [] },
      "Fixture Label",
      "local",
    ),
  ).toBe("#/label/label%3A%40phemios%2Flocal%2Ffixture");
});
it("refuses a different origin, name, kind or malformed label detail", () => {
  for (const raw of [
    null,
    { reference: "label:fixture", name: "Other", releases: [] },
    { reference: "artist:fixture", name: "Fixture", releases: [] },
    { reference: "label:fixture", name: "Fixture", releases: ["track:one"] },
  ])
    expect(() => labelDestination(raw, "Fixture", "server")).toThrow();
  expect(() =>
    labelDestination(
      { reference: "label:fixture", name: "Fixture", releases: [] },
      "Fixture",
      "local",
    ),
  ).toThrow();
});
