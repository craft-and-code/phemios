import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, within } from "storybook/test";
import { TrackIntegrity } from "../../../src/components/TrackIntegrity";
const meta = {
  title: "Data/TrackIntegrity",
  component: TrackIntegrity,
  args: { result: undefined },
  render: (args) => (
    <span class="track-title">
      <TrackIntegrity {...args} />
      <span>Fictional track</span>
    </span>
  ),
} satisfies Meta<typeof TrackIntegrity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Untested: Story = {};
export const Verified: Story = {
  args: { result: { status: "ok", verifier: "Rust · FLAC MD5 verified" } },
};
export const Failed: Story = {
  args: { result: { status: "ko", verifier: "Failed", message: "MD5 mismatch" } },
};
export const NoHash: Story = {
  args: { result: { status: "no_hash", verifier: "Rust · decoded, no FLAC MD5" } },
};
export const AllStates: Story = {
  render: () => (
    <div>
      <p>
        <TrackIntegrity result={{ status: "ok", verifier: "Rust" }} /> Fictional verified track
      </p>
      <p>
        <TrackIntegrity result={{ status: "ko", verifier: "Rust", message: "MD5 mismatch" }} />{" "}
        Fictional rejected track
      </p>
      <p>
        <TrackIntegrity result={{ status: "no_hash", verifier: "Rust" }} /> Fictional decoded track
      </p>
      <p>
        <TrackIntegrity result={undefined} /> Fictional untested track
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("img")).toHaveLength(3);
    const ok = canvas.getByRole("img", { name: "Empreinte vérifiée" });
    const ko = canvas.getByRole("img", { name: "Échec du contrôle d’intégrité" });
    expect(ok.querySelector("svg")?.getBoundingClientRect().width).toBe(16);
    expect(ko.querySelector("svg")?.getBoundingClientRect().width).toBe(16);
    expect(getComputedStyle(ok).color).not.toBe(getComputedStyle(ko).color);
    expect(canvas.getByText("Sans hash")).toBeVisible();
    expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};
