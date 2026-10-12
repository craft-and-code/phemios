import { vi, type Mock } from "vitest";
interface Parameter {
  value: number;
  cancelAndHoldAtTime: Mock;
  setValueAtTime: Mock;
  linearRampToValueAtTime: Mock;
}
interface Gain {
  gain: Parameter;
  connect: Mock;
  disconnect: Mock;
}
interface Source {
  buffer: AudioBuffer | null;
  loop: boolean;
  onended: (() => void) | null;
  connect: Mock;
  disconnect: Mock;
  start: Mock;
  stop: Mock;
}
interface TuningAudioFixture {
  context: {
    state: string;
    currentTime: number;
    destination: object;
    resume: Mock<() => Promise<void>>;
    suspend: Mock<() => Promise<void>>;
    close: Mock<() => Promise<void>>;
    createGain: Mock<() => Gain>;
    createBuffer: Mock<
      (
        channels: number,
        length: number,
        rate: number,
      ) => {
        length: number;
        sampleRate: number;
        copyToChannel: Mock;
      }
    >;
    createBufferSource: Mock<() => Source>;
  };
  factory: Mock<() => AudioContext>;
  gains: Gain[];
  sources: Source[];
}
/** Observable Web Audio ports; timers stand in for hardware node retirement, not rendered PCM. */
export function tuningAudioFixture(): TuningAudioFixture {
  const parameter = (): Parameter => ({
    value: 0,
    cancelAndHoldAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const gains: Gain[] = [],
    sources: Source[] = [];
  const context: TuningAudioFixture["context"] = {
    state: "suspended",
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    suspend: vi.fn(async () => {
      context.state = "suspended";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    createGain: vi.fn(() => {
      const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    }),
    createBuffer: vi.fn((_channels: number, length: number, rate: number) => ({
      length,
      sampleRate: rate,
      copyToChannel: vi.fn(),
    })),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        loop: false,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { context, factory, gains, sources };
}
