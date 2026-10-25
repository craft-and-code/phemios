import { Show, type JSX } from "solid-js";
/** Reports supply their own heading; a framed spectrum keeps its title, actions and 16px content gap. */
export function TrackResultPanel(props: {
  id?: string;
  title?: string;
  label?: string;
  framed?: boolean;
  actions?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section
      id={props.id}
      aria-label={props.label ?? props.title}
      class="track-analysis"
      classList={{ "track-result-panel": !!props.framed }}
    >
      <Show when={props.title}>
        <div class="analysis-result-heading">
          <strong>{props.title}</strong>
          {props.actions}
        </div>
      </Show>
      {props.children}
    </section>
  );
}
