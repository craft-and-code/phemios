/** Presentation records; server entities will retain their stable Aède references. */
export interface Artist {
  reference: string;
  name: string;
  genre: string;
  country: string | null;
  biography: string;
  artwork: boolean;
}

/** A release edition, kept distinct from a recording or composition. */
export interface Album {
  reference: string;
  artist: string;
  title: string;
  year: number | null;
  compilation: boolean;
  tags: readonly string[];
}

export type Interval = readonly [number, number];
export type RailMode = "years" | "alphabet" | "both";

/** Both active intervals intersect; hidden rails do not filter results. */
export interface Filters {
  mode: RailMode;
  years: Interval;
  alphabet: Interval;
  includeUnknownYear: boolean;
  query: string;
}
