import { createSignal, createUniqueId, For, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { nextChoice } from "../library/choices";
/** Themed single choice with keyboard selection, outside dismissal and a viewport-bound popup. */
export function ChoiceSelect(props: {
  value: string | number;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  onFocus?: () => void;
}) {
  const id = createUniqueId(),
    [open, setOpen] = createSignal(false),
    [active, setActive] = createSignal(0),
    [position, setPosition] = createSignal({ left: 0, top: 0, width: 0 });
  let trigger!: HTMLButtonElement, popup: HTMLDivElement | undefined;
  function show() {
    if (props.disabled) return;
    props.onFocus?.();
    const rect = trigger.getBoundingClientRect(),
      height = Math.min(280, props.options.length * 38 + 12);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      top:
        rect.bottom + height + 8 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - height - 4),
      width: rect.width,
    });
    const selected = props.options.findIndex((row) => row.value === String(props.value));
    setActive(
      selected >= 0 && !props.options[selected]?.disabled
        ? selected
        : nextChoice(props.options, -1, 1),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const row = props.options[index];
    if (row && !row.disabled) {
      props.onChange(row.value);
      setOpen(false);
      trigger.focus();
    }
  }
  function keys(event: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open()) {
        show();
        return;
      }
      setActive(
        nextChoice(
          props.options,
          event.key === "Home" ? -1 : event.key === "End" ? props.options.length : active(),
          ["ArrowUp", "End"].includes(event.key) ? -1 : 1,
        ),
      );
      popup?.querySelector(`[data-choice="${active()}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open()) choose(active());
      else show();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      const match = props.options.findIndex(
        (row) =>
          !row.disabled && row.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
      );
      if (match >= 0) {
        event.preventDefault();
        if (!open()) show();
        setActive(match);
      }
    }
  }
  onMount(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.contains(event.target) &&
        !popup?.contains(event.target)
      )
        setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    onCleanup(() => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    });
  });
  return (
    <>
      <button
        ref={(element) => {
          trigger = element;
        }}
        type="button"
        class="choice-select"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={`${id}-choices`}
        aria-activedescendant={open() ? `${id}-choice-${active()}` : undefined}
        aria-label={props.label ?? t("Choisir")}
        disabled={props.disabled}
        onFocus={props.onFocus}
        onKeyDown={keys}
        onClick={() => (open() ? setOpen(false) : show())}
      >
        <span>
          {props.options.find((row) => row.value === String(props.value))?.label ??
            String(props.value)}
        </span>
        <Icon name="chevron-down" />
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={(element) => {
              popup = element;
            }}
            class="choice-options"
            id={`${id}-choices`}
            onContextMenu={(event) => event.preventDefault()}
            role="listbox"
            aria-label={props.label ?? t("Choisir")}
            style={{
              left: `${position().left}px`,
              top: `${position().top}px`,
              width: `${Math.max(140, position().width)}px`,
            }}
          >
            <For each={props.options}>
              {(row, index) => (
                <div
                  role="option"
                  id={`${id}-choice-${index()}`}
                  data-choice={index()}
                  aria-selected={row.value === String(props.value)}
                  aria-disabled={row.disabled ?? false}
                  classList={{ active: active() === index() }}
                  onPointerMove={() => {
                    if (!row.disabled) setActive(index());
                  }}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(index())}
                >
                  {row.label}
                </div>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </>
  );
}
