import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
const meta = {
  title: "Controls/CoverPlay",
  component: CoverPlayView,
  args: { reference: "artist:fictional", title: "The Northern Lights", onPlay: async () => {} },
  render: (args) => {
    const [starts, setStarts] = createSignal(0);
    let release: (() => void) | undefined;
    return (
      <>
        <div class="component-controls">
          <CoverPlayView
            {...args}
            onPlay={() => {
              setStarts(starts() + 1);
              return new Promise<void>((resolve) => {
                release = resolve;
              });
            }}
          />
        </div>
        <output aria-label="Playback requests">{starts()}</output>
        <button onClick={() => release?.()}>Complete request</button>
      </>
    );
  },
} satisfies Meta<typeof CoverPlayView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Starting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      play = canvas.getByRole("button", { name: "Lire The Northern Lights" });
    await userEvent.click(play);
    expect(play).toHaveAttribute("aria-busy", "true");
    expect(play).toBeDisabled();
    expect(play.querySelector("svg")).not.toBeNull();
    expect(play.querySelector(".spinner")).toBeNull();
    await userEvent.click(play);
    expect(canvas.getByLabelText("Playback requests")).toHaveTextContent("1");
    await userEvent.click(canvas.getByRole("button", { name: "Complete request" }));
    await waitFor(() => expect(play).toBeEnabled());
    expect(play).toHaveAttribute("aria-busy", "false");
  },
};
