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
          (row.source ?? "server") === source &&
          row.status === "completed",
      )?.task_id;
  });
  const identity = createMemo(
    () => {
      const reference = options.reference(),
        session = options.session(),
        version = completed();
      return reference &&
        session &&
        (visible() ||
          version !== undefined ||
          (options.detail && options.available() === undefined))
        ? { reference, session, version, expanded: visible() }
        : false;
    },
    undefined,
    {
      equals: (a, b) =>
        a === b ||
        (!!a &&
          !!b &&
          a.reference === b.reference &&
          a.session === b.session &&
          a.version === b.version &&
          a.expanded === b.expanded),
    },
  );
  const [words, { refetch }] = createResource(
    identity,
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
    { initialValue: undefined },
  );
  const current = () => {
    // Optional reads retain the surrounding workspace and queue rather than enter its Suspense.
    const value = words.latest;
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
