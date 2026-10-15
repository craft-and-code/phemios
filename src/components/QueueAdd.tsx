import { queueAppendReason } from "../library/queue-append-policy";
import { batch, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { createQueueSearch } from "../library/queue-search-controller";
import { type QueueSearchItem } from "../library/queue-search";
import { readCollectionPlayback } from "../library/collection-playback";
import { QueueAddView } from "./QueueAddView";
/** Search lifetime is independent of the queue and audio-clock polls. */
export function QueueAdd(props: { onClose: () => void }) {
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
      library.player.busy() ||
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
      const count = await library.player.appendSelection(
        async (admitted) => {
          const valid = () => ownerCurrent() && admitted();
          if (!valid()) return;
          let value: unknown;
          if (row.collection)
            value = await readCollectionPlayback(
              row.collection,
              row.source,
              owner,
              library.albums(),
              library.trackSources().find((o) => o.source === row.source)?.scannedAt,
              valid,
            );
          else if (row.playlist) {
            const status = await requestAede<{ capabilities: string[] }>(
              "/api/v1/status",
              {},
              "GET",
              null,
              row.source,
              owner,
            );
            if (!valid()) return;
            if (!status.capabilities?.includes("m3u_playback_selection"))
              throw Error(t("Mettez à jour puis redémarrez Aède pour ajouter les listes M3U."));
            value = await requestAede(
              `${row.playlist.kind === "files" ? "/api/me/v1/m3u-files" : "/api/me/v1/m3u"}/${row.playlist.id}/playback`,
              {},
              "GET",
              null,
              row.source,
              owner,
            );
          } else
            value = await requestAede(
              "/api/v1/presentation/playback",
              { ref: row.reference! },
              "GET",
              null,
              row.source,
              owner,
            );
          return valid() ? value : undefined;
        },
        row.source,
        row.reference,
      );
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
