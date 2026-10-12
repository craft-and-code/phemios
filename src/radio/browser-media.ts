import type { RadioMedia } from "./playback";
/** One disposable radio voice. CORS refusal retries ordinary media once; HLS keeps its native path. */
export function browserRadioMedia(
  options: {
    audio?: () => HTMLAudioElement;
    context?: () => AudioContext;
  } = {},
): RadioMedia {
  const createAudio = options.audio ?? (() => new Audio());
  let audio = createAudio(),
    context: AudioContext | undefined,
    analyser: AnalyserNode | undefined,
    source: MediaElementAudioSourceNode | undefined,
    output: GainNode | undefined,
    released = false,
    plain = false,
    played = false,
    url = "",
    level = 0.5;
  let playing = () => {},
    waiting = () => {},
    failure = () => {};
  audio.preload = "none";
  function clearAudio() {
    audio.onplaying = audio.onwaiting = audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  function tap() {
    if (released || !played) return;
    // Never reroute a non-CORS or HLS element through Web Audio: it can silence otherwise valid media.
    if (!plain && !source && context?.state === "running") {
      try {
        analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        output = context.createGain();
        output.gain.value = level;
        source = context.createMediaElementSource(audio);
        source.connect(output);
        output.connect(context.destination);
        source.connect(analyser);
        audio.volume = 1;
      } catch {
        // A refused optional graph must leave the original radio playback available.
        if (source && context) {
          source.disconnect();
          source.connect(context.destination);
          audio.volume = level;
        }
        output?.disconnect();
        analyser?.disconnect();
        output = undefined;
        analyser = undefined;
      }
    }
  }
  function prepare() {
    if (released) return;
    if (!plain && !context) {
      try {
        context = (options.context ?? (() => new AudioContext()))();
        const held = context;
        void held.resume().then(
          () => {
            if (held === context) tap();
          },
          () => {},
        );
      } catch {
        /* Optional measurement never refuses media playback. */
      }
    }
  }
  function bind() {
    audio.onplaying = () => {
      if (released) return;
      played = true;
      tap();
      playing();
    };
    audio.onwaiting = () => {
      if (!released) waiting();
    };
    audio.onerror = () => {
      if (!released && (plain || played)) failure();
    };
  }
  bind();
  return {
    prepare,
    source(value) {
      url = value;
      plain = /\.m3u8(?:$|[?#])/i.test(value);
      if (plain && context && !source) {
        void context.close().catch(() => {});
        context = undefined;
      }
      audio.crossOrigin = plain ? null : "anonymous";
      audio.src = value;
    },
    volume(value) {
      level = value;
      if (source && output) output.gain.value = value;
      else audio.volume = value;
    },
    async play() {
      if (released) return;
      prepare();
      try {
        await audio.play();
      } catch (error) {
        if (
          released ||
          plain ||
          played ||
          !(
            audio.error?.code === 2 ||
            audio.error?.code === 4 ||
            (error instanceof Error && error.name === "NotSupportedError")
          )
        )
          throw error;
        clearAudio();
        plain = true;
        if (context) void context.close().catch(() => {});
        context = undefined;
        audio = createAudio();
        audio.preload = "none";
        audio.volume = level;
        bind();
        audio.src = url;
        await audio.play();
      }
    },
    callbacks(onPlaying, onWaiting, onFailure) {
      playing = onPlaying;
      waiting = onWaiting;
      failure = onFailure;
    },
    sample(target) {
      target.fill(0);
      if (released || !source || !analyser || context?.state !== "running") return false;
      analyser.getFloatTimeDomainData(target);
      return true;
    },
    release() {
      if (released) return;
      released = true;
      clearAudio();
      source?.disconnect();
      analyser?.disconnect();
      output?.disconnect();
      if (context && context.state !== "closed") void context.close().catch(() => {});
      context = undefined;
      source = undefined;
      analyser = undefined;
      output = undefined;
    },
  };
}
