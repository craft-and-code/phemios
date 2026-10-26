import { afterEach, expect, it, vi } from "vitest";
import { WebAudioOutput } from "./audio-output";
afterEach(() => vi.unstubAllGlobals());
it("creates a delayed worklet with the latest mute rather than the volume captured before loading WASM", async () => {
  let compile!: (module: WebAssembly.Module) => void;
  vi.stubGlobal(
    "Audio",
    class {
      preload = "";
    },
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([0]))));
  vi.stubGlobal("WebAssembly", {
    compile: () =>
      new Promise((resolve) => {
        compile = resolve;
      }),
  });
  const options: { processorOptions: { volume: number } }[] = [];
  const chain = { connect: vi.fn().mockReturnThis() };
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { postMessage: vi.fn() };
      connect = chain.connect;
      constructor(
        _context: unknown,
        _name: string,
        args: { processorOptions: { volume: number } },
      ) {
        options.push(args);
      }
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = vi.fn().mockResolvedValue(undefined);
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      createAnalyser = () => ({ ...chain, fftSize: 0 });
      createMediaElementSource = () => chain;
    },
  );
  const output = new WebAudioOutput(vi.fn());
  const ready = output.prepare(0.5);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  output.volume(0);
  compile({} as WebAssembly.Module);
  await ready;
  expect(options[0]?.processorOptions.volume).toBe(0);
});
