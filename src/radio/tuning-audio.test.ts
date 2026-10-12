import { expect, it, vi } from "vitest";
import { createRadioTuningAudio } from "./tuning-audio";
import { tuningAudioFixture } from "./tuning-audio-test-fixtures";
it("owns one lazy context and bounds rapid gestures to one active and one fading voice", async () => {
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  expect(fixture.factory).not.toHaveBeenCalled();
  await audio.ready();
  await audio.ready();
  expect(fixture.factory).toHaveBeenCalledOnce();
  expect(fixture.context.resume).toHaveBeenCalledOnce();
  const first = audio.loop("static", 0.5);
  first.stop();
  const second = audio.loop("whistle", 0.5);
  second.stop();
  audio.loop("flutter", 0.5);
  expect(
    fixture.sources.filter((source) => source.disconnect.mock.calls.length === 0),
  ).toHaveLength(2);
  expect(fixture.sources[0]!.disconnect).toHaveBeenCalledOnce();
  audio.dispose();
});
it("caches bounded mono buffers and keeps mute effective during a release fade", async () => {
  vi.useFakeTimers();
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  try {
    await audio.ready();
    const voice = audio.loop("static", 0.6);
    expect(fixture.context.createBuffer).toHaveBeenCalledExactlyOnceWith(1, 16000, 16000);
    expect(fixture.sources[0]!.loop).toBe(true);
    voice.stop();
    voice.stop();
    expect(fixture.sources[0]!.stop).toHaveBeenCalledOnce();
    expect(fixture.sources[0]!.stop.mock.calls[0]![0]).toBeGreaterThan(10);
    audio.volume(0);
    expect(fixture.gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
    await vi.advanceTimersByTimeAsync(60);
    expect(fixture.sources[0]!.disconnect).toHaveBeenCalledOnce();
    audio.loop("static", 0.8);
    expect(fixture.context.createBuffer).toHaveBeenCalledOnce();
    audio.dispose();
    await vi.advanceTimersByTimeAsync(60);
    expect(fixture.sources[1]!.disconnect).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
  } finally {
    audio.dispose();
    vi.useRealTimers();
  }
});
it("retires ended voices once and disposes asynchronously without accepting a new loop", async () => {
  vi.useFakeTimers();
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  try {
    await audio.ready();
    audio.loop("flutter", 1);
    const ended = fixture.sources[0]!.onended!;
    ended();
    ended();
    expect(fixture.sources[0]!.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
    audio.dispose();
    expect(fixture.context.close).toHaveBeenCalledOnce();
    expect(() => audio.loop("static", 1)).toThrow();
    await expect(audio.ready()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100);
    expect(fixture.context.close).toHaveBeenCalledOnce();
  } finally {
    audio.dispose();
    vi.useRealTimers();
  }
});

it("suspends unused feedback and resumes the same context, waiting until a voice has faded", async () => {
  vi.useFakeTimers();
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  try {
    await audio.ready();
    audio.idle();
    expect(fixture.context.suspend).toHaveBeenCalledOnce();
    await audio.ready();
    expect(fixture.factory).toHaveBeenCalledOnce();
    expect(fixture.context.resume).toHaveBeenCalledTimes(2);
    const voice = audio.loop("whistle", 0.4);
    voice.stop();
    audio.idle();
    expect(fixture.context.suspend).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60);
    expect(fixture.context.suspend).toHaveBeenCalledTimes(2);
  } finally {
    audio.dispose();
    vi.useRealTimers();
  }
});
it("returns a late resume to idle after cancellation without creating any feedback source", async () => {
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  let resumed!: () => void;
  fixture.context.resume.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resumed = () => {
          fixture.context.state = "running";
          resolve();
        };
      }),
  );
  const ready = audio.ready();
  audio.idle();
  resumed();
  await expect(ready).rejects.toThrow();
  expect(fixture.context.suspend).toHaveBeenCalledOnce();
  expect(fixture.context.createBufferSource).not.toHaveBeenCalled();
  audio.dispose();
});

it("waits for an in-flight idle suspension before resuming a new gesture", async () => {
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory);
  let suspended!: () => void;
  fixture.context.suspend.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        suspended = () => {
          fixture.context.state = "suspended";
          resolve();
        };
      }),
  );
  await audio.ready();
  audio.idle();
  const ready = audio.ready();
  expect(fixture.context.resume).toHaveBeenCalledOnce();
  suspended();
  await ready;
  expect(fixture.context.resume).toHaveBeenCalledTimes(2);
  expect(fixture.context.state).toBe("running");
  audio.dispose();
});

it("exposes only active tuning-loop PCM and clears its samples on release and disposal", async () => {
  const fixture = tuningAudioFixture(),
    audio = createRadioTuningAudio(fixture.factory),
    samples = new Float32Array(16);
  expect(audio.sample?.(samples)).toBe(false);
  await audio.ready();
  const voice = audio.loop("whistle", 0.5);
  expect(audio.sample?.(samples)).toBe(true);
  expect(samples[0]).toBeCloseTo(0.2);
  voice.stop();
  audio.idle();
  expect(audio.sample?.(samples)).toBe(false);
  expect(samples[0]).toBe(0);
  audio.dispose();
  expect(audio.sample?.(samples)).toBe(false);
});
