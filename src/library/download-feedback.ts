import { createSignal, onCleanup } from "solid-js";
/** One bounded success timer; late completions cannot acknowledge a replaced target. */
export function createDownloadFeedback() {
  const [phase, setPhase] = createSignal<"idle" | "busy" | "complete">("idle");
  let generation = 0,
    alive = true,
    timer: ReturnType<typeof setTimeout> | undefined;
  function reset() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    setPhase("idle");
  }
  function complete() {
    clearTimeout(timer);
    setPhase("complete");
    timer = setTimeout(() => {
      timer = undefined;
      if (alive) setPhase("idle");
    }, 3000);
  }
  onCleanup(() => {
    alive = false;
    reset();
  });
  return {
    phase,
    reset,
    complete,
    async run(action: () => unknown | Promise<unknown>, confirm = true) {
      if (phase() === "busy") return;
      reset();
      const held = generation;
      setPhase("busy");
      try {
        const result = await action();
        if (alive && held === generation) {
          if (confirm && result !== false) complete();
          else setPhase("idle");
        }
      } catch (error) {
        if (!alive || held !== generation) return;
        setPhase("idle");
        throw error;
      }
    },
  };
}
