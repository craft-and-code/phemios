import { RefreshButton } from "./RefreshButton";
import { t } from "../i18n";
import type { Job } from "../library/jobs";
import type { SourceId } from "../library/sources";
export interface TaskRecovery {
  source: SourceId;
  task: number;
}
/** One recovery owns one control even when the source-level request restores several task rows. */
export function TaskRecoveryButton(props: {
  identity?: unknown;
  job: Pick<Job, "source" | "task_id">;
  active: TaskRecovery | undefined;
  onRefresh: (event: MouseEvent, signal: AbortSignal) => unknown;
}) {
  const busy = () =>
    props.active?.source === (props.job.source ?? "server") &&
    props.active?.task === props.job.task_id;
  return (
    <RefreshButton
      identity={props.identity}
      label={t("Réessayer")}
      busy={busy()}
      disabled={!!props.active && !busy()}
      onRefresh={props.onRefresh}
    />
  );
}
