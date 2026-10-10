import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { createPersonalReads } from "../library/personal-reads";
import { m3uTitles } from "../library/m3u-preview";
import { downloadM3U, type M3UFile } from "../components/M3UExport";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { t } from "../i18n";
interface Export {
  id: string;
  name: string;
  track_count: number;
}
/** An export library previews the server-authored list before explicit download to another player. */
export function M3UPage(props: { query: string }) {
  const library = useLibrary(),
    [offset, setOffset] = createSignal(0),
    [selected, setSelected] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  const reads = createPersonalReads(
    () => "playlists",
    library.session,
    offset,
    (path, query) => requestAede(path, query),
  );
  createEffect(() => {
    void library.session();
    void library.source();
    setSelected("");
    setOffset(0);
    setMessage("");
  });
  const rows = () =>
    (reads.page()?.data?.items as Export[] | undefined)?.filter((row) =>
      row.name.toLocaleLowerCase().includes(props.query.toLocaleLowerCase()),
    ) ?? [];
  const [detail] = createResource(
    () =>
      selected() && library.session()
        ? { id: selected(), session: library.session(), source: library.source() }
        : false,
    async (key) => {
      const file = await requestAede<M3UFile>(
        `/api/me/v1/m3u/${encodeURIComponent(key.id)}`,
        {},
        "GET",
        null,
        key.source,
      );
      if (file.id !== key.id || typeof file.name !== "string" || typeof file.content !== "string")
        throw Error(t("Contenu M3U invalide."));
      return { ...key, file: { ...file, source: key.source }, titles: m3uTitles(file.content) };
    },
  );
  const current = () =>
    detail()?.session === library.session() &&
    detail()?.source === library.source() &&
    detail()?.id === selected()
      ? detail()
      : undefined;
  async function download() {
    const data = current();
    if (!data || busy()) return;
    setBusy(true);
    setMessage("");
    try {
      const path = await downloadM3U(data.file);
      if (data.session === library.session() && data.source === library.source())
        setMessage(t("M3U téléchargé : {0}", path));
    } catch (failure) {
      if (data.session === library.session()) setMessage(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="page m3u-page">
      <p class="muted">
        {t(
          "Choisissez un export pour vérifier ses titres, puis téléchargez-le pour un autre lecteur. Les chemins sont ceux du serveur Aède.",
        )}
      </p>
      <Feedback message={message()} onClose={() => setMessage("")} />
      <Show when={reads.loading()}>
        <p class="job-activity" role="status">
          <span class="spinner" />
          {t("Chargement…")}
        </p>
      </Show>
      <Feedback error message={reads.page()?.error ?? ""} />
      <Show
        when={rows().length}
        fallback={<EmptyState icon="playlist">{t("Aucun export M3U enregistré.")}</EmptyState>}
      >
        <div class="m3u-workspace">
          <ul class="m3u-library">
            <For each={rows()}>
              {(row) => (
                <li>
                  <button aria-pressed={selected() === row.id} onClick={() => setSelected(row.id)}>
                    <Icon name="playlist" />
                    <strong>{row.name}</strong>
                    <small>{t("{0} pistes", row.track_count)}</small>
                  </button>
                </li>
              )}
            </For>
          </ul>
          <section class="m3u-preview">
            <Show when={detail.loading}>
              <p class="job-activity" role="status">
                <span class="spinner" />
                {t("Chargement…")}
              </p>
            </Show>
            <Feedback error message={detail.error ? String(detail.error) : ""} />
            <Show
              when={current()}
              fallback={
                <Show when={!selected()}>
                  <EmptyState icon="playlist">{t("Sélectionnez un export M3U.")}</EmptyState>
                </Show>
              }
            >
              {(data) => (
                <>
                  <div class="section-heading">
                    <h2>{data().file.name}</h2>
                    <button
                      class="icon-button"
                      title={t("Télécharger le M3U")}
                      aria-label={t("Télécharger le M3U")}
                      disabled={busy()}
                      onClick={() => void download()}
                    >
                      <Show when={busy()} fallback={<Icon name="download" />}>
                        <span class="spinner" />
                      </Show>
                    </button>
                  </div>
                  <ol>
                    <For each={data().titles}>{(title) => <li>{title}</li>}</For>
                  </ol>
                </>
              )}
            </Show>
          </section>
        </div>
      </Show>
      <Show when={(reads.page()?.data?.total ?? 0) > 50}>
        <div class="page-controls">
          <button
            class="icon-button"
            title={t("Précédentes")}
            aria-label={t("Précédentes")}
            disabled={!offset()}
            onClick={() => setOffset(offset() - 50)}
          >
            <Icon name="back" />
          </button>
          <span>
            {offset() + 1}–{offset() + rows().length} / {reads.page()?.data?.total}
          </span>
          <button
            class="icon-button"
            title={t("Suivantes")}
            aria-label={t("Suivantes")}
            disabled={offset() + 50 >= (reads.page()?.data?.total ?? 0)}
            onClick={() => setOffset(offset() + 50)}
          >
            <Icon name="forward" />
          </button>
        </div>
      </Show>
    </section>
  );
}
