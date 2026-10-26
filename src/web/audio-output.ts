/** One progressive browser decoder feeds the published Aède DSP in an isolated AudioWorklet. */
export class WebAudioOutput {
  readonly media = new Audio();
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private analyser?: AnalyserNode;
  private readonly frequencies = new Uint8Array(128);
  private gain = 0.5;
  private initializing: Promise<void> | undefined;
  constructor(private readonly failure: (message: string) => void) {
    this.media.preload = "metadata";
  }
  async prepare(volume: number) {
    this.volume(volume);
    this.context ??= new AudioContext({ latencyHint: "playback" });
    // Resume synchronously in the user gesture, before asynchronous module preparation.
    const resumed = this.context.resume();
    this.initializing ??= this.initialize().catch((e) => {
      this.initializing = undefined;
      throw e;
    });
    await Promise.all([resumed, this.initializing]);
  }
  private async initialize() {
    const context = this.context!;
    const response = await fetch(
      `${import.meta.env.BASE_URL}web-audio/wasm/phemios_web_audio_bg.wasm`,
      { credentials: "omit", redirect: "error" },
    );
    if (!response.ok) throw new Error("Le moteur WebAssembly est indisponible.");
    const module = await WebAssembly.compile(await response.arrayBuffer());
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}web-audio/processor.js`);
    const node = new AudioWorkletNode(context, "phemios-shared-dsp", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      processorOptions: { module, volume: this.gain },
    });
    node.onprocessorerror = () => {
      this.media.pause();
      this.failure("Le moteur audio WebAssembly a été interrompu.");
    };
    node.port.onmessage = (event) => {
      if (event.data?.type === "error") {
        this.media.pause();
        this.failure("Le moteur audio a refusé un bloc invalide.");
      }
    };
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context
      .createMediaElementSource(this.media)
      .connect(node)
      .connect(analyser)
      .connect(context.destination);
    this.node = node;
    this.analyser = analyser;
  }
  volume(value: number) {
    this.gain = value;
    this.node?.port.postMessage({ type: "volume", value });
  }
  sampleRate() {
    return this.context?.sampleRate ?? 0;
  }
  levels() {
    if (!this.analyser || this.media.paused) return Array(24).fill(0) as number[];
    const bytes = this.frequencies;
    this.analyser.getByteFrequencyData(bytes);
    return Array.from(
      { length: 24 },
      (_, i) => bytes[Math.min(bytes.length - 1, Math.floor((i * bytes.length) / 24))]! / 255,
    );
  }
  stop() {
    this.media.pause();
    this.media.removeAttribute("src");
    this.media.load();
    void this.context?.suspend().catch(() => {});
  }
  async close() {
    this.stop();
    await this.context?.close();
  }
}
