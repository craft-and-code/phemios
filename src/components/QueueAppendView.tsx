import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Add is separate from Play/navigation; its acknowledgement never moves surrounding controls. */
export function QueueAppendView(props: {
  reference: string;
  title: string;
  class?: string | undefined;
  scope?: object | undefined;
  disabled?: boolean | undefined;
  reason?: string | undefined;
  onAppend: () => Promise<number>;
}) {
  const [pending, setPending] = createSignal(false),
    [added, setAdded] = createSignal(false);
  let disposed = false,
    revision = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => [props.reference, props.scope],
      () => {
        revision++;
        clearTimeout(timer);
        setAdded(false);
        setPending(false);
      },
    ),
  );
  onCleanup(() => {
    disposed = true;
    revision++;
    clearTimeout(timer);
  });
  async function append(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (props.disabled || props.reason || pending()) return;
    const held = revision;
    setPending(true);
    setAdded(false);
    try {
      const count = await props.onAppend();
      if (!disposed && held === revision && count > 0) {
        setAdded(true);
        clearTimeout(timer);
        timer = setTimeout(() => setAdded(false), 2000);
      }
    } finally {
      if (!disposed && held === revision) setPending(false);
    }
  }
  return (
    <button
      type="button"
      class={`icon-button quiet queue-append ${props.class ?? ""}`}
      classList={{ "download-complete": added() }}
      disabled={props.disabled || !!props.reason || pending()}
      aria-label={t("Ajouter {0} à la suite", props.title)}
      title={
        props.reason ||
        (added() ? t("Ajouté à la liste de lecture") : t("Ajouter {0} à la suite", props.title))
      }
      aria-busy={pending()}
      data-append-reference={props.reference}
      onClick={(event) => void append(event)}
    >
      <Icon name={added() ? "check" : "plus"} />
    </button>
  );
}
