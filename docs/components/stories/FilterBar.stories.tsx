import { expect, userEvent, within } from "storybook/test";
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
export const Selection: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector(".filter-options")!;
    const controls = [...row.querySelectorAll("button")];
    const centers = controls.map((element) => {
      const box = element.getBoundingClientRect();
      expect(box.height).toBe(30);
      return box.top + box.height / 2;
    });
    const reference = centers[0]!;
    for (const center of centers) expect(Math.abs(center - reference)).toBeLessThan(1);
    for (const element of row.querySelectorAll("label, .filter-context")) {
      const box = element.getBoundingClientRect();
      expect(Math.abs(box.top + box.height / 2 - reference)).toBeLessThan(1);
    }
  },
};

export const HiddenRails: Story = {
  args: { value: { ...filters, mode: "none" } },
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector(".filter-options")!.getBoundingClientRect();
    const surface = canvasElement.querySelector(".filters")!.getBoundingClientRect();
    for (const button of canvasElement.querySelectorAll(".filter-options button")) {
      const box = button.getBoundingClientRect();
      expect(
        Math.abs(box.top + box.height / 2 - (surface.top + (surface.height - 1) / 2)),
      ).toBeLessThan(1);
    }
    const switches = canvasElement.querySelector(".rail-switches")!.getBoundingClientRect();
    const context = canvasElement.querySelector(".filter-context")!.getBoundingClientRect();
    const count = canvasElement
      .querySelector(".filter-options > .result-count")!
      .getBoundingClientRect();
    expect(context.left).toBeGreaterThan(switches.right);
    expect(Math.abs(count.left + count.width / 2 - (bar.left + bar.width / 2))).toBeLessThan(1);
  },
};

export const ToggleWithoutMovingControls: Story = {
  args: { value: { ...filters, mode: "none" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const measure = () =>
      [...canvasElement.querySelectorAll(".filter-options button")].map((element) => {
        const box = element.getBoundingClientRect();
        return [box.left, box.top, box.width, box.height];
      });
    const initial = measure();
    for (const name of [
      "Réglette des années",
      "Réglette alphabétique",
      "Réglette des années",
      "Réglette alphabétique",
      "Réglette alphabétique",
      "Réglette des années",
      "Réglette alphabétique",
      "Réglette des années",
    ]) {
      await userEvent.click(canvas.getByRole("button", { name }));
      const next = measure();
      for (let i = 0; i < initial.length; i++)
        for (let j = 0; j < 4; j++)
          expect(Math.abs(next[i]![j]! - initial[i]![j]!)).toBeLessThan(1);
    }
  },
};
export const NarrowToggle: Story = {
  ...ToggleWithoutMovingControls,
  decorators: [
    (Story) => (
      <div style={{ width: "420px" }}>
        <Story />
      </div>
    ),
  ],
};
