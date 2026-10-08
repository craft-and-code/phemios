import type { Album, Artist, Interval } from "../library/types";

/** Entirely fictional catalog; no service fixture or private library data. */
export const demoArtists: readonly Artist[] = [
  {
    reference: "oree",
    name: "Orée",
    genre: "Jazz",
    country: "France",
    artwork: true,
    biography:
      "Ensemble fictif entre jazz acoustique et textures électroniques. Ses albums explorent les paysages nocturnes et l’improvisation collective.",
  },
  {
    reference: "nacre",
    name: "Nacre",
    genre: "Électronique",
    country: "France",
    artwork: true,
    biography:
      "Duo fictif de synthétiseurs et d’instruments préparés. Ses collaborations restent distinctes de sa discographie.",
  },
  {
    reference: "passagers",
    name: "Les Passagers",
    genre: "Rock",
    country: "Belgique",
    artwork: false,
    biography: "Groupe fictif de rock. Aucun visuel de groupe n’a été récupéré dans cet exemple.",
  },
  {
    reference: "varenne",
    name: "Émile Varenne",
    genre: "Classique",
    country: null,
    artwork: false,
    biography:
      "Pianiste fictif. Son origine est inconnue ; elle n’est pas déduite du pays d’une édition.",
  },
];

export const demoAlbums: readonly Album[] = [
  {
    reference: "blue",
    artist: "oree",
    title: "Les heures bleues",
    year: 2022,
    compilation: false,
    tags: ["nocturne"],
  },
  {
    reference: "islands",
    artist: "oree",
    title: "Les îles lentes",
    year: 2015,
    compilation: false,
    tags: ["piano"],
  },
  {
    reference: "edges",
    artist: "oree",
    title: "Lisières",
    year: 2010,
    compilation: false,
    tags: [],
  },
  {
    reference: "dawn",
    artist: "oree",
    title: "Matière d’aube",
    year: 2004,
    compilation: false,
    tags: ["live"],
  },
  {
    reference: "first",
    artist: "oree",
    title: "Le premier jour",
    year: 1999,
    compilation: false,
    tags: [],
  },
  {
    reference: "unknown",
    artist: "oree",
    title: "Fragments de nuit",
    year: null,
    compilation: false,
    tags: [],
  },
  {
    reference: "lines",
    artist: "nacre",
    title: "Lignes de fuite",
    year: 2019,
    compilation: false,
    tags: ["ambiant"],
  },
  {
    reference: "flows",
    artist: "nacre",
    title: "Courants",
    year: 2023,
    compilation: false,
    tags: [],
  },
  {
    reference: "cities",
    artist: "passagers",
    title: "À travers les villes",
    year: 1974,
    compilation: false,
    tags: [],
  },
  {
    reference: "earth",
    artist: "passagers",
    title: "Terre intérieure",
    year: 1986,
    compilation: false,
    tags: [],
  },
  {
    reference: "light",
    artist: "passagers",
    title: "Lumière oblique",
    year: 1996,
    compilation: false,
    tags: [],
  },
  {
    reference: "silence",
    artist: "varenne",
    title: "Au bord du silence",
    year: 2018,
    compilation: false,
    tags: ["piano"],
  },
  {
    reference: "nocturnes",
    artist: "varenne",
    title: "Nocturnes",
    year: 2007,
    compilation: false,
    tags: [],
  },
  {
    reference: "meetings",
    artist: "nacre",
    title: "Rencontres",
    year: 2020,
    compilation: true,
    tags: [],
  },
];

/** Rails use available years, never a guessed current-year upper bound. */
export const demoYearDomain: Interval = [
  Math.min(...demoAlbums.flatMap((album) => (album.year === null ? [] : [album.year]))),
  Math.max(...demoAlbums.flatMap((album) => (album.year === null ? [] : [album.year]))),
];
