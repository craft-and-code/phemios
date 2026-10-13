import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ChoiceChips } from "../../../src/components/ChoiceChips";
import { selectCountries } from "../../../src/library/selection";
const meta = {
  title: "Controls/ChoiceChips",
  component: ChoiceChips,
  args: {
    label: "Genres",
    choices: [
      { id: "rock", label: "Rock" },
      { id: "metal", label: "Metal" },
    ],
    selected: [],
    onSelect: () => {},
  },
  render: (args) => {
    const [selected, setSelected] = createSignal<readonly (string | null)[]>(args.selected);
    return (
      <ChoiceChips
        {...args}
        selected={selected()}
        onSelect={(value, additive) => setSelected(selectCountries(selected(), value, additive))}
      />
    );
  },
} satisfies Meta<typeof ChoiceChips>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      rock = canvas.getByRole("button", { name: "Rock" });
    const original = rock.getBoundingClientRect().width;
    expect(rock.querySelector(".choice-chip-marker")).toBeNull();
    await userEvent.click(rock);
    await expect(rock).toHaveAttribute("aria-pressed", "true");
    expect(rock.getBoundingClientRect().width).toBeGreaterThan(original + 10);
    expect(getComputedStyle(rock).color).not.toBe(getComputedStyle(rock).backgroundColor);
    await userEvent.click(canvas.getByRole("button", { name: "Tous" }));
    await expect(rock).toHaveAttribute("aria-pressed", "false");
    expect(rock.getBoundingClientRect().width).toBe(original);
    rock.focus();
    await userEvent.keyboard("{Enter}");
    await expect(rock).toHaveAttribute("aria-pressed", "true");
  },
};
