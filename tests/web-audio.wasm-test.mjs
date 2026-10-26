import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("the actual generated WASM applies shared unity/gain/mute processing without browser-only globals", async () => {
  const module = await import("../web-public/web-audio/wasm/phemios_web_audio.js");
  const wasm = module.initSync({
    module: await readFile(
      new URL("../web-public/web-audio/wasm/phemios_web_audio_bg.wasm", import.meta.url),
    ),
  });
  assert.equal(module.initialize(48000), true);
  assert.equal(module.initialize(48000), false);
  const samples = new Float32Array(wasm.memory.buffer, module.buffer_ptr(), module.buffer_len());
  samples.fill(0.5);
  assert.equal(module.process_audio(128), true);
  assert.equal(samples[0], 0.5);
  assert.equal(module.set_volume(0), true);
  assert.equal(module.process_audio(128), true);
  assert.equal(samples[0], 0);
  assert.equal(module.process_audio(4097), false);
  assert.equal(module.set_volume(NaN), false);
});
