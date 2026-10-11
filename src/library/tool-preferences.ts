import { announceSetting } from "./saved-settings";
import { getOwner, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import { t } from "../i18n";
export const pageSizes = [25, 50, 100, 200] as const;
export interface ToolPreferences {
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
}
export const defaultToolPreferences: ToolPreferences = {
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
};
const key = "phemios.tools.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function validate(raw: unknown): ToolPreferences {
  const row = raw as ToolPreferences;
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
  return next;
}
/** Reactive settings update only after persistence; callers display the returned error. */
export function createToolPreferences(storage: Store = localStorage) {
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
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", reload));
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
