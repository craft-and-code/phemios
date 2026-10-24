type CoverKey = Pick<
  KeyboardEvent,
  "key" | "defaultPrevented" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "preventDefault"
> & { currentTarget: Pick<HTMLElement, "focus"> };
/** Cover navigation is independent of the transient card or button that originated the key. */
export function createCoverKeyboard(options: {
  index: () => number;
  total: () => number;
  cancel: () => void;
  choose: (index: number) => void;
}) {
  return (event: CoverKey) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      !options.total()
    )
      return;
    const next =
      event.key === "ArrowLeft"
        ? options.index() - 1
        : event.key === "ArrowRight"
          ? options.index() + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.total() - 1
              : undefined;
    if (next !== undefined) {
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      options.cancel();
      options.choose(next);
    }
  };
}
