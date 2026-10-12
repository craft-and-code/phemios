import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { CoverSize } from "../../../src/components/CoverSize";
import { controlledValue } from "../fixtures/controlled";
import { t } from "../../../src/i18n";

const meta = {
  title: "Controls/CoverSize",
  component: CoverSize,
  args: { onChange: () => {}, value: 150, disabled: false },
  argTypes: {
    value: { control: { type: "range", min: 100, max: 280, step: 10 } },
    disabled: { control: "boolean" },
    onChange: { control: false },
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return (
      <>
        <div class="component-size">
          <CoverSize value={value()} disabled={args.disabled} onChange={change} />
        </div>
        <output class="component-readout">{value()} px</output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "The real artwork-size control. Its selected value is local to this story; double-click restores 150 px.",
      },
    },
  },
} satisfies Meta<typeof CoverSize>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const DisabledInCoverFlow: Story = { args: { disabled: true } };
export const DoubleClickReset: Story = {
  args: { value: 260 },
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", { name: t("Taille des pochettes") });
    await userEvent.dblClick(slider);
    await expect(slider).toHaveValue("150");
  },
};

export const IconReset: Story = {
  args: { value: 260 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reset = canvas.getByRole("button", {
      name: t("Taille des pochettes · double-clic pour réinitialiser"),
    });
    const slider = canvas.getByRole("slider", { name: t("Taille des pochettes") });
    await userEvent.click(reset);
    await expect(slider).toHaveValue("260");
    await userEvent.dblClick(reset);
    await expect(slider).toHaveValue("150");
    await expect(canvasElement.querySelector(".cover-size-control output")).toHaveTextContent(
      "150 px",
    );
  },
};

export const KeyboardReset: Story = {
  args: { value: 280 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reset = canvas.getByRole("button", {
      name: t("Taille des pochettes · double-clic pour réinitialiser"),
    });
    reset.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("slider", { name: t("Taille des pochettes") })).toHaveValue(
      "150",
    );
  },
};
export const DisabledReset: Story = {
  args: { value: 260, disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reset = canvas.getByRole("button", {
      name: t("Taille des pochettes · double-clic pour réinitialiser"),
    });
    await expect(reset).toBeDisabled();
    await userEvent.dblClick(reset);
    await expect(canvas.getByRole("slider", { name: t("Taille des pochettes") })).toBeDisabled();
    await expect(canvas.getByRole("slider", { name: t("Taille des pochettes") })).toHaveValue(
      "260",
    );
  },
};
