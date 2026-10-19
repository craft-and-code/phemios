import { analysisSectionIds, changeAnalysisSection, type AnalysisSection } from "./disclosure";
import { ReportDisclosure } from "./ReportDisclosure";
import { AnalysisTechnical } from "./AnalysisTechnical";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Icon } from "../components/Icon";
import { analysisModel, type AnalysisModel } from "./model";
import { french, integrityReading, type ReportTranslate } from "./presentation";
import { AnalysisIdentity } from "./AnalysisIdentity";
import { AnalysisMeasures } from "./AnalysisMeasures";
import "./report.css";
/** Props-only report: no IPC, account, storage, network or source-file access. */
export interface AnalysisReportProps {
  analysis: unknown;
  title?: string | undefined;
  locale?: string | undefined;
  translate?: ReportTranslate | undefined;
  /** Initial-only expansion for standalone hosts; controlled sections take precedence. */
  initialDetail?: boolean | undefined;
  initialSections?: readonly AnalysisSection[] | undefined;
  sections?: readonly AnalysisSection[] | undefined;
  onSectionsChange?: ((sections: AnalysisSection[]) => void) | undefined;
}
/** Independent disclosures share retained evidence and may be controlled by host-owned preferences. */
export function AnalysisReport(props: AnalysisReportProps) {
  const [localSections, setLocalSections] = createSignal<readonly AnalysisSection[]>(
    props.initialSections ?? (props.initialDetail ? analysisSectionIds : []),
  );
  const sections = () => props.sections ?? localSections();
  const expanded = (id: AnalysisSection) => sections().includes(id);
  const change = (next: AnalysisSection[]) => {
    if (props.sections === undefined) setLocalSections(next);
    props.onSectionsChange?.(next);
  };
  const toggle = (id: AnalysisSection, open: boolean) =>
    change(changeAnalysisSection(sections(), id, open));
  const tr: ReportTranslate = (...args) => (props.translate ?? french)(...args);
  const result = createMemo(() => {
    try {
      return { data: analysisModel(props.analysis) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
  const checksum = (data: AnalysisModel) => integrityReading(data);
  return (
    <Show
      when={result().data}
      fallback={
        <p class="far-error" role="alert">
          {tr("Analyse indisponible :")} {tr(result().error ?? "")}
        </p>
      }
    >
      {(data) => (
        <article class="flac-analysis-report" lang={props.locale ?? "fr"}>
          <header class="far-header">
            <div>
              <p class="far-kicker">FlacCompagnon</p>
              <Show when={props.title || data().filename}>
                <h2>{props.title || data().filename}</h2>
              </Show>
              <Show when={data().stale !== false}>
                <small class="far-muted">
                  {tr(
                    data().stale
                      ? "Rapport historique · fichier modifié"
                      : "Rapport conservé · fichier actuel non vérifié",
                  )}
                </small>
              </Show>
            </div>
            <button
              class="far-expansion"
              type="button"
              title={tr(sections().length ? "Tout replier" : "Tout déplier")}
              aria-label={tr(sections().length ? "Tout replier" : "Tout déplier")}
              aria-expanded={sections().length > 0}
              onClick={() => change(sections().length ? [] : [...analysisSectionIds])}
            >
              <Icon name="chevron-down" />
            </button>
          </header>
          <section
            class={`far-integrity far-${checksum(data()).tone}`}
            aria-label={tr("Intégrité audio")}
          >
            <div class="far-integrity-heading">
              <strong>
                <Icon
                  name={
                    checksum(data()).tone === "bad"
                      ? "close"
                      : checksum(data()).tone === "good"
                        ? "check"
                        : checksum(data()).tone === "warning"
                          ? "missing"
                          : "minus"
                  }
                />
                {tr(checksum(data()).label)}
              </strong>
              <span class="far-shield">
                <Icon name="integrity" />
              </span>
            </div>
            <p>{tr(checksum(data()).detail)}</p>
            <ReportDisclosure
              label={tr("Voir le détail du contrôle")}
              open={expanded("integrity")}
              onChange={(open) => toggle("integrity", open)}
            >
              <p>{tr(checksum(data()).proof)}</p>
              <Show when={data().md5Detail}>
                <p class="far-diagnostic">{data().md5Detail}</p>
              </Show>
              <p>
                {tr("L’intégrité audio ne note ni le mastering ni l’origine de l’enregistrement.")}
              </p>
            </ReportDisclosure>
          </section>
          <Show when={data().error}>
            <div class="far-observation far-error" role="alert">
              <Icon name="missing" />
              <div>
                <strong>{tr("Analyse incomplète")}</strong>
                <p class="far-diagnostic">{data().error}</p>
              </div>
            </div>
          </Show>
          <section class="far-detection">
            <div class="far-detection-heading">
              <h3>{tr("Détection")}</h3>
              <div class="far-badges">
                <For each={data().labels}>
                  {(label) => (
                    <span
                      classList={{ "far-warning": label !== "Clean" && label !== "Non analysé" }}
                    >
                      <Show when={label !== "Clean" && label !== "Non analysé"}>
                        <Icon name="missing" />
                      </Show>
                      {tr(label)}
                    </span>
                  )}
                </For>
              </div>
            </div>
            <p>
              {tr(
                data().labels.includes("Clean")
                  ? "Aucun indice dans les contrôles réalisés. Ce résultat ne certifie pas l’origine de l’enregistrement."
                  : "Les détections sont des indices à examiner, indépendants du résultat MD5.",
              )}
            </p>
            <ReportDisclosure
              label={tr("Comprendre la détection")}
              open={expanded("detection")}
              onChange={(open) => toggle("detection", open)}
            >
              <For each={data().checks}>
                {(check) => (
                  <div class="far-check">
                    <span>{tr(check.name)}</span>
                    <strong classList={{ "far-warning": check.value === true }}>
                      {check.value === true && <Icon name="missing" />}
                      {tr(
                        check.value === true
                          ? "Détecté"
                          : check.value === false
                            ? "Non détecté"
                            : "Non renseigné",
                      )}
                    </strong>
                  </div>
                )}
              </For>
              <Show when={data().detail}>
                <p class="far-diagnostic">{data().detail}</p>
              </Show>
            </ReportDisclosure>
          </section>
          <ReportDisclosure
            label={tr("Le fichier et le signal")}
            open={expanded("identity")}
            onChange={(open) => toggle("identity", open)}
            section
          >
            <AnalysisIdentity data={data()} tr={tr} locale={props.locale ?? "fr"} />
          </ReportDisclosure>
          <AnalysisMeasures
            data={data()}
            expanded={expanded("measurements")}
            onExpandedChange={(open) => toggle("measurements", open)}
            tr={tr}
            locale={props.locale ?? "fr"}
          />
          <AnalysisTechnical
            data={data()}
            tr={tr}
            locale={props.locale ?? "fr"}
            expanded={expanded("technical")}
            onExpandedChange={(open) => toggle("technical", open)}
          />
          <Show when={data().missing.length}>
            <ReportDisclosure
              label={tr("Mesures non fournies par ce rapport")}
              open={expanded("coverage")}
              onChange={(open) => toggle("coverage", open)}
              section
            >
              <p>
                {data()
                  .missing.map((label) => tr(label))
                  .join(" · ")}
              </p>
              <Show when={data().coverage}>
                <p>
                  {tr("Analyses demandées :")} {data().coverage?.join(" · ")}
                </p>
              </Show>
              <p>
                {tr(
                  "Une valeur absente n’est pas zéro. Aucune mesure n’est déduite des autres pistes.",
                )}
              </p>
            </ReportDisclosure>
          </Show>
          <Show when={data().fileMd5 || data().crc32}>
            <ReportDisclosure
              label={tr("Empreintes du fichier")}
              open={expanded("fingerprints")}
              onChange={(open) => toggle("fingerprints", open)}
              section
            >
              <p>
                {tr(
                  "Elles identifient les octets, tags et images compris. Sans référence à comparer, elles ne constituent pas un verdict d’intégrité.",
                )}
              </p>
              <dl>
                <Show when={data().fileMd5}>
                  <dt>{tr("MD5 du fichier")}</dt>
                  <dd>
                    <code>{data().fileMd5}</code>
                  </dd>
                </Show>
                <Show when={data().crc32}>
                  <dt>{tr("CRC32 du fichier")}</dt>
                  <dd>
                    <code>{data().crc32}</code>
                  </dd>
                </Show>
              </dl>
            </ReportDisclosure>
          </Show>
        </article>
      )}
    </Show>
  );
}
