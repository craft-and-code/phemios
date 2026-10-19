import { createMemo, createResource, createSignal, onCleanup } from "solid-js";
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
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const owner = createMemo(
    () => {
      const reference = options.reference(),
        session = options.session();
      return session ? { reference, session } : false;
    },
    undefined,
    {
      equals: (a, b) =>
        a === b || (!!a && !!b && a.reference === b.reference && a.session === b.session),
    },
  );

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
      const held = owner(),
        version = completed();
      return held &&
        held.reference &&
        (visible() ||
          version !== undefined ||
          (options.detail && options.available() === undefined))
        ? {
            reference: held.reference,
            session: held.session,
            owner: held,
            version,
            expanded: visible(),
          }
        : false;
    },
    undefined,
    {
      equals: (a, b) =>
        a === b ||
        (!!a && !!b && a.owner === b.owner && a.version === b.version && a.expanded === b.expanded),
    },
  );
  const [words, { refetch }] = createResource(
    identity,
    async ({ reference, session, owner: held }) => {
      try {
        const raw = await requestAede(
          "/api/v1/lyrics",
          { track: reference },
          "GET",
          null,
          referenceSource(reference),
          session,
        );
        if (reference !== options.reference() || session !== options.session())
          throw new Error(t("Session invalide."));
        return { reference, session, owner: held, lyrics: parseLyrics(raw, reference), error: "" };
      } catch (failure) {
        // Resource errors must stay inside the optional panel, never break track navigation.
        return { reference, session, owner: held, lyrics: null, error: String(failure) };
      }
    },
    { initialValue: undefined },
  );
  const current = () => {
    // Optional reads retain the surrounding workspace and queue rather than enter its Suspense.
    const value = words.latest;
    return !disposed && value?.owner === owner() ? value : undefined;
  };
  return {
    visible,
    toggle: () => setVisible(!visible()),
    available: () => !!current()?.lyrics || options.available() === true,
    lyrics: () => current()?.lyrics,
    loading: () => !disposed && !!owner() && words.loading,
    error: () => current()?.error ?? "",
    refresh: () => void refetch(),
  };
}
