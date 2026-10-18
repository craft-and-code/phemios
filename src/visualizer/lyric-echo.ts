import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createBassPulse, type BassSample } from "./bass-pulse";
/** One reusable visual-only copy follows consumed bass attacks; hidden, paused and reduced motion cancel it. */
export function createLyricEcho(input: {
  phrase: () => object | undefined;
  ready: () => boolean;
  enabled: () => boolean;
  audio: () => BassSample | undefined;
}) {
  const bass = createBassPulse(),
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const [reducedMotion, setReducedMotion] = createSignal(reduced.matches);
  let echo: HTMLSpanElement | undefined, pulse: Animation | undefined;
  function stop() {
    pulse?.cancel();
    pulse = undefined;
  }
  createEffect(() => {
    void input.phrase();
    stop();
    bass.reset();
  });
  createEffect(() => {
    const sample = input.audio();
    if (!input.enabled() || reducedMotion() || !input.ready() || !sample) {
      stop();
      bass.reset();
      return;
    }
    const strength = bass.observe(sample);
    if (strength && echo) {
      stop();
      pulse = echo.animate(
        [
          { opacity: 0.28 + strength * 0.22, transform: "translateZ(64px) scale(1)" },
          { opacity: 0, transform: `translateZ(64px) scale(${1.12 + strength * 0.22})` },
        ],
        { duration: 650, easing: "cubic-bezier(0.16, 0.65, 0.3, 1)" },
      );
    }
  });
  onMount(() => {
    const motion = () => setReducedMotion(reduced.matches);
    reduced.addEventListener("change", motion);
    onCleanup(() => reduced.removeEventListener("change", motion));
  });
  onCleanup(stop);
  return (node: HTMLSpanElement) => {
    echo = node;
  };
}
