import { Show, splitProps, type JSX } from "solid-js";
import { Icon } from "./Icon";
/** Form actions share icon/label geometry and replace their glyph during confirmed work. */
export function ActionButton(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; busy?: boolean },
) {
  const [own, rest] = splitProps(props, ["icon", "busy", "class", "children", "disabled"]);
  return (
    <button
      {...rest}
      class={`action-button ${own.class ?? ""}`}
      disabled={own.disabled || own.busy}
      aria-busy={own.busy || undefined}
    >
      <Show
        when={own.busy}
        fallback={<Show when={own.icon}>{(icon) => <Icon name={icon()} />}</Show>}
      >
        <span class="spinner" aria-hidden="true" />
      </Show>
      <span>{own.children}</span>
    </button>
  );
}
