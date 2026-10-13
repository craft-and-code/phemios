import { onMount, onCleanup, type ParentProps } from "solid-js";
/** Shared selection headers stay in the content scroller; measured shell rails reserve the next sticky offset. */
export function StickyHeader(
  props: ParentProps<{ shell?: boolean; class?: string; separator?: boolean }>,
) {
  let header!: HTMLElement;
  onMount(() => {
    if (!props.shell) return;
    const main = header.closest("main");
    const measure = () => {
      main?.style.setProperty(
        "--catalog-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
      main?.style.setProperty("--content-height", `${main.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (main) observer.observe(main);
    measure();
    onCleanup(() => {
      observer.disconnect();
      main?.style.removeProperty("--catalog-header-height");
      main?.style.removeProperty("--content-height");
    });
  });
  return (
    <header
      ref={(element) => {
        header = element;
      }}
      data-separator={props.separator === false ? "hidden" : undefined}
      class={`sticky-header ${props.shell ? "catalog-header" : "page-sticky-header"} ${props.class ?? ""}`}
    >
      {props.children}
    </header>
  );
}
