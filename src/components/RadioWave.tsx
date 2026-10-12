import { onMount, onCleanup } from "solid-js";
import { radioWaveform, sampleRadioWave } from "../radio/waveform";
/** One resident 8 KiB sample buffer, 30 Hz drawing only while the dial is visible; no sound generation. */
export function RadioWave(props: { sample: (target: Float32Array<ArrayBuffer>) => boolean }) {
  let element!: SVGPathElement,
    frame = 0,
    last = -Infinity,
    visible = true,
    alive = true;
  const samples = new Float32Array(2048);
  function draw(time: number) {
    if (!alive || !visible || document.hidden) return;
    if (time - last >= 33) {
      last = time;
      sampleRadioWave(samples, props.sample);
      const result = radioWaveform(samples, time / 1400);
      element.setAttribute("d", result.path);
      element.dataset.signal = result.measured ? "measured" : "idle";
    }
    frame = requestAnimationFrame(draw);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    if (alive && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  onMount(() => {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      schedule();
    });
    // A changing path bounding box is not a stable visibility target.
    if (element.ownerSVGElement) observer.observe(element.ownerSVGElement);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    onCleanup(() => {
      alive = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      cancelAnimationFrame(frame);
    });
  });
  return (
    <path
      ref={(node) => {
        element = node;
      }}
      class="radio-wave"
      d={radioWaveform(samples, 0).path}
    />
  );
}
