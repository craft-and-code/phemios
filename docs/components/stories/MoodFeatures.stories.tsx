import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { MoodFeatures } from "../../../src/components/MoodFeatures";
const meta = {
  title: "Data/MoodFeatures",
  component: MoodFeatures,
  args: {
    coverage: { profile: 1, ready: 12, missing: 38, cache_errors: 0, warming: false },
    admin: true,
    submitting: false,
    onStart: () => {},
    onStop: () => {},
  },
} satisfies Meta<typeof MoodFeatures>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {
  play: ({ canvasElement }) => {
    const heading = canvasElement.querySelector("h2")!,
      action = canvasElement.querySelector("button")!;
    const title = heading.getBoundingClientRect(),
      button = action.getBoundingClientRect();
    expect(Math.abs(title.top + title.height / 2 - button.top - button.height / 2)).toBeLessThan(1);
    expect(canvasElement.querySelector(".page-heading p")).toBeNull();
  },
};
export const WaitingForPlayback: Story = {
  render: (args) => {
    const [stopped, setStopped] = createSignal(false);
    return (
      <MoodFeatures
        {...args}
        {...(!stopped()
          ? {
              job: {
                task_id: 1,
                source: "local" as const,
                kind: "mood_features",
                status: "running" as const,
                progress: {
                  phase: "waiting_for_playback" as const,
                  done: 12,
                  total: 50,
                  analyzed: 10,
                  reused: 2,
                  failed: 0,
                },
              },
            }
          : {})}
        onStop={() => setStopped(true)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/En attente de la fin de lecture/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Arrêter" }));
    expect(canvas.getByRole("button", { name: "Analyser en arrière-plan" })).toBeVisible();
  },
};

export const CacheLookupDuringPlayback: Story = {
  args: { coverage: { profile: 1, ready: 0, missing: 5, cache_errors: 0, warming: true } },
  play: async ({ canvasElement }) => {
    expect(
      within(canvasElement).getByRole("button", { name: "Analyser en arrière-plan" }),
    ).toBeEnabled();
  },
};
