import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { FilterBar } from "../../../src/components/FilterBar";
import { controlledValue } from "../fixtures/controlled";
import { filters } from "../fixtures/filters";
const meta = {
  title: "Controls/FilterBar",
  component: FilterBar,
  args: {
    value: filters,
    setValue: () => {},
    yearDomain: [1990, 2020],
    context: "Fictional album catalogue",
    histogram: { years: [{ value: 2000, count: 8 }], alphabet: [{ value: 2, count: 8 }] },
    countLabel: "albums",
    resultCount: 8,
    hasUnknownYear: true,
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return <FilterBar {...args} value={value()} setValue={change} />;
  },
} satisfies Meta<typeof FilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selection: Story = {};
