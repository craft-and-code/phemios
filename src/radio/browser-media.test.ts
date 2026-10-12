import { it, expect, vi } from "vitest";
import { browserRadioMedia } from "./browser-media";
function fixture(fails = false) {
  const audios: HTMLAudioElement[] = [];
  const analyser = {
    fftSize: 0,
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn((target: Float32Array) => target.fill(0.3)),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() },
    gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "running",
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createAnalyser: vi.fn(() => analyser),
    createGain: vi.fn(() => gain),
    createMediaElementSource: vi.fn(() => source),
  };
  const factory = () => {
    const first = !audios.length;
    const audio = {
      src: "",
      preload: "",
      crossOrigin: null,
      volume: 0.5,
      onplaying: null,
      onwaiting: null,
      onerror: null,
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      error: first && fails ? { code: 4 } : null,
      play: vi.fn(async () => {
        if (first && fails) throw new DOMException("CORS refused", "NotSupportedError");
        audio.onplaying?.(new Event("playing"));
      }),
    } as unknown as HTMLAudioElement;
    audios.push(audio);
    return audio;
  };
  return { audios, factory, context, analyser, source, gain };
}
it("inspects the sole CORS radio before its muted output and tears down all nodes on release", async () => {
  const f = fixture(),
    media = browserRadioMedia({
      audio: f.factory,
      context: () => f.context as unknown as AudioContext,
    });
  const playing = vi.fn();
  media.callbacks(playing, vi.fn(), vi.fn());
  media.volume(0);
  media.source("https://radio.example.org/live.mp3");
  await media.play();
  expect(f.audios[0]?.crossOrigin).toBe("anonymous");
  expect(playing).toHaveBeenCalledOnce();
  expect(f.gain.gain.value).toBe(0);
  expect(f.audios[0]?.volume).toBe(1);
  const data = new Float32Array(8);
  expect(media.sample?.(data)).toBe(true);
  expect(data[0]).toBeCloseTo(0.3);
  media.volume(0.4);
  expect(f.gain.gain.value).toBe(0.4);
  media.release();
  expect(media.sample?.(data)).toBe(false);
  expect(data[0]).toBe(0);
  expect(f.source.disconnect).toHaveBeenCalledOnce();
  expect(f.analyser.disconnect).toHaveBeenCalledOnce();
  expect(f.context.close).toHaveBeenCalledOnce();
});
it("keeps refused CORS playback available through one ordinary-media retry without routing that voice", async () => {
  const f = fixture(true),
    media = browserRadioMedia({
      audio: f.factory,
      context: () => f.context as unknown as AudioContext,
    });
  media.callbacks(vi.fn(), vi.fn(), vi.fn());
  media.volume(0.25);
  media.source("https://radio.example.org/live.mp3");
  await media.play();
  expect(f.audios).toHaveLength(2);
  expect(f.audios[1]?.src).toBe("https://radio.example.org/live.mp3");
  expect(f.audios[1]?.crossOrigin).toBeNull();
  expect(f.audios[1]?.volume).toBe(0.25);
  expect(f.context.createMediaElementSource).not.toHaveBeenCalled();
  expect(media.sample?.(new Float32Array(8))).toBe(false);
  media.release();
});
it("leaves native HLS playback untouched instead of attaching a known unsupported WebKit analyser", async () => {
  const f = fixture(),
    factory = vi.fn(() => f.context as unknown as AudioContext),
    media = browserRadioMedia({ audio: f.factory, context: factory });
  media.callbacks(vi.fn(), vi.fn(), vi.fn());
  media.source("https://radio.example.org/live.m3u8?stream=1");
  await media.play();
  expect(f.audios).toHaveLength(1);
  expect(factory).not.toHaveBeenCalled();
  expect(f.audios[0]?.crossOrigin).toBeNull();
  media.release();
});
