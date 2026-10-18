/** Explicitly integrated providers, independent of whether a key or account is configured. */
export const externalServices = [
  { name: "Radio Browser", url: "https://www.radio-browser.info/" },
  { name: "MusicBrainz", url: "https://musicbrainz.org/" },
  { name: "Wikidata", url: "https://www.wikidata.org/" },
  { name: "Wikipedia", url: "https://www.wikipedia.org/" },
  { name: "Wikimedia Commons", url: "https://commons.wikimedia.org/" },
  { name: "Fanart.tv", url: "https://fanart.tv/" },
  { name: "Cover Art Archive", url: "https://coverartarchive.org/" },
  { name: "Discogs", url: "https://www.discogs.com/" },
  { name: "AcoustID", url: "https://acoustid.org/" },
  { name: "LRCLIB", url: "https://lrclib.net/" },
  {
    name: "Ticketmaster Discovery",
    url: "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/",
  },
];
/** The component explorer can render product rows without loading a native application manifest. */
export const dependencyCredits =
  typeof __PHEMIOS_DEPENDENCIES__ === "undefined" ? [] : __PHEMIOS_DEPENDENCIES__;
