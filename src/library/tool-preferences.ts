import { interfacePreferences } from "./account-preferences";
import { announceSetting } from "./saved-settings";
import { getOwner, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import { t } from "../i18n";
export const pageSizes = [25, 50, 100, 200] as const;
export type ArtistView = "discography" | "editorial";
export interface ToolPreferences {
  artistView: ArtistView;
  full: boolean;
  threads: number;
  summaries: boolean;
  covers: boolean;
  fanart: boolean;
  lyrics: boolean;
  discogs: boolean;
  excluded: ("local" | "server")[];
  trackPageSize: number;
  showMissingAlbums: boolean;
  coverSize: number;
  coverSizes: Partial<Record<"albums" | "compilations" | "genres" | "composers", number>>;
}
export const defaultToolPreferences: ToolPreferences = {
  artistView: "discography",
  full: false,
  threads: 0,
  summaries: true,
  covers: true,
  fanart: false,
  lyrics: false,
  discogs: false,
  excluded: [],
  trackPageSize: 50,
  showMissingAlbums: true,
  coverSize: 150,
  coverSizes: {},
};
/** Cover rails use bounded pixel steps; only catalogue sections may override the default. */
function validCoverSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 280 &&
    value % 10 === 0
  );
}
function validCoverOverrides(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, size]) =>
        ["albums", "compilations", "genres", "composers"].includes(key) && validCoverSize(size),
    )
  );
}
const key = "phemios.tools.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function validate(raw: unknown): ToolPreferences {
  const row = raw as ToolPreferences;
  const artistView = (raw as Record<string, unknown> | null)?.artistView;
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    ![
      row.showMissingAlbums === undefined ? true : row.showMissingAlbums,
      row.full,
      row.summaries,
      row.covers,
      row.fanart,
      row.lyrics,
      row.discogs === undefined ? false : row.discogs,
    ].every((v) => typeof v === "boolean") ||
    !(
      artistView === undefined ||
      artistView === "portrait" ||
      artistView === "discography" ||
      artistView === "editorial"
    ) ||
    !validCoverSize(row.coverSize === undefined ? 150 : row.coverSize) ||
    !validCoverOverrides(row.coverSizes === undefined ? {} : row.coverSizes) ||
    !Number.isInteger(row.threads) ||
    row.threads < 0 ||
    row.threads > 64 ||
    !pageSizes.some((size) => size === row.trackPageSize) ||
    !Array.isArray(row.excluded) ||
    row.excluded.some((source) => source !== "local" && source !== "server") ||
    Object.keys(row).some((field) => !Object.hasOwn(defaultToolPreferences, field))
  )
    throw new Error(t("Options enregistrées illisibles."));
  return {
    ...row,
    artistView: artistView === "editorial" ? "editorial" : "discography",
    coverSize: row.coverSize === undefined ? 150 : row.coverSize,
    coverSizes: row.coverSizes === undefined ? {} : row.coverSizes,
    discogs: row.discogs === undefined ? false : row.discogs,
    showMissingAlbums: row.showMissingAlbums === undefined ? true : row.showMissingAlbums,
  };
}
/** Read non-secret scan, enrichment and browsing choices; preserve invalid stores. */
export function readToolPreferences(storage: Store): ToolPreferences {
  const raw = storage.getItem(key);
  if (raw === null) return { ...defaultToolPreferences, excluded: [] };
  if (raw.length > 4096) throw new Error(t("Options enregistrées illisibles."));
  return validate(JSON.parse(raw));
}
/** Merge independent sections before writing; a failed write never claims a saved choice. */
export function saveToolPreferences(
  storage: Store,
  patch: Partial<ToolPreferences>,
): ToolPreferences {
  const next = validate({ ...readToolPreferences(storage), ...patch });
  storage.setItem(key, JSON.stringify(next));
  announceSetting(key, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("phemios-tools-saved"));
  return next;
}
/** Reactive settings update only after persistence; callers display the returned error. */
export function createToolPreferences(storage: Store = interfacePreferences) {
  const [value, setValue] = createSignal({
    ...defaultToolPreferences,
    excluded: [] as ToolPreferences["excluded"],
  });
  const [error, setError] = createSignal("");
  try {
    setValue(readToolPreferences(storage));
  } catch (failure) {
    setError(String(failure));
  }
  if (typeof window !== "undefined" && getOwner()) {
    const reload = () => {
      try {
        setValue(readToolPreferences(storage));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    };
    window.addEventListener("phemios-tools-saved", reload);
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => {
      window.removeEventListener("phemios-tools-saved", reload);
      window.removeEventListener("phemios-settings-loaded", reload);
    });
  }
  return {
    value,
    error,
    update: (patch: Partial<ToolPreferences>) => {
      try {
        setValue(saveToolPreferences(storage, patch));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
  };
}
