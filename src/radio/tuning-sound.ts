import { radioTuningPresets, type RadioTuningPreset } from "./tuning-loop";
export interface RadioTuningVoice {
  /** Fade and retire this voice; repeated calls have no effect. */
  stop: () => void;
}
export interface RadioTuningAudio {
  /** Prepare silently during pointerdown to retain WebKit's user activation. */
  ready: () => Promise<void>;
  loop: (preset: RadioTuningPreset, volume: number) => RadioTuningVoice;
  /** Master gain also controls voices finishing their release fade. */
  volume: (value: number) => void;
  /** Suspend a prepared context once its release voice has retired. */
  idle: () => void;
  dispose: () => void;
}
interface Pointer {
  id: number;
  x: number;
}
/** Pointer-only feedback never calls the station transport; late resumes cannot revive a gesture. */
export function createRadioTuningSound(options: {
  volume: () => number;
  audio: RadioTuningAudio;
  random?: () => number;
  /** An explicit choice bypasses random selection and caches only its own buffer. */
  preset?: RadioTuningPreset;
  error?: (failure: unknown) => void;
}) {
  let alive = true,
    gesture:
      | {
          pointer: Pointer;
          ready: Promise<boolean>;
          moved: boolean;
          voice?: RadioTuningVoice;
          failure?: unknown;
        }
      | undefined;
  function finish(id?: number) {
    if (id !== undefined && gesture?.pointer.id !== id) return;
    const held = gesture;
    gesture = undefined;
    held?.voice?.stop();
    if (held) options.audio.idle();
  }
  function begin(pointer: Pointer) {
    if (!alive || !Number.isFinite(pointer.x)) return;
    finish();
    const held = { pointer, ready: Promise.resolve(false), moved: false } as NonNullable<
      typeof gesture
    >;
    gesture = held;
    try {
      held.ready = options.audio.ready().then(
        () => true,
        (failure: unknown) => {
          held.failure = failure;
          return false;
        },
      );
    } catch (failure) {
      held.failure = failure;
    }
  }
  async function activate(held: NonNullable<typeof gesture>, preset: RadioTuningPreset) {
    const ready = await held.ready;
    if (!alive || gesture !== held) return;
    if (!ready) {
      options.error?.(held.failure);
      return;
    }
    try {
      held.voice = options.audio.loop(preset, options.volume());
    } catch (failure) {
      options.error?.(failure);
    }
  }
  return {
    begin,
    move(pointer: Pointer) {
      const held = gesture;
      if (
        !held ||
        held.moved ||
        held.pointer.id !== pointer.id ||
        !Number.isFinite(pointer.x) ||
        Math.abs(pointer.x - held.pointer.x) <= 4
      )
        return false;
      held.moved = true;
      const value = options.preset ? 0 : (options.random ?? Math.random)();
      const index = Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value * 3))) : 0;
      void activate(held, options.preset ?? radioTuningPresets[index]!);
      return true;
    },
    finish,
    volume(value: number) {
      if (alive) options.audio.volume(value);
    },
    dispose() {
      if (!alive) return;
      alive = false;
      finish();
      options.audio.dispose();
    },
  };
}
