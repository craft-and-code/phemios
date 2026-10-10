import { createEffect, onCleanup, onMount } from "solid-js";
import { statValueSize } from "../library/stat-value-fit";

/** Keep localized measurement/unit strings complete without widening an individual statistics cell. */
export function StatValue(props: { value: string | number | undefined }) {
  let element: HTMLElement | undefined,
    observer: ResizeObserver | undefined,
    alive = true;
  let lastWidth = -1;
  function fit() {
    if (!alive || !element?.isConnected) return;
    element.style.fontSize = "24px";
    const available = element.clientWidth;
    element.style.fontSize = `${statValueSize(available, element.scrollWidth)}px`;
    lastWidth = available;
  }
  createEffect(() => {
    void props.value;
    queueMicrotask(fit);
  });
  onMount(() => {
    observer = new ResizeObserver(() => {
      if (element?.clientWidth !== lastWidth) fit();
    });
    if (element) observer.observe(element);
    fit();
  });
  onCleanup(() => {
    alive = false;
    observer?.disconnect();
  });
  return (
    <strong
      ref={(value) => {
        element = value;
      }}
    >
      {props.value}
    </strong>
  );
}
