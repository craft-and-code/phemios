import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, within } from "storybook/test";
import { JamBaseSettingsView } from "../../../src/components/JamBaseSettingsView";
const meta = {
  title: "Settings/JamBase",
  component: JamBaseSettingsView,
  args: {
    key: "",
    busy: false,
    native: true,
    removable: false,
    onKey: () => {},
    onSave: () => {},
    status: { ready: false, limit: 1000, used: 0, remaining: 1000, resetAt: null },
  },
  render: (args) => (
    <div class="settings-page" style={{ "max-width": "900px", padding: "24px" }}>
      <div class="settings-card">
        <JamBaseSettingsView {...args} />
      </div>
    </div>
  ),
} satisfies Meta<typeof JamBaseSettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingKey: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    expect(canvas.getByLabelText("Clé API JamBase")).toHaveAttribute("type", "password");
    expect(canvas.getByRole("link", { name: "Obtenir une clé" })).toHaveAttribute(
      "href",
      "https://data.jambase.com/try/",
    );
  },
};
export const Configured: Story = {
  args: {
    status: { ready: true, limit: 1000, used: 126, remaining: 874, resetAt: 1795039200 },
    removable: true,
  },
};
export const Exhausted: Story = {
  args: {
    status: { ready: true, limit: 1000, used: 1000, remaining: 0, resetAt: 1795039200 },
    removable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("status")).toHaveTextContent("1000 / 1000");
    expect(canvas.getByRole("button", { name: "Supprimer la clé" })).not.toBeDisabled();
  },
};
