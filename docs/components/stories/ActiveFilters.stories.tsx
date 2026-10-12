import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ActiveFilters } from "../../../src/components/ActiveFilters";
import { controlledValue } from "../fixtures/controlled";
import { filters } from "../fixtures/filters";
const meta = {
  title: "Controls/ActiveFilters",
  component: ActiveFilters,
  args: { value: filters, setValue: () => {}, domain: [1990, 2020], catalog: true },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return <ActiveFilters {...args} value={value()} setValue={change} />;
  },
} satisfies Meta<typeof ActiveFilters>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selection: Story = {};
