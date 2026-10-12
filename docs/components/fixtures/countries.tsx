import boundaries from "../../../public/geography/countries.json";
import type { Country } from "../../../src/geography/projection";
import type { Artist } from "../../../src/library/types";
/** Fictional artists; actual geography remains the bundled public boundaries. */
export const artists: Artist[] = [
  {
    reference: "artist:fixture-a",
    name: "Example Ensemble",
    genre: "Rock",
    country: "France",
    countryCode: "FR",
    biography: "",
    artwork: false,
  },
  {
    reference: "artist:fixture-b",
    name: "Fictional Quartet",
    genre: "Jazz",
    country: "United States",
    countryCode: "US",
    biography: "",
    artwork: false,
  },
];

const geometry: Country[] = boundaries.map((country) => ({
  ...country,
  polygons: country.polygons.map((polygon) =>
    polygon.map((ring) =>
      ring.map((point) => {
        const [longitude, latitude] = point;
        if (
          point.length !== 2 ||
          longitude === undefined ||
          latitude === undefined ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude)
        )
          throw new Error("Invalid bundled country coordinate.");
        return [longitude, latitude] as const;
      }),
    ),
  ),
}));

/** Use the exact app geometry through a typed loader; never replace global fetch. */
export async function loadCountries(): Promise<readonly Country[]> {
  return geometry;
}
