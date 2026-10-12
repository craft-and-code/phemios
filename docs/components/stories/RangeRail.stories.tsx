import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { RangeRail } from "../../../src/components/RangeRail";
import { controlledValue } from "../fixtures/controlled";
import { t } from "../../../src/i18n";
const meta = {
  title: "Controls/RangeRail",
  component: RangeRail,
  args: {
    label: "Années",
    domain: [1990, 2020],
    value: [2000, 2010],
    ticks: [1990, 2000, 2010, 2020],
    format: (value: number) => String(value),
    bins: [
      { value: 2000, count: 8 },
      { value: 2005, count: 12 },
      { value: 2010, count: 2 },
    ],
    countLabel: "albums",
    resultCount: 22,
    onChange: () => {},
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return <RangeRail {...args} value={value()} onChange={change} />;
  },
} satisfies Meta<typeof RangeRail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Years: Story = {};
export const Alphabet: Story = {
  args: {
    label: "Alphabet",
    domain: [0, 26],
    value: [2, 12],
    ticks: [0, 5, 10, 15, 20, 26],
    format: (i) => "#ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i] ?? "#",
    bins: [
      { value: 2, count: 8 },
      { value: 5, count: 12 },
    ],
  },
};
export const KeyboardBand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: t("Déplacer la sélection {0}", "Années") }),
    );
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("slider", { name: t("{0} : début", "Années") })).toHaveValue(
      "2001",
    );
    await expect(canvas.getByRole("slider", { name: t("{0} : fin", "Années") })).toHaveValue(
      "2011",
    );
  },
};
