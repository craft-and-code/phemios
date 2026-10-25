import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { CircularPlaybackActionsView } from "../../../src/components/CircularPlaybackActionsView";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
import { QueueAppendView } from "../../../src/components/QueueAppendView";
function Detail(props: { disabled: boolean }) {
  const [adds, setAdds] = createSignal(0),
    [starts, setStarts] = createSignal(0),
    [navigation, setNavigation] = createSignal(0);
  let complete = () => {};
  return (
    <>
      <article
        style={{ padding: "28px", "min-height": "110px" }}
        onClick={() => setNavigation(navigation() + 1)}
      >
        <CircularPlaybackActionsView
          play={
            <CoverPlayView
              reference="release:example"
              title="First Album"
              variant="detail"
              disabled={props.disabled}
              onPlay={async () => {
                setStarts(starts() + 1);
              }}
            />
          }
          append={
            <QueueAppendView
              reference="release:example"
              title="First Album"
              disabled={props.disabled}
              reason={props.disabled ? "Lecture indisponible." : undefined}
              onAppend={async () => {
                setAdds(adds() + 1);
                return new Promise((resolve) => {
                  complete = () => resolve(9);
                });
              }}
            />
          }
        />
      </article>
      <output aria-label="Additions">{adds()}</output>
      <output aria-label="Starts">{starts()}</output>
      <output aria-label="Navigation">{navigation()}</output>
      <button onClick={() => complete()}>Confirm addition</button>
    </>
  );
}
const meta = {
  title: "Controls/CircularPlaybackActions",
  component: Detail,
  args: { disabled: false },
} satisfies Meta<typeof Detail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PersistentBadge: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      add = canvas.getByRole("button", { name: "Ajouter First Album à la suite" }),
      play = canvas.getByRole("button", { name: "Lire First Album" });
    await userEvent.unhover(canvasElement.querySelector("article")!);
    const p = play.getBoundingClientRect(),
      a = add.getBoundingClientRect(),
      root = canvasElement.querySelector(".circular-play-actions")!.getBoundingClientRect();
    expect(p.width).toBe(38);
    expect(p.height).toBe(38);
    expect(a.width).toBe(22);
    expect(getComputedStyle(add).borderTopWidth).toBe("0px");
    expect(root.width).toBe(p.width);
    expect(root.height).toBe(p.height);
    expect(getComputedStyle(add).opacity).toBe("1");
    expect(a.top).toBeLessThan(p.top);
    expect(a.right).toBeGreaterThan(p.right);
    expect(a.left).toBeGreaterThan(p.left + p.width / 2);
    const hit = (r: DOMRect) =>
      document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    expect(play.contains(hit(p))).toBe(true);
    expect(add.contains(hit(a))).toBe(true);
    await userEvent.hover(play);
    expect(getComputedStyle(play).color).not.toBe(getComputedStyle(play).backgroundColor);
    await userEvent.click(add);
    expect(canvas.getByLabelText("Additions")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
    expect(canvas.getByLabelText("Navigation")).toHaveTextContent("0");
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("aria-busy", "true");
    expect(add.querySelector(".spinner")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Confirm addition" }));
    await waitFor(() => expect(add).toHaveClass("download-complete"));
    await userEvent.unhover(add);
    expect(getComputedStyle(add).color).toBe(getComputedStyle(play).backgroundColor);
    expect(play.getBoundingClientRect().left).toBe(p.left);
    expect(play.getBoundingClientRect().top).toBe(p.top);
    await userEvent.click(play);
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Additions")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Navigation")).toHaveTextContent("0");
  },
};
export const Unavailable: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      add = canvas.getByRole("button", { name: "Ajouter First Album à la suite" });
    expect(add).toBeVisible();
    expect(getComputedStyle(add).borderTopWidth).toBe("0px");
    expect(add).toBeDisabled();
    expect(getComputedStyle(add).opacity).toBe("1");
    expect(getComputedStyle(add.querySelector("svg")!).opacity).toBe("0.5");
    await userEvent.click(add);
    expect(canvas.getByLabelText("Additions")).toHaveTextContent("0");
  },
};
