import { idlePlayback, type PlaybackState } from "../library/playback-state";
import { WebAudioOutput } from "./audio-output";
/** Browser transport owns visits; catalogue selection and account admission remain in the existing controller/Aède. */
export class WebPlayer {
  private output: WebAudioOutput;
  private state: PlaybackState = { ...idlePlayback };
  private tracks: string[] = [];
  private generation = 0;
  private queueId = 0;
  private release: (() => void) | undefined;
  constructor(
    private readonly resolve: (
      reference: string,
      signal: AbortSignal,
    ) => Promise<{ url: string; release?: () => void }>,
  ) {
    this.output = new WebAudioOutput((message) => {
      this.stop();
      this.state = { ...this.state, status: "error", error: message };
    });
    const media = this.output.media;
    media.addEventListener("ended", () => {
      if (media.ended && this.state.status === "playing") this.advance(1, true);
    });
    media.addEventListener("error", () => {
      if (media.error && ["playing", "connecting"].includes(this.state.status))
        this.fail(new Error("Le navigateur ne peut pas décoder ce fichier audio."));
    });
  }
  private pending: AbortController | undefined;
  private retire() {
    this.generation++;
    this.pending?.abort();
    this.pending = undefined;
  }
  private fail(error: unknown) {
    this.stop();
    this.state = {
      ...this.state,
      status: "error",
      error: error instanceof Error ? error.message : "Lecture Web interrompue.",
    };
  }
  private clearMedia() {
    this.output.stop();
    this.release?.();
    this.release = undefined;
  }
  stop() {
    this.retire();
    this.clearMedia();
    this.tracks = [];
    this.state = {
      ...idlePlayback,
      volume: this.state.volume,
      repeat: this.state.repeat,
      queue_id: ++this.queueId,
    };
  }
  async start(tracks: readonly string[], index: number, device: string, policy: string) {
    if (device && device !== "@browser")
      throw new Error("Cette sortie nécessite l’application desktop.");
    if (policy !== "without-effects")
      throw new Error(
        "La normalisation et le fondu ne sont pas encore disponibles dans le navigateur.",
      );
    if (
      !tracks.length ||
      tracks.length > 4096 ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= tracks.length ||
      tracks.some((r) => !r.startsWith("track:"))
    )
      throw new Error("File de lecture invalide.");
    this.stop();
    this.tracks = [...tracks];
    this.state = {
      ...this.state,
      device: "@browser",
      total: tracks.length,
      queue: tracks.map((_, i) => i),
      index,
    };
    this.launch(index);
  }
  private launch(index: number) {
    // Visit owns errors and retirement; commands return immediately so Stop/Pause remain usable.
    void this.visit(index).catch(() => {});
  }
  private resume() {
    this.retire();
    const epoch = this.generation;
    this.state = { ...this.state, status: "connecting" };
    void (async () => {
      try {
        await this.output.prepare(this.state.volume);
        if (epoch !== this.generation) return;
        await this.output.media.play();
        if (epoch === this.generation) this.state = { ...this.state, status: "playing" };
      } catch (error) {
        if (epoch === this.generation) this.fail(error);
      }
    })();
  }
  private async visit(index: number) {
    const reference = this.tracks[index];
    if (!reference) throw new Error("Piste retirée de la liste de lecture.");
    this.retire();
    this.clearMedia();
    const generation = this.generation,
      pending = new AbortController();
    this.pending = pending;
    this.state = {
      ...this.state,
      status: "connecting",
      reference,
      index,
      position_ms: 0,
      duration_ms: null,
      error: "",
    };
    try {
      await this.output.prepare(this.state.volume);
      if (generation !== this.generation) return;
      const source = await this.resolve(reference, pending.signal);
      if (generation !== this.generation) {
        source.release?.();
        return;
      }
      this.release = source.release;
      this.output.volume(this.state.volume);
      this.output.media.src = source.url;
      await this.output.media.play();
      if (generation === this.generation) {
        this.output.volume(this.state.volume);
        this.state = { ...this.state, status: "playing" };
      }
    } catch (error) {
      if (generation === this.generation) {
        this.fail(error);
        throw error;
      }
    }
  }
  snapshot(): PlaybackState {
    const media = this.output.media,
      active = ["playing", "paused", "connecting", "ended"].includes(this.state.status);
    const spectrum = this.output.levels(),
      levels = Array.from(
        { length: 4 },
        (_, i) => spectrum.slice(i * 6, i * 6 + 6).reduce((a, b) => a + b, 0) / 6,
      );
    return {
      ...this.state,
      position_ms:
        active && Number.isFinite(media.currentTime)
          ? Math.floor(media.currentTime * 1000)
          : this.state.position_ms,
      duration_ms:
        active && Number.isFinite(media.duration)
          ? Math.floor(media.duration * 1000)
          : this.state.duration_ms,
      sample_rate: this.output.sampleRate(),
      level: Math.max(...levels),
      levels,
      spectrum,
      spectrum_hz: Array.from({ length: 24 }, (_, i) =>
        Math.min(20000, ((i + 1) * (this.output.sampleRate() || 48000)) / 48),
      ),
    };
  }
  append(queueId: number, expectedTotal: number, tracks: readonly string[]) {
    if (
      queueId !== this.state.queue_id ||
      expectedTotal !== this.tracks.length ||
      this.tracks.length + tracks.length > 4096 ||
      tracks.some((r) => !r.startsWith("track:"))
    )
      throw new Error("La file de lecture a changé.");
    const offset = this.tracks.length;
    this.tracks.push(...tracks);
    this.state = {
      ...this.state,
      total: this.tracks.length,
      queue: [...this.state.queue, ...tracks.map((_, i) => offset + i)],
    };
  }
  private advance(direction: number, natural = false) {
    if (natural && this.state.repeat === "one") return this.launch(this.state.index);
    const at = this.state.queue.indexOf(this.state.index) + direction;
    const next =
      this.state.queue[at] ??
      (this.state.repeat === "all"
        ? this.state.queue[direction > 0 ? 0 : this.state.queue.length - 1]
        : undefined);
    if (next !== undefined) return this.launch(next);
    this.retire();
    this.output.media.pause();
    this.state = { ...this.state, status: "ended" };
  }
  async control(action: string, value: unknown): Promise<PlaybackState> {
    if (action === "volume") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
        throw new Error("Volume invalide.");
      this.state = { ...this.state, volume: value };
      this.output.volume(value);
    } else if (action === "stop" || action === "clear") this.stop();
    else if (action === "pause") {
      this.retire();
      // A resolved media source can stay paused at its consumed position. Unresolved
      // sources are aborted and rejected by the visit generation before assignment.
      this.output.media.pause();
      this.state = { ...this.state, status: "paused" };
    } else if (action === "resume") {
      if (this.state.status !== "paused") throw new Error("Aucune lecture en pause.");
      if (!this.output.media.src) this.launch(this.state.index);
      else this.resume();
    } else if (action === "next" || action === "previous") this.advance(action === "next" ? 1 : -1);
    else if (action === "jump") {
      if (!Number.isSafeInteger(value) || !this.state.queue.includes(Number(value)))
        throw new Error("Piste absente de la file.");
      this.launch(Number(value));
    } else if (action === "seek") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        !Number.isFinite(this.output.media.duration)
      )
        throw new Error("Position audio indisponible.");
      this.output.media.currentTime = Math.min(this.output.media.duration, value / 1000);
      this.state = { ...this.state, seek_id: this.state.seek_id + 1 };
    } else if (action === "repeat") {
      if (!["off", "one", "all"].includes(String(value))) throw new Error("Répétition invalide.");
      this.state = { ...this.state, repeat: value as PlaybackState["repeat"] };
    } else if (action === "queue") {
      const edit = value as { queue_id: number; order: number[] };
      if (
        !edit ||
        edit.queue_id !== this.state.queue_id ||
        !Array.isArray(edit.order) ||
        edit.order.length !== this.state.queue.length ||
        new Set(edit.order).size !== edit.order.length ||
        edit.order.some((i) => !this.state.queue.includes(i))
      )
        throw new Error("La file de lecture a changé.");
      this.state = { ...this.state, queue: [...edit.order], shuffled: false };
    } else if (action === "remove") {
      const edit = value as { queue_id: number; index: number };
      if (!edit || edit.queue_id !== this.state.queue_id || !this.state.queue.includes(edit.index))
        throw new Error("La file de lecture a changé.");
      const at = this.state.queue.indexOf(edit.index),
        queue = this.state.queue.filter((i) => i !== edit.index);
      this.state = { ...this.state, queue };
      if (!queue.length) this.stop();
      else if (edit.index === this.state.index) this.launch(queue[Math.min(at, queue.length - 1)]!);
    } else if (action === "shuffle") {
      if (typeof value !== "boolean") throw new Error("Ordre invalide.");
      const at = this.state.queue.indexOf(this.state.index),
        head = this.state.queue.slice(0, at + 1),
        tail = this.state.queue.slice(at + 1);
      if (value) {
        for (let i = tail.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tail[i], tail[j]] = [tail[j]!, tail[i]!];
        }
      } else tail.sort((a, b) => a - b);
      this.state = { ...this.state, queue: [...head, ...tail], shuffled: value };
    } else if (action === "crossfade" && value === 0) {
      /* No crossfade in the minimal Web profile. */
    } else if (action === "policy" && value === "without-effects") {
      /* The shared DSP applies only app volume. */
    } else throw new Error("Cette commande audio nécessite l’application desktop.");
    return this.snapshot();
  }
}
