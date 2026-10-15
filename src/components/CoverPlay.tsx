import { Switch, Match } from "solid-js";
import { CircularPlaybackActionsView } from "./CircularPlaybackActionsView";
import { QueueAppend } from "./QueueAppend";
import { PlaybackActionsView } from "./PlaybackActionsView";
import { useLibrary } from "../library/context";
import { CoverPlayView } from "./CoverPlayView";
/** Lists use paired square actions; circular catalogue controls opt into a persistent corner badge. */
export function CoverPlay(props: {
  reference: string;
  title: string;
  class?: string;
  disabled?: boolean;
  append?: boolean | "badge" | undefined;
  detail?: boolean;
  label?: string;
  onPlay?: (() => void | Promise<void>) | undefined;
}) {
  const library = useLibrary();
  const play = () => (
    <CoverPlayView
      reference={props.reference}
      title={props.title}
      class={props.class}
      variant={props.detail ? "detail" : "cover"}
      label={props.label}
      disabled={
        props.disabled || !library.player.canStart(props.reference) || library.player.busy()
      }
      onPlay={async () => {
        if (props.onPlay) await props.onPlay();
        else await library.player.startReference(props.reference);
      }}
    />
  );
  return (
    <Switch fallback={play()}>
      <Match when={props.append === "badge"}>
        <CircularPlaybackActionsView
          play={play()}
          append={
            <QueueAppend
              reference={props.reference}
              title={props.title}
              disabled={props.disabled}
            />
          }
        />
      </Match>
      <Match when={props.append === true}>
        <PlaybackActionsView
          class={props.class}
          append={
            <QueueAppend
              reference={props.reference}
              title={props.title}
              class={`cover-play ${props.class ?? ""}`}
              disabled={props.disabled}
            />
          }
          play={play()}
        />
      </Match>
    </Switch>
  );
}
