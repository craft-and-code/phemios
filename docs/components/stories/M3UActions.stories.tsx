import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { M3UActions } from "../../../src/components/M3UActions";
import { t } from "../../../src/i18n";
const meta = {
  title: "Data/M3UActions",
  component: M3UActions,
  args: {
    available: false,
    canCreate: true,
    enabled: true,
    busy: false,
    identity: "fixture",
    onCreate: () => {},
    onDownload: async () => true,
  },
} satisfies Meta<typeof M3UActions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingThenCreated: Story = {
  render: (args) => {
    const [available, setAvailable] = createSignal(false);
    return <M3UActions {...args} available={available()} onCreate={() => setAvailable(true)} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      create = canvas.getByRole("button", { name: t("Enregistrer le M3U sur Aède") }),
      download = canvas.getByRole("button", { name: t("Télécharger le M3U") });
    expect(download).toBeDisabled();
    expect(create).toBeEnabled();
    await userEvent.click(create);
    expect(create).toBeDisabled();
    expect(download).toBeEnabled();
    expect(canvasElement.querySelectorAll("button").length).toBe(2);
  },
};
export const Existing: Story = {
  args: { available: true },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Enregistrer le M3U sur Aède") })).toBeDisabled();
    expect(canvas.getByRole("button", { name: t("Télécharger le M3U") })).toBeEnabled();
  },
};
export const Offline: Story = { args: { enabled: false } };
