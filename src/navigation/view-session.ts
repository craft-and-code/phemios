import { createSignal } from "solid-js";
import { locale, type Language } from "../i18n";
import { initialCoverageSort, type CoverageSort } from "../library/coverage-sort";
import type { Severity } from "../library/doctor";
import type { M3UKind } from "../library/m3u-files";
import type { FilterScope } from "./scoped-filters";

/** Presentation values only: no account data, selected entities, drafts or pending operations. */
export interface ViewControls {
  catalogReverse: Partial<Record<FilterScope, boolean>>;
  labelsSort: "name" | "albums";
  labelsDescending: boolean;
  labelAlbumsReverse: boolean;
  favouritesReverse: boolean;
  favouritesCompact: boolean;
  favouritesFlow: boolean;
  collectionsReverse: boolean;
  ratedReverse: boolean;
  ratedCompact: boolean;
  ratedMinimum: number;
  ratedMaximum: number;
  tagsReverse: boolean;
  tagsCompact: boolean;
  analysisSort: CoverageSort;
  doctorSeverity: Severity | "";
  encyclopediaMode: "reference" | "search" | "saved";
  encyclopediaLanguage: Language;
  encyclopediaCategory: string;
  relationsMode: "artist" | "album";
  m3uKind: M3UKind;
  playbackQueue: boolean;
  ordinaryLyrics: boolean;
  floatingLyrics: boolean;
}

/** One App owns this memory; leaving a page retains choices, closing the App discards them. */
export function createViewSession() {
  const [values, setValues] = createSignal<ViewControls>({
    catalogReverse: {},
    labelsSort: "name",
    labelsDescending: false,
    labelAlbumsReverse: false,
    favouritesReverse: false,
    favouritesCompact: false,
    favouritesFlow: false,
    collectionsReverse: false,
    ratedReverse: false,
    ratedCompact: false,
    ratedMinimum: 1,
    ratedMaximum: 5,
    tagsReverse: false,
    tagsCompact: false,
    analysisSort: { ...initialCoverageSort },
    doctorSeverity: "",
    encyclopediaMode: "reference",
    encyclopediaLanguage: locale(),
    encyclopediaCategory: "",
    relationsMode: "artist",
    m3uKind: "files",
    playbackQueue: false,
    ordinaryLyrics: true,
    floatingLyrics: true,
  });
  return {
    control<K extends keyof ViewControls>(key: K) {
      type Value = ViewControls[K];
      const read = () => values()[key];
      const write = (next: Value | ((previous: Value) => Value)): Value => {
        const value = typeof next === "function" ? next(read()) : next;
        setValues((previous) => ({ ...previous, [key]: value }));
        return value;
      };
      return [read, write] as const;
    },
  };
}
