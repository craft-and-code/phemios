import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { StarRating } from "../../../src/components/StarRating";
import { controlledValue } from "../fixtures/controlled";

const meta = {
  title: "Controls/StarRating",
  component: StarRating,
  args: { onChange: () => {}, value: 3, label: "Fictional album rating" },
  argTypes: {
    value: { control: { type: "number", min: 0, max: 5 } },
    floor: { control: { type: "number", min: 0, max: 5 } },
    onChange: { control: false },
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return (
      <>
        <StarRating {...args} value={value()} onChange={change} />
        <output class="component-readout">{value() ?? "Unrated"}</output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "The real compact overlapping rating buttons. Selecting the current rating clears it, except when an explicit filter floor protects its minimum.",
      },
    },
  },
} satisfies Meta<typeof StarRating>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ToggleRating: Story = {};
export const MinimumFilter: Story = { args: { value: 1, floor: 1 } };
