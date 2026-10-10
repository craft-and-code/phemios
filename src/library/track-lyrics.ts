import { createMemo, createResource, createSignal } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { Job } from "./jobs";
import { parseLyrics } from "./lyrics";
import { referenceSource } from "./sources";
/** Load words on explicit expansion; probe only a completed acquisition or a legacy detail page. */
export function createTrackLyrics(options: {
  reference: () => string;
  available: () => boolean | undefined;
  session: () => AccountSession | undefined;
  jobs: () => readonly Job[];
  detail?: boolean;
}) {
  const [visible, setVisible] = createSignal(false);
  const completed = createMemo(() => {
    const reference = options.reference(),
      source = referenceSource(reference);
    return options
      .jobs()
      .slice()
      .reverse()
      .find(
        (row) =>
          row.kind === "lyrics" &&
          row.release === reference &&
          row.source === source &&
          row.status === "completed",
      )?.task_id;
  });
  const [words, { refetch }] = createResource(
    () => {
      const reference = options.reference(),
        session = options.session(),
        version = completed();
      return session &&
        (visible() ||
          version !== undefined ||
          (options.detail && options.available() === undefined))
        ? { reference, session, version }
        : false;
    },
    async ({ reference, session }) => {
      try {
        const raw = await requestAede(
          "/api/v1/lyrics",
          { track: reference },
          "GET",
          null,
          referenceSource(reference),
        );
        if (reference !== options.reference() || session !== options.session())
          throw new Error(t("Session invalide."));
        return { reference, session, lyrics: parseLyrics(raw, reference), error: "" };
      } catch (failure) {
        // Resource errors must stay inside the optional panel, never break track navigation.
        return { reference, session, lyrics: null, error: String(failure) };
      }
    },
  );
  const current = () => {
    const value = words();
    return value?.reference === options.reference() && value.session === options.session()
      ? value
      : undefined;
  };
  return {
    visible,
    toggle: () => setVisible(!visible()),
    available: () => !!current()?.lyrics || options.available() === true,
    lyrics: () => current()?.lyrics,
    loading: () => words.loading,
    error: () => current()?.error ?? "",
    refresh: () => void refetch(),
  };
}
