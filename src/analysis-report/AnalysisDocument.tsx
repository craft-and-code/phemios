import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { AnalysisReport, type AnalysisReportProps } from "./AnalysisReport";
import { french, integrityReading } from "./presentation";
import { analysisModel } from "./model";
import { Icon } from "../components/Icon";
/** Album imports retain order and render only the selected track's detailed measurements. */
export function AnalysisDocument(
  props: Omit<AnalysisReportProps, "analysis" | "title"> & { files: readonly unknown[] },
) {
  const [index, setIndex] = createSignal(0);
  createEffect(() => {
    void props.files;
    setIndex(0);
  });
  const selected = () => Math.min(index(), Math.max(0, props.files.length - 1));
  const tr = () => props.translate ?? french;
  const names = createMemo(() =>
    props.files.map((file, i) => {
      const model = analysisModel(file);
      return {
        name: model.filename || tr()("Piste {0}", i + 1),
        ...integrityReading(model),
      };
    }),
  );
  return (
    <div class="analysis-document">
      <Show when={props.files.length > 1}>
        <nav class="far-files" aria-label={tr()("Pistes du rapport")}>
          <div class="far-files-heading">
            <p>{tr()("{0} pistes dans le rapport", props.files.length)}</p>
            <span
              role="img"
              aria-label={tr()("Intégrité audio")}
              title={tr()("Intégrité audio")}
              classList={{
                "far-good": names().length > 0 && names().every((file) => file.tone === "good"),
              }}
            >
              <Icon name="integrity" />
            </span>
          </div>
          <For each={names()}>
            {(file, i) => (
              <button
                type="button"
                aria-current={selected() === i() ? "true" : undefined}
                onClick={() => setIndex(i())}
              >
                <span>{i() + 1}.</span>
                <span>{file.name}</span>
                <span
                  class={`far-${file.tone}`}
                  role="img"
                  aria-label={tr()(file.label)}
                  title={`${tr()(file.label)} · ${tr()(file.detail)}`}
                >
                  <Icon
                    name={
                      file.tone === "bad"
                        ? "close"
                        : file.tone === "good"
                          ? "check"
                          : file.tone === "warning"
                            ? "missing"
                            : "minus"
                    }
                  />
                </span>
              </button>
            )}
          </For>
        </nav>
      </Show>
      <AnalysisReport
        analysis={props.files[selected()]}
        locale={props.locale}
        translate={props.translate}
        initialDetail={props.initialDetail}
        initialSections={props.initialSections}
        sections={props.sections}
        onSectionsChange={props.onSectionsChange}
      />
    </div>
  );
}
