import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PodcastEpisodeList } from "../../../src/components/PodcastEpisodeList";
import { DownloadButton } from "../../../src/components/DownloadButton";
import { Icon } from "../../../src/components/Icon";
import { t } from "../../../src/i18n";
const episodes = Array.from({ length: 63 }, (_, i) => ({
  id: String(i),
  title: `Épisode ${i + 1}`,
  url: `https://example.org/episode-${i}.mp3`,
  date: null,
  duration: 1800,
  summary: "Résumé fictif de cet épisode.",
}));
const meta = {
  title: "Media/PodcastEpisodes",
  component: PodcastEpisodeList,
  args: {
    episodes,
    scope: "fictional-owner/feed",
    actions: (row) => (
      <>
        <DownloadButton label={`Download ${row.title}`} onClick={() => true} />
        <button class="icon-button quiet" aria-label={`Play ${row.title}`}>
          <Icon name="play" />
        </button>
      </>
    ),
  },
  render: (args) => (
    <div class="podcast-library" style={{ display: "block" }}>
      <section class="podcast-episodes">
        <PodcastEpisodeList {...args} />
      </section>
    </div>
  ),
} satisfies Meta<typeof PodcastEpisodeList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Paged: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("listitem")).toHaveLength(25);
    const first = canvasElement.querySelector(".podcast-episode-actions")!;
    const buttons = first.querySelectorAll("button");
    expect(
      buttons[1]!.getBoundingClientRect().left - buttons[0]!.getBoundingClientRect().right,
    ).toBe(4);
    expect(getComputedStyle(canvasElement.querySelector("li:last-child")!).borderBottomWidth).toBe(
      "0px",
    );
    await userEvent.click(canvas.getByRole("button", { name: t("Suivant") }));
    expect(canvas.getByText("Épisode 26")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: t("Suivant") }));
    expect(canvas.getAllByRole("listitem")).toHaveLength(13);
    expect(canvas.getByRole("button", { name: t("Suivant") })).toBeDisabled();
  },
};
