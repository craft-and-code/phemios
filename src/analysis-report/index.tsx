import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { AnalysisDocument } from "./AnalysisDocument";
import { parseAnalysisDocument } from "./model";
import type { AnalysisSection } from "./disclosure";
export { analysisSectionIds } from "./disclosure";
export type { AnalysisSection } from "./disclosure";
import type { ReportTranslate } from "./presentation";
export { AnalysisReport } from "./AnalysisReport";
export { AnalysisDocument } from "./AnalysisDocument";
export { parseAnalysisDocument } from "./model";
export type { Gauge as AnalysisGauge, Event as AnalysisEvent } from "./measurements";
export type { AnalysisReportProps } from "./AnalysisReport";
/** Framework-neutral host contract. The bundle includes its small Solid runtime, with no app services. */
export interface AnalysisMountOptions {
  document: string;
  locale?: string;
  translate?: ReportTranslate;
  /** Initial-only compatibility alias: expands every disclosure rather than selecting a view. */
  detailed?: boolean;
  sections?: AnalysisSection[];
  onSectionsChange?: (sections: AnalysisSection[]) => void;
}
/** Mount into an empty, host-owned element; update atomically validates before replacing the current report. */
export function mountAnalysisReport(element: HTMLElement, options: AnalysisMountOptions) {
  const initial = { ...options, files: parseAnalysisDocument(options.document) };
  const [state, setState] = createSignal(initial);
  const dispose = render(
    () => (
      <AnalysisDocument
        files={state().files}
        locale={state().locale}
        translate={state().translate}
        initialDetail={state().detailed}
        initialSections={state().sections}
        onSectionsChange={state().onSectionsChange}
      />
    ),
    element,
  );
  let disposed = false;
  return {
    update(next: AnalysisMountOptions) {
      if (disposed) throw new Error("Analysis report is disposed.");
      const files = parseAnalysisDocument(next.document);
      setState({ ...next, files });
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        dispose();
        setState({ document: "", files: [] });
      }
    },
  };
}
