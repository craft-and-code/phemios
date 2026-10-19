import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RelationGraph } from "../../../src/components/RelationGraph";
import { AudioScene } from "../../../src/components/AudioScene";
import { PlaybackLyrics } from "../../../src/components/PlaybackLyrics";
const meta = {
  title: "Editorial/WebsiteShowcase",
  parameters: {
    docs: {
      description: {
        component:
          "Actual UI renderers for website screenshots. All names, credits and words are fictional; no audio, account or network activity.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Connections: Story = {
  render: () => (
    <RelationGraph
      name="Orée"
      edges={[
        { name: "Nacre", kind: "artist" },
        { name: "Les heures bleues", kind: "album" },
        { name: "Clara Rivage", kind: "artist" },
        { name: "Courants", kind: "album" },
        { name: "Les Passagers", kind: "artist" },
        { name: "Rencontres", kind: "album" },
        { name: "Émile Varenne", kind: "artist" },
        { name: "Lisières", kind: "album" },
      ].map((node, index) => ({
        ...node,
        kind: node.kind as "artist" | "album",
        reference: `fictional:${index}`,
        weight: (index % 3) + 1,
        source: "Crédits fictifs",
      }))}
      onSelect={() => {}}
    />
  ),
};
export const Listening: Story = {
  render: () => (
    <div class="component-scene playback-lyric-stage" style={{ height: "560px" }}>
      <AudioScene scene="sphere" playing={false} levels={[0.4, 0.65, 0.25, 0.5]} />
      <PlaybackLyrics text="Les heures bleues nous emportent" floating={false} />
    </div>
  ),
};
