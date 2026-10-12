import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RadioWave } from "../../../src/components/RadioWave";
type WaveArgs = { amplitude: number };
const meta = {
  title: "Media/RadioWave",
  args: { amplitude: 0.4 },
  argTypes: { amplitude: { control: { type: "range", min: 0, max: 1, step: 0.05 } } },
  render: (args) => (
    <svg class="radio-scale" viewBox="0 0 900 120" aria-label="Fictional radio signal">
      <RadioWave
        sample={(target) => {
          for (let index = 0; index < target.length; index++)
            target[index] = args.amplitude * Math.sin(index * 0.06 + performance.now() / 500);
          return args.amplitude > 0;
        }}
      />
    </svg>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Real resident waveform renderer with fictional PCM values only. Zero amplitude retains the travelling idle wave; no station, audio output or network is used.",
      },
    },
  },
} satisfies Meta<WaveArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MeasuredSignal: Story = {};
export const Idle: Story = { args: { amplitude: 0 } };
