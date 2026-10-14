import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { LibraryGenerations } from "../../../src/components/LibraryGenerations";
const meta = {
  title: "Data/LibraryGenerations",
  component: LibraryGenerations,
  args: {
    enabled: true,
    reserved: false,
    cancellable: false,
    onStart: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof LibraryGenerations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const NoAccount: Story = { args: { enabled: false } };
export const AllRunning: Story = { args: { reserved: true, action: "all", cancellable: true } };
export const SerialAdmission: Story = {
  render: (args) => {
    const [action, setAction] = createSignal<"m3u" | undefined>();
    return (
      <LibraryGenerations
        {...args}
        reserved={!!action()}
        action={action()}
        cancellable={!!action()}
        onStart={() => setAction("m3u")}
        onCancel={() => setAction(undefined)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Listes M3U" }));
    expect(canvasElement.querySelectorAll(".spinner")).toHaveLength(1);
    for (const button of canvasElement.querySelectorAll(".action-button"))
      expect(button).toBeDisabled();
    const busy = canvas.getByRole("button", { name: "Listes M3U" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Arrêter les générations" }));
    expect(canvasElement.querySelectorAll(".spinner")).toHaveLength(0);
    expect(canvas.getByRole("button", { name: "Tout lancer" })).toBeEnabled();
  },
};
