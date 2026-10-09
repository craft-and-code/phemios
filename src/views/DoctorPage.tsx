import { EmptyState } from "../components/EmptyState";
import { t } from "../i18n";
import { createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { issueLabels, parseDoctor, severityLabels, type Severity } from "../library/doctor";
import { numberLabel } from "../library/statistics";
import { Icon } from "../components/Icon";
/** Read the existing Aède Doctor contract with severity filters and bounded pagination. */
export function DoctorPage() {
  const library = useLibrary(),
    [severity, setSeverity] = createSignal<Severity | "">(""),
    [offset, setOffset] = createSignal(0);
  const [report, { refetch }] = createResource(
    () =>
      library.session()
        ? { session: library.session(), severity: severity(), offset: offset() }
        : false,
    async (key) =>
      parseDoctor(
        await requestAede("/api/v1/doctor", {
          offset: String(key.offset),
          limit: "50",
          ...(key.severity ? { severity: key.severity } : {}),
        }),
        key.offset,
      ),
  );
  return (
    <section class="page doctor-page">
      <div class="section-heading">
        <p class="intro">{t("Diagnostic de la bibliothèque, sans modification des fichiers.")}</p>
        <button
          class="icon-button quiet"
          aria-label={t("Actualiser Doctor")}
          title={t("Actualiser Doctor")}
          disabled={!library.session() || report.loading}
          onClick={() => refetch()}
        >
          <Icon name="refresh" />
        </button>
      </div>
      <div class="choices" aria-label={t("Sévérité des diagnostics")}>
        <button
          aria-pressed={!severity()}
          onClick={() => {
            setOffset(0);
            setSeverity("");
          }}
        >
          {t("Tous")}{" "}
        </button>
        <For each={["error", "warning", "info"] as const}>
          {(value) => (
            <button
              aria-pressed={severity() === value}
              onClick={() => {
                setOffset(0);
                setSeverity(value);
              }}
            >
              {t(severityLabels[value])}
            </button>
          )}
        </For>
      </div>
      <Show when={!library.session()}>
        <p class="notice">{t("Connectez Aède pour lire les diagnostics.")}</p>
      </Show>
      <Show when={report.loading}>
        <p role="status">{t("Lecture des diagnostics…")}</p>
      </Show>
      <Show when={report.error}>
        <p role="alert">
          {t("Doctor indisponible :")} {String(report.error)}
        </p>
      </Show>
      <Show when={report() && !report.loading && !report.error}>
        {(_ready) => (
          <>
            <div class="doctor-summary">
              <For each={["error", "warning", "info"] as const}>
                {(value) => (
                  <div class={`doctor-count ${value}`}>
                    <strong>{numberLabel(report()!.summary[value])}</strong>
                    <span>{t(severityLabels[value])}</span>
                  </div>
                )}
              </For>
            </div>
            <p class="muted">
              {numberLabel(report()!.unverified_files)}{" "}
              {t("fichiers sans vérification enregistrée ·")}{" "}
              {numberLabel(report()!.pending_analyses)}{" "}
              {t("analyses en attente. Les raisons détaillées sont celles d’Aède.")}{" "}
            </p>
            <Show
              when={report()!.total}
              fallback={
                <EmptyState icon="doctor">{t("Aucun diagnostic dans cette sélection.")}</EmptyState>
              }
            >
              <ul class="doctor-issues">
                <For each={report()!.items}>
                  {(issue) => (
                    <li class={issue.severity}>
                      <span class="doctor-severity">{t(severityLabels[issue.severity])}</span>
                      <h2>{t(issueLabels[issue.type] ?? issue.label)}</h2>
                      <p>{issue.detail}</p>
                      <Show when={issue.file_count}>
                        <details>
                          <summary>
                            {numberLabel(issue.file_count)} {t("fichier(s) concerné(s)")}
                          </summary>
                          <ul>
                            <For each={issue.files}>
                              {(file) => (
                                <li>
                                  <code>{file}</code>
                                </li>
                              )}
                            </For>
                          </ul>
                          <Show when={issue.files_truncated}>
                            <small>{t("Aède limite cet aperçu aux 20 premiers chemins.")}</small>
                          </Show>
                        </details>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
              <div class="page-heading">
                <button
                  disabled={offset() === 0}
                  onClick={() => setOffset(Math.max(0, offset() - 50))}
                >
                  {t("Précédents")}{" "}
                </button>
                <span>
                  {offset() + 1}–{Math.min(offset() + 50, report()!.total)} /{" "}
                  {numberLabel(report()!.total)}
                </span>
                <button
                  disabled={offset() + 50 >= report()!.total}
                  onClick={() => setOffset(offset() + 50)}
                >
                  {t("Suivants")}{" "}
                </button>
              </div>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
