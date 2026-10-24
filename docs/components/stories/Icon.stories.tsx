import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, For } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { iconNames } from "../../../src/components/icon-symbols";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Foundation/Icon",
  component: Icon,
  args: { name: "cover-size" },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Lyrics: Story = { args: { name: "lyrics" } };
export const Playlist: Story = { args: { name: "playlist" } };

export const Genres: Story = { args: { name: "genres" } };
export const Composers: Story = { args: { name: "note" } };

export const Vocabulary: Story = {
  args: { name: "play" },
  render: () => (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "16px",
      }}
    >
      <For each={iconNames}>
        {(name) => (
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Icon name={name} />
            {name}
          </div>
        )}
      </For>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const symbols = canvasElement.querySelectorAll("svg");
    expect(symbols.length).toBe(iconNames.length);
    for (const svg of symbols) {
      expect(svg.getAttribute("width")).toBe("18");
      expect(svg.getAttribute("height")).toBe("18");
      expect(svg.getAttribute("stroke-width")).toBe("1.6");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.children.length).toBeGreaterThan(0);
    }
  },
};
export const ChangingState: Story = {
  args: { name: "play" },
  render: () => {
    const [playing, setPlaying] = createSignal(false);
    return (
      <button onClick={() => setPlaying(!playing())} aria-label="Toggle transport symbol">
        <Icon name={playing() ? "pause" : "play"} />
      </button>
    );
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Toggle transport symbol" });
    const before = button.querySelector("svg")!.innerHTML;
    await userEvent.click(button);
    expect(button.querySelector("svg")!.innerHTML).not.toBe(before);
    await userEvent.click(button);
    expect(button.querySelector("svg")!.innerHTML).toBe(before);
  },
};
