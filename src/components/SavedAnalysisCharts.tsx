import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { createToolPreferences } from "../library/tool-preferences";
import { AnalysisCharts } from "./AnalysisCharts";
import { Feedback } from "./Feedback";
/** Account-owned expansion is synchronized by the existing preferences controller, outside the reusable report. */
export function SavedAnalysisCharts(props: { analysis: unknown; actions?: JSX.Element }) {
  const settings = createToolPreferences();
  return (
    <>
      <Show when={settings.error()}>
        <Feedback error persistent message={settings.error()} />
      </Show>
      <AnalysisCharts
        analysis={props.analysis}
        actions={props.actions}
        sections={settings.value().analysisSections}
        onSectionsChange={(analysisSections) => settings.update({ analysisSections })}
      />
    </>
  );
}
