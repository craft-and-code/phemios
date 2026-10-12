import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ActionButton } from "../../../src/components/ActionButton";

const meta = {
  title: "Controls/ActionButton",
  component: ActionButton,
  args: { children: "Lecture", icon: "play", type: "button", busy: false, disabled: false },
  argTypes: {
    children: { control: "text" },
    icon: { control: "text" },
    busy: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The application's real shared action geometry. Busy work replaces the icon and disables the action.",
      },
    },
  },
} satisfies Meta<typeof ActionButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Working: Story = { args: { busy: true } };
export const Disabled: Story = { args: { disabled: true } };

export const PodcastSubscribe: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false);
    return (
      <form
        class="podcast-add"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
        }}
      >
        <label>
          Lien RSS du podcast
          <input type="url" value="https://example.org/feed.xml" />
        </label>
        <ActionButton type="submit" class="primary" icon="plus" busy={busy()}>
          S’abonner
        </ActionButton>
      </form>
    );
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "S’abonner" });
    const baseline = button.getBoundingClientRect();
    await userEvent.click(button);
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    const spinner = button.querySelector<HTMLElement>(".spinner")!;
    const rect = spinner.getBoundingClientRect(),
      after = button.getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(10);
    expect(Math.abs(rect.width - rect.height)).toBeLessThan(0.6);
    expect(Math.abs(after.width - baseline.width)).toBeLessThan(1);
    expect(Math.abs(after.height - baseline.height)).toBeLessThan(1);
    expect(Math.abs(rect.top + rect.height / 2 - after.top - after.height / 2)).toBeLessThan(0.6);
  },
};
