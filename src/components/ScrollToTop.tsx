import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "./Icon";
import { t } from "../i18n";
/** Floating reader action follows the real scroll container and releases its observers on disposal. */
export function ScrollToTop(props: { target: () => HTMLElement | undefined; contained?: boolean }) {
  const [visible, setVisible] = createSignal(false);
  let scrollRoot: HTMLElement | undefined;
  onMount(() => {
    const target = props.target();
    if (!target) return;
    let parent = target.parentElement;
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY))
      parent = parent.parentElement;
    scrollRoot = parent ?? (document.scrollingElement as HTMLElement);
    const update = () =>
      setVisible(
        !!scrollRoot &&
          scrollRoot.scrollHeight > scrollRoot.clientHeight &&
          scrollRoot.scrollTop > 120,
      );
    const events = scrollRoot === document.scrollingElement ? document : scrollRoot;
    events.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(target);
    observer.observe(scrollRoot);
    update();
    onCleanup(() => {
      events.removeEventListener("scroll", update);
      observer.disconnect();
    });
  });
  return (
    <span classList={{ "reader-scroll-top": props.contained }}>
      <Show when={visible()}>
        <button
          type="button"
          class="icon-button biography-scroll-top"
          title={t("Retour en haut")}
          aria-label={t("Retour en haut")}
          onClick={() => {
            const target = props.target();
            if (!target || !scrollRoot) return;
            scrollRoot.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            });
            target.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
          }}
        >
          <Icon name="up" />
        </button>
      </Show>
    </span>
  );
}
