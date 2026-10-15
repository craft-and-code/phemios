import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { PlaybackActionsView } from "../../../src/components/PlaybackActionsView";
import { QueueAppendView } from "../../../src/components/QueueAppendView";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
const meta = {
  title: "Controls/PlaybackActions",
  component: PlaybackActionsView,
  args: { class: "", append: undefined, play: undefined },
  render: (args) => {
    const [additions, setAdditions] = createSignal(0),
      [starts, setStarts] = createSignal(0),
      [navigation, setNavigation] = createSignal(0);
    let complete: () => void = () => {};
    return (
      <>
        <article
          class="album-card"
          style={{ width: args.class ? "600px" : "180px" }}
          onClick={() => setNavigation(navigation() + 1)}
        >
          <a class="album-art-link" href="#fictional">
            <div
              class="artwork"
              style={{ background: "linear-gradient(135deg,#315458,#142224)" }}
            />
          </a>
          <a class="album-title-link" href="#fictional">
            <strong>First Album</strong>
          </a>
          <small class="album-year">2001</small>
          <PlaybackActionsView
            {...args}
            append={
              <QueueAppendView
                reference="release:example"
                title="First Album"
                class={`cover-play ${args.class}`}
                onAppend={() => {
                  setAdditions(additions() + 1);
                  return new Promise((resolve) => {
                    complete = () => resolve(10);
                  });
                }}
              />
            }
            play={
              <CoverPlayView
                reference="release:example"
                title="First Album"
                class={args.class}
                onPlay={async () => {
                  setStarts(starts() + 1);
                }}
              />
            }
          />
        </article>
        <output aria-label="Additions">{additions()}</output>
        <output aria-label="Starts">{starts()}</output>
        <output aria-label="Navigation">{navigation()}</output>
        <button onClick={() => complete()}>Confirm addition</button>
      </>
    );
  },
} satisfies Meta<typeof PlaybackActionsView>;
export default meta;
type Story = StoryObj<typeof meta>;
const interaction: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement),
    add = canvas.getByRole("button", { name: "Ajouter First Album à la suite" }),
    play = canvas.getByRole("button", { name: "Lire First Album" });
  await userEvent.hover(canvasElement.querySelector("article")!);
  const a = add.getBoundingClientRect(),
    p = play.getBoundingClientRect();
  expect(a.width).toBe(p.width);
  expect(a.height).toBe(p.height);
  expect(getComputedStyle(add).borderRadius).toBe(getComputedStyle(play).borderRadius);
  expect(a.right).toBeLessThanOrEqual(p.left);
  expect(Math.abs(a.top + a.bottom - (p.top + p.bottom))).toBeLessThanOrEqual(2);
  await userEvent.click(add);
  expect(add).toBeDisabled();
  expect(add).toHaveAttribute("aria-busy", "true");
  expect(canvas.getByLabelText("Additions")).toHaveTextContent("1");
  expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  expect(canvas.getByLabelText("Navigation")).toHaveTextContent("0");
  await userEvent.click(canvas.getByRole("button", { name: "Confirm addition" }));
  await waitFor(() => expect(add).toHaveClass("download-complete"));
  expect(add.querySelector(".spinner")).toBeNull();
};
export const List: Story = {
  args: { class: "list-example" },
  decorators: [
    (Story) => (
      <div class="density-compact">
        <Story />
      </div>
    ),
  ],
  play: interaction,
};

export const TrackRow: Story = {
  render: () => {
    const [added, setAdded] = createSignal(0),
      [started, setStarted] = createSignal(0);
    return (
      <div>
        <ol class="track-list">
          <li class="track-row">
            <div class="track-main-row">
              <div class="track-heading">
                <span class="track-number">1.</span>
                <a class="track-title" href="#fictional-track">
                  First Track
                </a>
                <small>3:21</small>
                <div class="track-actions">
                  <PlaybackActionsView
                    class="quiet track-play"
                    append={
                      <QueueAppendView
                        reference="track:example"
                        title="First Track"
                        class="cover-play quiet track-play"
                        onAppend={async () => {
                          setAdded(added() + 1);
                          return 1;
                        }}
                      />
                    }
                    play={
                      <CoverPlayView
                        reference="track:example"
                        title="First Track"
                        class="quiet track-play"
                        onPlay={async () => {
                          setStarted(started() + 1);
                        }}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </li>
        </ol>
        <output aria-label="Added tracks">{added()}</output>
        <output aria-label="Started tracks">{started()}</output>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      add = canvas.getByRole("button", { name: "Ajouter First Track à la suite" }),
      play = canvas.getByRole("button", { name: "Lire First Track" });
    const a = add.getBoundingClientRect(),
      p = play.getBoundingClientRect();
    expect(a.width).toBe(30);
    expect(a.height).toBe(30);
    expect(a.width).toBe(p.width);
    expect(a.height).toBe(p.height);
    expect(p.left - a.right).toBe(4);
    expect(getComputedStyle(add).borderRadius).toBe(getComputedStyle(play).borderRadius);
    await userEvent.click(add);
    expect(canvas.getByLabelText("Added tracks")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Started tracks")).toHaveTextContent("0");
    await userEvent.click(play);
    expect(canvas.getByLabelText("Started tracks")).toHaveTextContent("1");
    expect(add.querySelector(".spinner")).toBeNull();
  },
};
