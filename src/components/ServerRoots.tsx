import { createEffect, createSignal, For, on } from "solid-js";
import { useLibrary } from "../library/context";
import { readServerRoots } from "../library/server-roots";
import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { RefreshButton } from "./RefreshButton";
import { ActionButton } from "./ActionButton";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { Feedback } from "./Feedback";

/** Aède owns remote folders; Phémios displays confirmed roots without maintaining an editable copy. */
export function ServerRoots(props: { busy: boolean; revision: number; scan: () => void }) {
  const library = useLibrary();
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
      return session
        ? { session, revision: props.revision, catalogue: library.publicSnapshot("server") }
        : false;
    },
    async (key, admission) =>
      readServerRoots(
        (offset) =>
          requestAede(
            "/api/v1/roots",
            { offset: String(offset), limit: "200" },
            "GET",
            null,
            "server",
            key.session,
          ),
        admission.current,
      ),
  );
  return (
    <section class="server-roots">
      <div class="section-heading">
        <h3>{t("Dossiers fournis par Aède")}</h3>
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
      <ul class="server-root-rows">
        <For each={read.current()}>
          {(path) => (
            <li>
              <code>{path}</code>
            </li>
          )}
        </For>
      </ul>
      <ActionButton
        type="button"
        icon="search"
        busy={props.busy}
        disabled={read.pending() || !read.current()?.length}
        onClick={props.scan}
      >
        {t("Scanner les dossiers du serveur")}
      </ActionButton>
      <p class="muted">
        {t(
          "Les dossiers sont gérés dans l’application Aède ou avec la CLI. Phémios recharge automatiquement le catalogue après un scan.",
        )}
      </p>
    </section>
  );
}
