import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { TagInput } from "../../../src/components/TagInput";
import { t } from "../../../src/i18n";
import { controlledValue } from "../fixtures/controlled";

const meta = {
  title: "Controls/TagInput",
  component: TagInput,
  args: {
    onChange: () => {},
    onPending: () => {},
    onRead: () => {},
    value: ["music"],
    vocabulary: ["music", "musician", "live", "instrumental"],
    disabled: false,
    resetKey: "fictional-owner",
  },
  argTypes: {
    value: { control: "object" },
    vocabulary: { control: "object" },
    disabled: { control: "boolean" },
    onChange: { control: false },
    onRead: { control: false },
    onPending: { control: false },
  },
  render: (args) => {
    const [tags, change] = controlledValue(() => [...args.value]);
    const [pending, setPending] = createSignal(false);
    return (
      <>
        <TagInput
          {...args}
          value={tags()}
          onChange={change}
          onPending={setPending}
          onRead={() => {}}
        />
        <output class="component-readout">
          {JSON.stringify(tags())}
          {pending() ? " · Uncommitted text" : " · Confirmed in this fixture"}
        </output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "The real tag editor with a fictional vocabulary. Commas remain draft text; Enter commits several fragments. Backspace does not remove an existing pill.",
      },
    },
  },
} satisfies Meta<typeof TagInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const EnterCommitsFragments: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: t("Tags") });
    await userEvent.type(input, "live, instrumental");
    await expect(
      canvas.queryByRole("button", { name: t("Retirer le tag {0}", "live") }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("button", { name: t("Retirer le tag {0}", "live") }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: t("Retirer le tag {0}", "instrumental") }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Backspace}");
    await expect(
      canvas.getByRole("button", { name: t("Retirer le tag {0}", "instrumental") }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: t("Retirer le tag {0}", "live") }));
    await expect(
      canvas.queryByRole("button", { name: t("Retirer le tag {0}", "live") }),
    ).not.toBeInTheDocument();
  },
};
