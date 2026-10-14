import { useLibrary } from "../library/context";
import { CoverPlayView } from "./CoverPlayView";
/** Native/account admission wraps the shared Play presentation without changing queue semantics. */
export function CoverPlay(props: {
  reference: string;
  title: string;
  class?: string;
  disabled?: boolean;
}) {
  const library = useLibrary();
  return (
    <CoverPlayView
      reference={props.reference}
      title={props.title}
      class={props.class}
      disabled={
        props.disabled ||
        !library.sessionFor(props.reference) ||
        library.sessionFor(props.reference)?.account.role === "auditor" ||
        library.player.busy()
      }
      onPlay={() => library.player.startReference(props.reference)}
    />
  );
}
