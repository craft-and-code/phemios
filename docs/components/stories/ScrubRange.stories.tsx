import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ScrubRange } from "../../../src/components/ScrubRange";
import { controlledValue } from "../fixtures/controlled";

const meta = {
  title: "Controls/ScrubRange",
  component: ScrubRange,
  args: {
    "aria-label": "Fictional catalogue position",
    min: 0,
    max: 100,
    step: 1,
    value: 50,
    disabled: false,
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    disabled: { control: "boolean" },
    onInput: { control: false },
  },
  render: (args) => {
    const [value, change] = controlledValue(() => Number(args.value));
    return (
      <>
        <div class="component-size">
          <ScrubRange
            {...args}
            value={value()}
            onInput={(event) => change(Number(event.currentTarget.value))}
          />
        </div>
        <output class="component-readout">{value()} / 100</output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Thin native range shared by Cover Flow and artwork sizing. This fixture has no catalogue or playback transport.",
      },
    },
  },
} satisfies Meta<typeof ScrubRange>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Disabled: Story = { args: { disabled: true } };
