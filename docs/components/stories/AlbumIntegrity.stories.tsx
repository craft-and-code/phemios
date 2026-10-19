import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { AlbumIntegrity } from "../../../src/components/AlbumIntegrity";
const meta = {
  title: "Actions/AlbumIntegrity",
  component: AlbumIntegrity,
  args: { busy: false, enabled: true, cancellable: false, onStart: () => {}, onCancel: () => {} },
  parameters: {
    docs: {
      description: {
        component:
          "Fresh full decode action; current results are transient per-track badges, with no report download.",
      },
    },
  },
} satisfies Meta<typeof AlbumIntegrity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Unavailable: Story = { args: { enabled: false } };
export const Admission: Story = { args: { busy: true } };
export const Cancellation: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false);
    return (
      <AlbumIntegrity
        enabled
        busy={busy()}
        cancellable={busy()}
        onStart={() => setBusy(true)}
        onCancel={() => setBusy(false)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Tester l’intégrité de l’album" });
    const before = button.getBoundingClientRect();
    await userEvent.click(button);
    const stop = canvas.getByRole("button", { name: "Arrêter le test" });
    expect(stop).toHaveAttribute("aria-busy", "true");
    await userEvent.hover(stop);
    expect(stop.querySelector(".activity-stop")).toBeVisible();
    expect(stop.getBoundingClientRect().width).toBe(before.width);
    expect(stop.getBoundingClientRect().height).toBe(before.height);
    await userEvent.click(stop);
    expect(
      canvas.getByRole("button", { name: "Tester l’intégrité de l’album" }),
    ).not.toHaveAttribute("aria-busy");
    expect(canvas.queryByText(/JSON/)).toBeNull();
  },
};
export const TracksUnavailableDuringCheck: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false),
      [cancelled, setCancelled] = createSignal(false);
    return (
      <>
        <AlbumIntegrity
          enabled={!busy()}
          busy={busy()}
          cancellable={busy()}
          onStart={() => setBusy(true)}
          onCancel={() => {
            setBusy(false);
            setCancelled(true);
          }}
        />
        <output>{cancelled() ? "Cancellation confirmed" : ""}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Tester l’intégrité de l’album" }));
    const stop = canvas.getByRole("button", { name: "Arrêter le test" });
    await expect(stop).toBeEnabled();
    await userEvent.click(stop);
    await expect(
      canvas.getByRole("button", { name: "Tester l’intégrité de l’album" }),
    ).toBeEnabled();
  },
};
