import { useViewSession } from "../navigation/ViewSession";
import { Feedback } from "../components/Feedback";
import { Pagination } from "../components/Pagination";
import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { AccountNotice } from "../components/AccountNotice";
import { EmptyState } from "../components/EmptyState";
import { t } from "../i18n";
import { createSignal, For, Show } from "solid-js";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { issueLabels, parseDoctor, severityLabels } from "../library/doctor";
import { numberLabel } from "../library/statistics";
/** Read the existing Aède Doctor contract with severity filters and bounded pagination. */
export function DoctorPage() {
  const library = useLibrary(),
    [severity, setSeverity] = useViewSession().control("doctorSeverity"),
    [offset, setOffset] = createSignal(0);
  const report = createDiagnosticRead(
    () =>
      library.session()
        ? {
            session: library.session(),
            source: library.source(),
            severity: severity(),
            offset: offset(),
          }
        : false,
    async (key) =>
      parseDoctor(
        await requestAede(
          "/api/v1/doctor",
          {
            offset: String(key.offset),
            limit: "50",
            ...(key.severity ? { severity: key.severity } : {}),
          },
          "GET",
          null,
          key.source,
        ),
        key.offset,
      ),
  );
  return (
    <section class="page result-page doctor-page">
      <StickyHeader visible={!!library.session()}>
        <div class="doctor-toolbar">
          <div class="choices" aria-label={t("Sévérité des diagnostics")}>
            <button
              aria-pressed={!severity()}
              onClick={() => {
                setOffset(0);
                setSeverity("");
              }}
            >
              {t("Tous")}
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
          <RefreshButton
            identity={library.session()}
            label={t("Actualiser le diagnostic")}
            busy={report.loading()}
            disabled={!library.session() || (report.pending() && !report.loading())}
            onCancel={report.cancel}
            onRefresh={report.refetch}
          />
        </div>
      </StickyHeader>
      <AccountNotice />
      <Show when={!library.session()}>
        <EmptyState icon="doctor">{t("Aucun diagnostic dans cette sélection.")}</EmptyState>
      </Show>
      <Show when={report.loading()}>
        <span class="sr-only" role="status">
          {t("Lecture des diagnostics…")}
        </span>
      </Show>
      <Show when={report.error()}>
        <Feedback error persistent message={String(report.error())} />
      </Show>
      <Show when={report.current()}>
        {(ready) => (
          <>
            <div class="doctor-summary">
              <For each={["error", "warning", "info"] as const}>
                {(value) => (
                  <div class={`doctor-count ${value}`}>
                    <strong>{numberLabel(ready().summary[value])}</strong>
                    <span>{t(severityLabels[value])}</span>
                  </div>
                )}
              </For>
            </div>
            <p class="muted">
              {numberLabel(ready().unverified_files)}{" "}
              {t("fichiers sans vérification enregistrée ·")}{" "}
              {numberLabel(ready().pending_analyses)}{" "}
              {t("analyses en attente. Les raisons détaillées sont celles d’Aède.")}{" "}
            </p>
            <Show
              when={ready().total}
              fallback={
                <EmptyState icon="doctor">{t("Aucun diagnostic dans cette sélection.")}</EmptyState>
              }
            >
              <ul class="doctor-issues">
                <For each={ready().items}>
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
              <Pagination
                offset={offset()}
                size={50}
                total={ready().total}
                count={ready().items.length}
                busy={report.pending()}
                onOffset={setOffset}
              />
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
