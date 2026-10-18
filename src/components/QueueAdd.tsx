import { queueAppendReason } from "../library/queue-append-policy";
import { batch, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { readLibrarySelection } from "../library/selection-read";
import { queueAdditionSelection, type PlayableSelection } from "../library/playback-selection";
import { createQueueSearch } from "../library/queue-search-controller";
import { type QueueSearchItem } from "../library/queue-search";
import { QueueAddView } from "./QueueAddView";
/** Search lifetime is independent of the queue and audio-clock polls. */
export function QueueAdd(props: {
  onClose?: () => void;
  onSelect?: (rows: readonly PlayableSelection[]) => void;
  disabled?: boolean;
}) {
  const library = useLibrary(),
    [pending, setPending] = createSignal(""),
    [added, setAdded] = createSignal(""),
    [error, setError] = createSignal("");
  let disposed = false,
    operation = 0,
    clear: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    disposed = true;
    clearTimeout(clear);
  });
  const owners = createMemo(() =>
    (["local", "server"] as const).flatMap((source) => {
      const session = source === "local" ? library.localSession() : library.serverSession();
      return session ? [{ source, session }] : [];
    }),
  );
  createEffect(() => {
    owners();
    operation++;
    clearTimeout(clear);
    batch(() => {
      setPending("");
      setAdded("");
      setError("");
    });
  });
  const search = createQueueSearch(
    () => ({ owners: owners(), albums: library.albums(), artists: library.artists() }),
    (path, query, source, owner) => requestAede(path, query, "GET", null, source, owner),
  );
  const read = search.read;
  const disabled = (row: QueueSearchItem) => {
    const reference = row.reference ?? `track:@phemios/${row.source}/queue`,
      owner = owners().find((o) => o.source === row.source)?.session;
    if (props.onSelect)
      return props.disabled
        ? t("Un transfert est déjà en cours.")
        : !owner
          ? t("Connectez-vous pour sélectionner des fichiers.")
          : owner.account.parental_enabled || owner.account.role === "auditor"
            ? t("L’export audio est indisponible pour ce compte.")
            : "";
    return (
      queueAppendReason(reference, {
        role: owner?.account.role,
        busy: library.player.busy() || library.player.appending(),
        device: library.player.device(),
        first: library.player.queue()[0]?.reference,
      }) || (!library.player.canStart(reference) ? t("Lecture indisponible.") : "")
    );
  };
  async function add(row: QueueSearchItem) {
    const owner = owners().find((o) => o.source === row.source)?.session;
    if (
      !owner ||
      pending() ||
      disabled(row) ||
      (!props.onSelect && library.player.busy()) ||
      search.waiting() ||
      !read.current()?.items.includes(row)
    )
      return;
    const ticket = ++operation;
    const ownerCurrent = () => owners().some((o) => o.source === row.source && o.session === owner);
    const current = () => !disposed && ticket === operation && ownerCurrent();
    setPending(row.key);
    setError("");
    setAdded("");
    try {
      const resolve = (admitted: () => boolean) =>
        readLibrarySelection(
          row,
          owner,
          library.albums(),
          library.trackSources().find((o) => o.source === row.source)?.scannedAt,
          () => ownerCurrent() && admitted(),
        );
      let count = 0;
      if (props.onSelect) {
        const value = await resolve(current);
        if (!current() || value === undefined || props.disabled) return;
        const rows = queueAdditionSelection(
          value,
          library.albums(),
          library.artists(),
          row.reference,
        );
        props.onSelect(rows);
        count = rows.length;
      } else count = await library.player.appendSelection(resolve, row.source, row.reference);
      if (current() && count) {
        setAdded(row.key);
        clearTimeout(clear);
        clear = setTimeout(() => setAdded(""), 2000);
      }
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (!disposed && ticket === operation) setPending("");
    }
  }
  return (
    <QueueAddView
      title={props.onSelect ? t("Choisir la musique à copier") : undefined}
      footer={props.onSelect ? t("Ajout à la sélection de transfert") : undefined}
      actionLabel={props.onSelect ? (row) => t("Sélectionner {0}", row.title) : undefined}
      category={search.category()}
      query={search.query()}
      rows={read.current()?.items ?? []}
      loading={search.waiting() || read.loading()}
      pending={pending()}
      added={added()}
      error={error() || read.error() || read.current()?.errors.join("\n") || ""}
      more={read.current()?.more ?? false}
      offset={search.offset()}
      origins={
        new Set([
          ...owners().map((owner) => owner.source),
          ...(read.current()?.items.map((row) => row.source) ?? []),
        ]).size > 1
      }
      image={(row) =>
        row.album
          ? library.image(row.album, "cover")
          : row.reference?.startsWith("artist:")
            ? library.image(row.reference, "portrait")
            : undefined
      }
      disabled={disabled}
      onQuery={(value) => {
        setError("");
        search.setQuery(value);
      }}
      onCategory={(value) => {
        setError("");
        search.chooseCategory(value);
      }}
      onOffset={search.setOffset}
      onSearch={search.submit}
      onAdd={(row) => void add(row)}
      onClose={props.onClose}
      onRefresh={() => void read.refetch()}
      onCancel={read.cancel}
    />
  );
}
