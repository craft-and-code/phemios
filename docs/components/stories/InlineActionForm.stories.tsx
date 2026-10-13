import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { InlineActionForm } from "../../../src/components/InlineActionForm";
import { ActionButton } from "../../../src/components/ActionButton";
const meta = {
  title: "Controls/InlineActionForm",
  component: InlineActionForm,
  render: () => {
    const [busy, setBusy] = createSignal(false);
    return (
      <InlineActionForm
        class="wikipedia-search"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
        }}
      >
        <label>
          Recherche Wikipédia
          <input value="Fictional artist" />
        </label>
        <ActionButton type="submit" icon="search" busy={busy()}>
          Rechercher
        </ActionButton>
      </InlineActionForm>
    );
  },
} satisfies Meta<typeof InlineActionForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      input = canvas.getByRole("textbox"),
      button = canvas.getByRole("button", { name: "Rechercher" });
    const before = input.getBoundingClientRect(),
      action = button.getBoundingClientRect();
    expect(before.height).toBeGreaterThan(20);
    expect(Math.abs(before.height - action.height)).toBeLessThan(0.6);
    expect(Math.abs(before.top - action.top)).toBeLessThan(0.6);
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.getBoundingClientRect().height).toBe(action.height);
  },
};
