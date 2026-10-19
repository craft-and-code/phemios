import type { JSX } from "solid-js";
import { locale, t } from "../i18n";
import { AnalysisReport } from "../analysis-report/AnalysisReport";
import type { AnalysisSection } from "../analysis-report/disclosure";
/** Native-independent wrapper; preference ownership stays with the calling App surface. */
export function AnalysisCharts(props: {
  analysis: unknown;
  actions?: JSX.Element;
  sections?: readonly AnalysisSection[];
  onSectionsChange?: (sections: AnalysisSection[]) => void;
}) {
  return <AnalysisReport {...props} locale={locale()} translate={t} />;
}
