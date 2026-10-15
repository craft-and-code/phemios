/** Presentation records; server entities will retain their stable Aède references. */
export interface Artist {
  reference: string;
  name: string;
  genre: string;
  country: string | null;
  countryCode?: string;
  /** Unlocalized MusicBrainz area retained for Aède country/region statistics navigation. */
  originArea?: string;
  biography: string;
  artwork: boolean;
  genres?: readonly string[];
  releaseRefs?: readonly string[];
  searchFields?: readonly string[];
  biographyCredit?: { url: string; lang: string; licence: string };
  media?: { banner: boolean; background: boolean; portrait: boolean; logo?: boolean };
  relations?: readonly {
    reference: string;
    name: string;
    weight: number;
    kind: string;
    source: string;
  }[];
}

/** A release edition, kept distinct from a recording or composition. */
export interface Album {
  reference: string;
  artist: string | null;
  title: string;
  year: number | null;
  compilation: boolean;
  /** Sourced genre labels in Aède’s presentation; owner tags belong to annotations/search fields. */
  tags: readonly string[];
  contributors?: readonly string[];
  searchFields?: readonly string[];
  cover?: boolean;
  trackCount?: number;
  addedAt?: number | null;
  note?: string;
  rating?: number;
  favourite?: boolean;
}

export type Interval = readonly [number, number];
export type RailMode = "years" | "alphabet" | "both" | "none";

/** Both active intervals intersect; hidden rails do not filter results. */
export interface Filters {
  recentOnly?: boolean | undefined;
  mode: RailMode;
  years: Interval;
  alphabet: Interval;
  includeUnknownYear: boolean;
  query: string;
  countries?: readonly (string | null)[];
  genre?: string | undefined;
  genres?: readonly string[];
}
