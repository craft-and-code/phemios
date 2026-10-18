import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect } from "storybook/test";
import { For } from "solid-js";
import { Icon } from "../../../src/components/Icon";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
import { QueueAppendView } from "../../../src/components/QueueAppendView";
import { PlaybackActionsView } from "../../../src/components/PlaybackActionsView";
const meta = {
  title: "Controls/RowActions",
  render: () => (
    <For
      each={[
        "track-actions",
        "coverage-actions",
        "detail-export-actions",
        "history-row",
        "label-row",
        "collection-row",
        "density-compact",
      ]}
    >
      {(name) => (
        <div class={name}>
          <div
            class={name === "density-compact" ? "album-card" : ""}
            style={{ display: "flex", gap: "4px", "align-items": "center", padding: "8px" }}
          >
            <span>{name}</span>
            <button class="icon-button quiet" aria-label="Analysis">
              <Icon name="wave" />
            </button>
            <PlaybackActionsView
              class={
                name === "history-row" ? "history-play" : name === "label-row" ? "label-play" : ""
              }
              append={
                <QueueAppendView
                  reference="track:fixture"
                  title="Fixture"
                  onAppend={async () => 1}
                />
              }
              play={
                <CoverPlayView
                  reference="track:fixture"
                  title="Fixture"
                  class={
                    name === "history-row"
                      ? "history-play"
                      : name === "label-row"
                        ? "label-play"
                        : ""
                  }
                  onPlay={async () => {}}
                />
              }
            />
          </div>
        </div>
      )}
    </For>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Consistent: Story = {
  play: async ({ canvasElement }) => {
    for (const button of canvasElement.querySelectorAll("button.icon-button")) {
      const rect = button.getBoundingClientRect();
      expect(rect.width).toBe(30);
      expect(rect.height).toBe(30);
      const svg = button.querySelector("svg")!.getBoundingClientRect();
      expect(svg.width).toBe(18);
      expect(svg.height).toBe(18);
    }
    for (const group of canvasElement.querySelectorAll(".media-actions"))
      expect(getComputedStyle(group).gap).toBe("4px");
  },
};
