/** One observer per catalogue suspends offscreen carousels, retaining their selection separately. */
export function createViewportGate() {
  let observer: IntersectionObserver | undefined;
  const targets = new Map<Element, (visible: boolean) => void>();
  return {
    watch(element: Element, show: (visible: boolean) => void) {
      if (typeof IntersectionObserver === "undefined") {
        show(true);
        return () => {};
      }
      observer ??= new IntersectionObserver(
        (entries) => {
          for (const entry of entries) targets.get(entry.target)?.(entry.isIntersecting);
        },
        { rootMargin: "240px" },
      );
      targets.set(element, show);
      observer.observe(element);
      return () => {
        targets.delete(element);
        observer?.unobserve(element);
      };
    },
    dispose() {
      observer?.disconnect();
      targets.clear();
    },
  };
}
