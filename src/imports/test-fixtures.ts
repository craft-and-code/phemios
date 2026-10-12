import type { Album, Artist } from "../library/types";
import type { Annotation } from "../library/server";
export const artists: Artist[] = [
  {
    reference: "artist:example",
    name: "Example Artist",
    genre: "",
    country: null,
    biography: "",
    artwork: false,
  },
];
export const albums: Album[] = [
  {
    reference: "release:a",
    artist: "artist:example",
    title: "Aether",
    year: 2001,
    tags: [],
    compilation: false,
  },
  {
    reference: "release:b",
    artist: "artist:example",
    title: "Aether",
    year: 2010,
    tags: [],
    compilation: false,
  },
  {
    reference: "release:c",
    artist: "artist:example",
    title: "Boreal",
    year: 2002,
    tags: [],
    compilation: false,
  },
];
export function annotation(reference = "release:c", values: Partial<Annotation> = {}): Annotation {
  return { reference, loved: false, rating: null, note: null, tags: [], ...values };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
