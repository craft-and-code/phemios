import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Feedback } from "../../../src/components/Feedback";
import { t } from "../../../src/i18n";

const meta = {
  title: "Status/Feedback",
  component: Feedback,
  args: { message: "Déconnectez la session active avant de changer de compte.", error: true },
  argTypes: { message: { control: "text" }, error: { control: "boolean" } },
  parameters: {
    docs: {
      description: {
        component:
          "Real dismissible feedback. Pointer/focus pauses expiry; long messages keep the close action aligned within the same surface.",
      },
    },
  },
} satisfies Meta<typeof Feedback>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Error: Story = {};
export const LongMessage: Story = {
  args: {
    message:
      "This fictional action could not be completed. A long explanatory message wraps inside a narrow surface without displacing its dismiss button. No request or account change occurs in this fixture.",
  },
};
export const Dismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("Masquer la notification") }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
