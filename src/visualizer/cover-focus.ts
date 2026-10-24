import { onMount } from "solid-js";
/** Claim keyboard navigation once per mounted region, without interrupting typing or a modal. */
export function focusCoverOnMount(region: HTMLElement): void {
  onMount(() => {
    const document = region.ownerDocument;
    if (
      region.isConnected &&
      !document.querySelector("dialog[open]") &&
      !document.activeElement?.closest(
        "input:not([type=checkbox], [type=radio], [type=range]), textarea, select, [contenteditable]",
      )
    )
      region.focus({ preventScroll: true });
  });
}
