import { AnalysisImportView } from "./AnalysisImportView";
import { isNative, importAnalysis } from "../platform/desktop";
/** File selection is the only native boundary; imports do not require an Aède account. */
export function AnalysisImport(props: {
  onImport: (files: unknown[]) => void;
  onError: (message: string) => void;
}) {
  return <AnalysisImportView {...props} select={isNative() ? importAnalysis : undefined} />;
}
