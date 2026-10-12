import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { RadioSearch } from "../../../src/components/RadioSearch";
import { controlledValue } from "../fixtures/controlled";
import { t } from "../../../src/i18n";
const meta = {
  title: "Controls/RadioSearch",
  component: RadioSearch,
  args: {
    value: { name: "", country: "FR", tag: "", secureOnly: false },
    busy: false,
    available: true,
    change: () => {},
    submit: () => {},
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value),
      [count, setCount] = createSignal(0);
    return (
      <>
        <RadioSearch
          {...args}
          value={value()}
          change={(patch) => change({ ...value(), ...patch })}
          submit={() => setCount((n) => n + 1)}
        />
        <output data-testid="search-count" class="component-readout">
          {count()}
        </output>
      </>
    );
  },
} satisfies Meta<typeof RadioSearch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Busy: Story = { args: { busy: true } };
export const EnterSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("searchbox", { name: t("Station") }),
      "Example FM{Enter}",
    );
    await expect(canvas.getByTestId("search-count")).toHaveTextContent("1");
  },
};
