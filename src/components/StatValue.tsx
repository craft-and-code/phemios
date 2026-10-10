import { createEffect, onCleanup, onMount } from "solid-js";
import { statValueSize } from "../library/stat-value-fit";

/** Keep localized measurement/unit strings complete without widening an individual statistics cell. */
export function StatValue(props: { value: string | number | undefined }) {
  let element: HTMLElement | undefined,
    observer: ResizeObserver | undefined,
    alive = true;
  let lastWidth = -1;
  let frame = 0;
  function fit() {
    if (!alive || !element?.isConnected) return;
    element.style.fontSize = "24px";
    const available = element.clientWidth;
    const text = document.createRange();
    text.selectNodeContents(element);
    const natural = text.getBoundingClientRect().width;
    let size = statValueSize(available, natural);
    const target = available - Math.min(12, available * 0.1);
    for (let attempt = 0; attempt < 3; attempt++) {
      element.style.fontSize = `${size}px`;
      const measured = text.getBoundingClientRect().width;
      if (measured <= target || !available) break;
      size = Math.min(size, statValueSize(available, (measured * 24) / size));
    }
    element.style.fontSize = `${size}px`;
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
    void document.fonts.ready.then(() => {
      if (alive) frame = requestAnimationFrame(fit);
    });
  });
  onCleanup(() => {
    alive = false;
    observer?.disconnect();
    cancelAnimationFrame(frame);
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
