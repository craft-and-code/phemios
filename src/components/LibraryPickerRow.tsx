import { Show, type JSX } from "solid-js";
import { Icon } from "./Icon";
/** Shared searchable catalogue row leaves its action and permission to the owning workflow. */
export function LibraryPickerRow(props: {
  title: string;
  detail: JSX.Element;
  detailTitle?: string | undefined;
  reason?: string | undefined;
  image?: string | undefined;
  icon?: string | undefined;
  action: JSX.Element;
}) {
  return (
    <div class="queue-add-row library-picker-row">
      <div class="queue-add-art">
        <Show when={props.image} fallback={<Icon name={props.icon ?? "disc"} />}>
          {(url) => <img src={url()} alt="" decoding="async" />}
        </Show>
      </div>
      <div class="queue-add-description">
        <strong title={props.title}>{props.title}</strong>
        <small title={props.detailTitle}>{props.detail}</small>
        <Show when={props.reason}>
          <small class="queue-add-reason">{props.reason}</small>
        </Show>
      </div>
      {props.action}
    </div>
  );
}
