import { createEffect, createSignal, For, Show, on } from "solid-js";
import { createStore } from "solid-js/store";
import { useLibrary } from "../library/context";
import { readServerRoots } from "../library/server-roots";
import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { RefreshButton } from "./RefreshButton";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { Feedback } from "./Feedback";
/** Server paths are edited as rows; discovery never scans or consults the client's filesystem. */
export function ServerRoots(props: {
  busy: boolean;
  revision: number;
  scan: (paths: string[]) => void;
}) {
  const library = useLibrary(),
    [rows, setRows] = createStore<{ id: number; path: string }[]>([]);
  let id = 0;
  const [reloaded, setReloaded] = createSignal(false);
  createEffect(
    on(
      () => [library.serverSession(), props.revision],
      () => setReloaded(false),
    ),
  );
  const read = createDiagnosticRead(
    () => {
      const session = library.serverSession();
      return session ? { session, revision: props.revision } : false;
    },
    async (key) =>
      readServerRoots((offset) =>
        requestAede(
          "/api/v1/roots",
          { offset: String(offset), limit: "200" },
          "GET",
          null,
          "server",
          key.session,
        ),
      ),
  );
  createEffect(() => {
    const paths = read.current();
    if (paths) setRows(paths.map((path) => ({ id: id++, path })));
  });
  return (
    <section class="server-roots">
      <div class="section-heading">
        <h3>{t("Dossiers et scan du serveur")}</h3>
        <RefreshButton
          label={t("Relire la liste des dossiers, sans scanner")}
          busy={read.loading()}
          disabled={props.busy || (read.pending() && !read.loading())}
          onCancel={() => {
            setReloaded(false);
            read.cancel();
          }}
          onRefresh={() => {
            setReloaded(true);
            void read.refetch();
          }}
        />
      </div>
      <Feedback error persistent message={read.error()} />
      <Feedback
        message={
          reloaded() && !read.pending() && read.current()
            ? t(
                "Dossiers surveillés rechargés : {0}. Aucun scan n’a été lancé.",
                read.current()!.length,
              )
            : ""
        }
        onClose={() => setReloaded(false)}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.scan(rows.map((row) => row.path));
        }}
      >
        <ul class="server-root-rows">
          <For each={rows}>
            {(row, index) => (
              <li>
                <input
                  aria-label={t("Dossier serveur {0}", index() + 1)}
                  value={row.path}
                  placeholder="/music"
                  disabled={props.busy || read.loading()}
                  onInput={(event) => setRows(index(), "path", event.currentTarget.value)}
                />
                <button
                  class="icon-button quiet"
                  type="button"
                  title={t("Retirer ce dossier du prochain scan")}
                  aria-label={t("Retirer ce dossier du prochain scan")}
                  disabled={props.busy || read.loading()}
                  onClick={() => setRows(rows.filter((value) => value.id !== row.id))}
                >
                  <Icon name="minus" />
                </button>
              </li>
            )}
          </For>
        </ul>
        <div class="settings-actions">
          <button
            class="icon-button"
            type="button"
            title={t("Ajouter un dossier serveur")}
            aria-label={t("Ajouter un dossier serveur")}
            disabled={props.busy || read.loading() || rows.length >= 64}
            onClick={() => setRows([...rows, { id: id++, path: "" }])}
          >
            <Icon name="plus" />
          </button>
          <button disabled={props.busy || read.loading() || !rows.length}>
            <Show when={props.busy} fallback={<Icon name="search" />}>
              <span class="spinner" />
            </Show>
            {t("Appliquer les dossiers et scanner")}
          </button>
        </div>
      </form>
      <p class="muted">
        {t(
          "Le scan découvre les nouveaux fichiers. Les changements de dossiers sont appliqués au lancement ; retirer une ligne ne supprime aucun fichier audio. La synchronisation recharge ensuite le catalogue connu.",
        )}
      </p>
    </section>
  );
}
