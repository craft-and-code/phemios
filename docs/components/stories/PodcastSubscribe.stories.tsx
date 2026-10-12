import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { PodcastSubscribeForm } from "../../../src/components/PodcastSubscribeForm";
const meta = {
  title: "Controls/PodcastSubscribeForm",
  component: PodcastSubscribeForm,
  args: { url: "", busy: false, disabled: false, onInput: () => {}, onSubscribe: () => {} },
  render: (args) => {
    const [url, change] = createSignal(args.url),
      [busy, setBusy] = createSignal(args.busy);
    return (
      <PodcastSubscribeForm
        {...args}
        url={url()}
        busy={busy()}
        onInput={change}
        onSubscribe={() => setBusy(true)}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Actual RSS form with in-memory input and activity. No feed, account or audio request.",
      },
    },
  },
} satisfies Meta<typeof PodcastSubscribeForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      input = canvas.getByRole("textbox"),
      button = canvas.getByRole("button", { name: "S’abonner" });
    await expect(button).toBeDisabled();
    await userEvent.type(input, "https://example.org/feed.xml");
    await expect(button).toBeEnabled();
    await userEvent.clear(input);
    await expect(button).toBeDisabled();
    await userEvent.type(input, "https://example.org/feed.xml");
    await userEvent.click(button);
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};
export const ReadOnly: Story = { args: { url: "https://example.org/feed.xml", disabled: true } };
