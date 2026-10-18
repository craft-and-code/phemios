import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { DisplayAwakeSettings } from "../../../src/components/DisplayAwakeSettings";
import { t } from "../../../src/i18n";
const meta = {
  title: "Settings/DisplayAwake",
  component: DisplayAwakeSettings,
  args: { enabled: true, error: "", onChange: () => {} },
  render: (args) => {
    const [enabled, setEnabled] = createSignal(args.enabled);
    return <DisplayAwakeSettings {...args} enabled={enabled()} onChange={setEnabled} />;
  },
} satisfies Meta<typeof DisplayAwakeSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playback: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("checkbox", {
      name: t("Garder l’écran actif pendant la lecture"),
    });
    const label = input.closest("label")!,
      text = label.querySelector("span")!;
    expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(24);
    expect(
      Math.abs(
        input.getBoundingClientRect().y +
          input.getBoundingClientRect().height / 2 -
          text.getBoundingClientRect().y -
          text.getBoundingClientRect().height / 2,
      ),
    ).toBeLessThan(1);
    expect(input).toBeChecked();
    await userEvent.click(input);
    expect(input).not.toBeChecked();
    await userEvent.click(input);
    expect(input).toBeChecked();
  },
};
export const Unavailable: Story = {
  args: { error: "Maintien de l’écran indisponible sur ce système." },
};
export const Browser: Story = { args: { disabled: true } };
