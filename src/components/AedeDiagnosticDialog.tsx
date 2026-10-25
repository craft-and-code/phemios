import { For, onCleanup, onMount, Show } from "solid-js";
import { locale, t } from "../i18n";
import type { AedeDiagnostic, AedeDiagnosticKind } from "../library/aede-diagnostics";
import { sourceLabel } from "../library/sources";
import { Icon } from "./Icon";

const descriptions: Record<AedeDiagnosticKind, string> = {
  "personal-data": "Données personnelles illisibles",
  server: "Erreur interne d’Aède",
  connection: "Connexion indisponible",
  request: "Requête refusée",
};
/** Current-session summaries only; native dialog behavior contains focus and restores the trigger. */
export function AedeDiagnosticDialog(props: {
  rows: readonly AedeDiagnostic[];
  onClose: () => void;
}) {
  let dialog: HTMLDialogElement | undefined;
  let heading: HTMLHeadingElement | undefined;
  onMount(() => {
    dialog?.showModal();
    heading?.focus();
  });
  onCleanup(() => dialog?.close());
  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class="aede-diagnostic-dialog"
      aria-label={t("Diagnostic Aède")}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div class="section-heading">
        <h2
          ref={(element) => {
            heading = element;
          }}
          tabindex="-1"
        >
          {t("Diagnostic Aède")}
        </h2>
        <button
          class="icon-button quiet icon-close"
          aria-label={t("Fermer le diagnostic")}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        {t(
          "Ce journal conserve les 64 dernières erreurs des connexions en cours, jusqu’à leur déconnexion.",
        )}
      </p>
      <Show when={props.rows.some((row) => row.kind === "personal-data")}>
        <p class="notice">
          {t(
            "Vérifiez que la version du moteur Aède est compatible avec vos données personnelles. Une mise à jour peut être nécessaire.",
          )}
        </p>
      </Show>
      <Show
        when={props.rows.length}
        fallback={<p>{t("Les prochaines erreurs de cette session apparaîtront ici.")}</p>}
      >
        <div class="aede-diagnostic-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Heure")}</th>
                <th>{t("Bibliothèque")}</th>
                <th>{t("Opération")}</th>
                <th>{t("Résultat")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(row) => (
                  <tr>
                    <td>
                      <time datetime={new Date(row.at).toISOString()}>
                        {new Date(row.at).toLocaleTimeString(locale())}
                      </time>
                    </td>
                    <td>{sourceLabel(row.source)}</td>
                    <td>
                      <code>
                        {row.method} {row.route}
                      </code>
                    </td>
                    <td>{t(descriptions[row.kind])}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </dialog>
  );
}
