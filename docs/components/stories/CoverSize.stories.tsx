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
