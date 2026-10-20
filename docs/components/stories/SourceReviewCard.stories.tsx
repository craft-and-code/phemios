import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { SourceReviewCard } from "../../../src/components/SourceReviewCard";
import type { SourceReviewItem } from "../../../src/library/source-review";
const row: SourceReviewItem = {
  id: "1111111111111111",
  revision: "2222222222222222",
  reference: "artist:example",
  name: "Example Ensemble",
  kind: "artist",
  source_id: "11111111-1111-4111-8111-111111111111",
  url: "https://musicbrainz.org/artist/11111111-1111-4111-8111-111111111111",
  score: 95,
  decision: null,
  local_mbid: null,
  details: [
    ["type", "Group"],
    ["country", "GB"],
    ["began", "1998"],
    ["disambiguation", "Fictional catalogue evidence"],
  ],
};
const meta = {
  title: "Catalog/SourceReviewCard",
  component: SourceReviewCard,
  args: {
    row,
    busy: false,
    disabled: false,
    biographyAvailable: true,
    onDecision: () => {},
    onBiography: () => {},
  },
  render: (args) => {
    const [decision, setDecision] = createSignal(args.row.decision);
    return (
      <div class="settings-card">
        <SourceReviewCard
          {...args}
          row={{ ...args.row, decision: decision() }}
          onDecision={(action) =>
            setDecision(action === "accept" ? "accepted" : action === "reject" ? "rejected" : null)
          }
          onBiography={() => setDecision("accepted")}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Stored MusicBrainz evidence with fictional identities. Decisions in this story affect presentation only; no account, engine or external request is used.",
      },
    },
  },
} satisfies Meta<typeof SourceReviewCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Pending: Story = {};
export const Accepted: Story = { args: { row: { ...row, decision: "accepted" } } };
export const Rejected: Story = { args: { row: { ...row, decision: "rejected" } } };
export const Busy: Story = { args: { busy: true, disabled: true } };
