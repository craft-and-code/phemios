import { useLibrary } from "../library/context";
import { queueAppendReason } from "../library/queue-append-policy";
import { QueueAppendView } from "./QueueAppendView";
/** Account admission and native append are shared by square list actions and circular catalogue badges. */
export function QueueAppend(props: {
  reference: string;
  title: string;
  class?: string | undefined;
  disabled?: boolean | undefined;
  load?: ((current: () => boolean) => Promise<unknown>) | undefined;
}) {
  const library = useLibrary();
  return (
    <QueueAppendView
      reference={props.reference}
      title={props.title}
      class={props.class}
      disabled={props.disabled}
      scope={library.sessionFor(props.reference)}
      reason={queueAppendReason(props.reference, {
        role: library.player.canStart(props.reference)
          ? library.sessionFor(props.reference)?.account.role
          : undefined,
        busy: library.player.busy() || library.player.appending(),
        device: library.player.device(),
        first: library.player.queue()[0]?.reference,
      })}
      onAppend={() => library.player.appendReference(props.reference, props.load)}
    />
  );
}
