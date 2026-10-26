import {
  initSync,
  initialize,
  buffer_ptr,
  buffer_len,
  set_volume,
  process_audio,
} from "./wasm/phemios_web_audio.js";
/** Every audible sample passes through the shared Aède DSP; no alternate JS processing algorithm. */
class PhemiosProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const wasm = initSync({ module: options.processorOptions.module });
    this.memory = wasm.memory;
    if (!initialize(sampleRate)) throw new Error("Unsupported Web Audio sample rate");
    this.samples = new Float32Array(this.memory.buffer, buffer_ptr(), buffer_len());
    set_volume(options.processorOptions.volume);
    this.failed = false;
    this.port.onmessage = (event) => {
      if (event.data.type === "volume" && !set_volume(event.data.value)) this.fail();
    };
  }
  fail() {
    if (!this.failed) this.port.postMessage({ type: "error" });
    this.failed = true;
  }
  process(inputs, outputs) {
    const output = outputs[0],
      input = inputs[0];
    if (!output || output.length !== 2) return true;
    const frames = output[0].length;
    if (this.failed || !input?.length) {
      output[0].fill(0);
      output[1].fill(0);
      return true;
    }
    if (frames * 2 > this.samples.length) {
      this.fail();
      output[0].fill(0);
      output[1].fill(0);
      return true;
    }
    for (let i = 0; i < frames; i++) {
      this.samples[i * 2] = input[0]?.[i] ?? 0;
      this.samples[i * 2 + 1] = input[1]?.[i] ?? input[0]?.[i] ?? 0;
    }
    if (!process_audio(frames)) {
      this.fail();
      output[0].fill(0);
      output[1].fill(0);
      return true;
    }
    for (let i = 0; i < frames; i++) {
      output[0][i] = this.samples[i * 2];
      output[1][i] = this.samples[i * 2 + 1];
    }
    return true;
  }
}
registerProcessor("phemios-shared-dsp", PhemiosProcessor);
