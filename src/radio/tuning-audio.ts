import { radioTuningLoop, type RadioTuningPreset } from "./tuning-loop";
import type { RadioTuningAudio } from "./tuning-sound";
const fade = 0.04,
  sampleRate = 16000;
const gain = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
function hold(parameter: AudioParam, time: number) {
  if (typeof parameter.cancelAndHoldAtTime === "function") parameter.cancelAndHoldAtTime(time);
  else {
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(parameter.value, time);
  }
}
/** A page owns one lazy context, at most three 64 KB mono loops, and two live/fading voices.
 * Sources fade for 40 ms; a bounded wall-clock cleanup also retires a suspended context's nodes.
 * Master gain makes mute immediate even during release, without touching Internet media.
 */
export function createRadioTuningAudio(
  createContext: () => AudioContext = () => new AudioContext(),
): RadioTuningAudio {
  let context: AudioContext | undefined,
    master: GainNode | undefined,
    disposed = false;
  let closing: ReturnType<typeof setTimeout> | undefined;
  const buffers = new Map<RadioTuningPreset, AudioBuffer>();
  const voices = new Set<{ stop: () => void; release: () => void }>();
  let wanted = false,
    activity = 0,
    suspending: Promise<void> | undefined;
  function suspendIfIdle() {
    if (disposed || wanted || voices.size || suspending || !context || context.state !== "running")
      return;
    const held = context;
    const pending = held
      .suspend()
      .catch(() => {})
      .finally(() => {
        if (suspending === pending) suspending = undefined;
      });
    suspending = pending;
  }
  function volume(value: number) {
    if (disposed || !context || !master) return;
    const now = context.currentTime,
      next = gain(value);
    hold(master.gain, now);
    if (next === 0) master.gain.setValueAtTime(0, now);
    else master.gain.linearRampToValueAtTime(next, now + 0.01);
  }
  function close() {
    clearTimeout(closing);
    for (const voice of voices) voice.release();
    master?.disconnect();
    master = undefined;
    buffers.clear();
    const held = context;
    context = undefined;
    if (held && held.state !== "closed") void held.close().catch(() => {});
  }
  return {
    async ready() {
      if (disposed) throw new Error("Radio tuning feedback has been disposed");
      wanted = true;
      const ticket = ++activity;
      if (!context) {
        context = createContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      }
      const held = context;
      if (suspending) await suspending;
      if (disposed || context !== held || ticket !== activity) {
        suspendIfIdle();
        throw new Error("Radio tuning gesture has finished");
      }
      if (held.state !== "running") await held.resume();
      if (disposed || context !== held || held.state !== "running" || ticket !== activity) {
        suspendIfIdle();
        throw new Error("Radio tuning audio output is unavailable");
      }
    },
    idle() {
      wanted = false;
      activity++;
      suspendIfIdle();
    },
    volume,
    loop(preset, value) {
      const held = context,
        output = master;
      if (disposed || !wanted || !held || !output || held.state !== "running")
        throw new Error("Radio tuning audio output is unavailable");
      while (voices.size >= 2) voices.values().next().value?.release();
      let buffer = buffers.get(preset);
      if (!buffer) {
        const samples = radioTuningLoop(preset, sampleRate);
        buffer = held.createBuffer(1, samples.length, sampleRate);
        buffer.copyToChannel(samples, 0);
        buffers.set(preset, buffer);
      }
      const source = held.createBufferSource(),
        envelope = held.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(envelope);
      envelope.connect(output);
      envelope.gain.setValueAtTime(0, held.currentTime);
      envelope.gain.linearRampToValueAtTime(0.13, held.currentTime + 0.015);
      volume(value);
      let retired = false,
        stopping = false,
        timeout: ReturnType<typeof setTimeout> | undefined;
      function release(ended = false) {
        if (retired) return;
        retired = true;
        clearTimeout(timeout);
        source.onended = null;
        if (!ended) {
          try {
            source.stop();
          } catch {
            /* Already ended. */
          }
        }
        source.disconnect();
        envelope.disconnect();
        voices.delete(voice);
        suspendIfIdle();
      }
      const voice = {
        release,
        stop() {
          if (stopping || retired) return;
          stopping = true;
          if (held.state !== "running") {
            release();
            return;
          }
          const now = held.currentTime;
          hold(envelope.gain, now);
          envelope.gain.linearRampToValueAtTime(0, now + fade);
          source.stop(now + fade + 0.005);
          timeout = setTimeout(release, 60);
        },
      };
      source.onended = () => release(true);
      voices.add(voice);
      try {
        source.start();
      } catch (failure) {
        release();
        throw failure;
      }
      return voice;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wanted = false;
      activity++;
      for (const voice of voices) voice.stop();
      if (voices.size) closing = setTimeout(close, 60);
      else close();
    },
  };
}
