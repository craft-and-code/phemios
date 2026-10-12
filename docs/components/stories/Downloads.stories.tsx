import { createSignal, onCleanup, type ComponentProps } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DownloadButton } from "../../../src/components/DownloadButton";

type DownloadArgs = ComponentProps<typeof DownloadButton> & {
  outcome?: "success" | "cancel" | "error";
};
function DownloadFixture(args: DownloadArgs) {
  const [result, setResult] = createSignal("Not started");
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer);
  });
  async function publish() {
    setResult("Pending fictional publication");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, 200);
      timers.add(timer);
    });
    if (args.outcome === "error") {
      setResult("Failed");
      throw new Error("Fictional download failure; no file was written.");
    }
    if (args.outcome === "cancel") {
      setResult("Cancelled");
      return false;
    }
    setResult("Published in memory");
    return "fictional-report.json";
  }
  return (
    <>
      <div class="component-download">
        <DownloadButton {...args} onClick={publish} />
      </div>
      <output class="component-readout" data-testid="publication">
        {result()}
      </output>
    </>
  );
}
const meta = {
  title: "Status/DownloadButton",
  component: DownloadButton,
  args: {
    onClick: () => {},
    label: "Download fictional report",
    disabled: false,
    outcome: "success",
  },
  argTypes: {
    label: { control: "text" },
    disabled: { control: "boolean" },
    outcome: { control: "select", options: ["success", "cancel", "error"] },
    onClick: { control: false },
  },
  render: (args) => <DownloadFixture {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          "The real download feedback control. A delayed in-memory operation demonstrates pending, confirmed, cancelled and failed publication; it never creates a file.",
      },
    },
  },
} satisfies Meta<DownloadArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Download fictional report" });
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await waitFor(async () => {
      await expect(button).toHaveClass("download-complete");
    });
  },
};
export const Cancelled: Story = {
  args: { outcome: "cancel" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Download fictional report" });
    await userEvent.click(button);
    await waitFor(async () => {
      await expect(canvas.getByTestId("publication")).toHaveTextContent("Cancelled");
    });
    await expect(button).not.toHaveClass("download-complete");
    await expect(button).not.toBeDisabled();
  },
};
export const Failed: Story = { args: { outcome: "error" } };
export const Disabled: Story = { args: { disabled: true } };
