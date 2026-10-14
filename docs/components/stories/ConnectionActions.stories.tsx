import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ConnectionActions } from "../../../src/components/ConnectionActions";
import { t } from "../../../src/i18n";
const meta = {
  title: "Controls/ConnectionActions",
  component: ConnectionActions,
  args: { syncing: false, disconnecting: false, onSync: () => {}, onDisconnect: () => {} },
} satisfies Meta<typeof ConnectionActions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Disconnecting: Story = { args: { disconnecting: true } };
export const LogoutDuringSync: Story = {
  args: { syncing: true },
  render: (args) => {
    const [connected, setConnected] = createSignal(true);
    return (
      <>
        <ConnectionActions {...args} onDisconnect={() => setConnected(false)} />
        <output>{connected() ? "Connected" : "Disconnected"}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      disconnect = canvas.getByRole("button", { name: t("Se déconnecter") });
    expect(disconnect).toBeEnabled();
    await userEvent.click(disconnect);
    expect(canvas.getByRole("status")).toHaveTextContent("Disconnected");
  },
};
