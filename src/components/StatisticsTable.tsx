import { PageLoader } from "./PageLoader";
import { t } from "../i18n";
import { createResource, createSignal, For, Show } from "solid-js";
import { numberLabel, type Page, type Statistics } from "../library/statistics";
export interface StatRow {
  label: string;
  count: number;
  extra?: string;
  reference?: string | null;
}
/** Independent bounded pagination keeps every ranking accessible without rendering all rows. */
export function StatisticsTable(props: {
  title: string;
  unit: string;
  first: Statistics;
  read: (offset: number) => Promise<Statistics>;
  rows: (report: Statistics) => Page<StatRow>;
}) {
  const [offset, setOffset] = createSignal(0);
  const [report, { refetch }] = createResource(offset, (at) =>
    at ? props.read(at) : Promise.resolve(props.first),
  );
  const page = () => props.rows(report() ?? props.first);
  const max = () => Math.max(1, ...page().items.map((row) => row.count));
  return (
    <section class="stat-table">
      <h2>{props.title}</h2>
      <small>{props.unit}</small>
      <Show when={report.loading}>
        <PageLoader inline />
      </Show>
      <Show when={report.error}>
        <p role="alert">{String(report.error)}</p>
        <button onClick={() => refetch()}>{t("Réessayer")}</button>
      </Show>
      <Show when={!report.loading && !report.error}>
        <Show
          when={page().items.length}
          fallback={<p class="muted">{t("Aucune donnée enregistrée.")}</p>}
        >
          <ol>
            <For each={page().items}>
              {(row) => (
                <li>
                  <span class="stat-label">
                    <Show when={row.reference} fallback={row.label}>
                      {(ref) => <a href={`#/artist/${encodeURIComponent(ref())}`}>{row.label}</a>}
                    </Show>
                    <small>{row.extra}</small>
                  </span>
                  <span class="stat-bar" aria-hidden="true">
                    <span style={{ width: `${(row.count / max()) * 100}%` }} />
                  </span>
                  <strong>{numberLabel(row.count)}</strong>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </Show>
      <Show when={page().total > 50}>
        <div class="stat-pagination">
          <button
            disabled={offset() === 0 || report.loading}
            onClick={() => setOffset(Math.max(0, offset() - 50))}
          >
            {t("Précédent")}{" "}
          </button>
          <span>
            {offset() + 1}–{Math.min(offset() + 50, page().total)} / {numberLabel(page().total)}
          </span>
          <button
            disabled={offset() + 50 >= page().total || report.loading}
            onClick={() => setOffset(offset() + 50)}
          >
            {t("Suivant")}{" "}
          </button>
        </div>
      </Show>
    </section>
  );
}
