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

export const CancelReload: Story = {
  render: (args) => {
    const [busy, setBusy] = createSignal(false),
      [result, setResult] = createSignal("Idle");
    return (
      <>
        <ConnectionActions
          {...args}
          syncing={busy()}
          onSync={(signal) => {
            setBusy(true);
            setResult("Waiting");
            return new Promise<void>((done) =>
              signal.addEventListener(
                "abort",
                () => {
                  setBusy(false);
                  setResult("Cancelled");
                  done();
                },
                { once: true },
              ),
            );
          }}
        />
        <output>{result()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: t("Recharger le catalogue connu") });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    const glyph = button.querySelector(".activity-glyph")!.getBoundingClientRect();
    expect(glyph.width).toBe(18);
    expect(glyph.height).toBe(18);
    await userEvent.hover(button);
    expect(getComputedStyle(button.querySelector(".activity-stop")!).opacity).toBe("1");
    await userEvent.click(button);
    expect(canvas.getByText("Cancelled")).toBeVisible();
    expect(button).not.toHaveAttribute("aria-busy");
  },
};
