import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, For, onMount, onCleanup, Show } from "solid-js";
import { expect, userEvent, within, fireEvent } from "storybook/test";
import { QueueTrackRow } from "../../../src/components/QueueTrackRow";
import { createQueueDrag } from "../../../src/components/queue-drag";
function Demo(props: { count: number; covers?: boolean }) {
  const [rows, setRows] = createSignal(
      Array.from({ length: props.count }, (_, index) => ({
        index,
        reference: `track:${index}`,
        title: ["Northern Lights", "Another Morning", "Last Train"][index]!,
        artist: "Example Artist",
        album: null,
        number: index + 1,
        albumTotal: 3,
      })),
    ),
    [starts, setStarts] = createSignal(0),
    [artworkMounts, setArtworkMounts] = createSignal(0),
    [liveArtwork, setLiveArtwork] = createSignal(0),
    [alternateArtwork, setAlternateArtwork] = createSignal(false);
  function RowArtwork(props: { variant: string }) {
    onMount(() => {
      setArtworkMounts((count) => count + 1);
      setLiveArtwork((count) => count + 1);
    });
    onCleanup(() => setLiveArtwork((count) => count - 1));
    return <span>{props.variant}</span>;
  }
  const enabled = () => rows().length > 1;
  const drag = createQueueDrag({
    enabled,
    id: () => 17,
    order: () => rows().map((row) => row.index),
    onReorder: (order) => setRows(order.map((index) => rows().find((row) => row.index === index)!)),
  });
  return (
    <section class="playback-page">
      <aside class="playback-queue" style={{ width: "460px", "max-width": "100%" }}>
        <h2>Liste de lecture</h2>
        <ol>
          <For each={rows()}>
            {(row) => (
              <QueueTrackRow
                row={row}
                cover={
                  props.covers ? (
                    alternateArtwork() ? (
                      <RowArtwork variant="Updated cover" />
                    ) : (
                      <RowArtwork variant="Cover" />
                    )
                  ) : undefined
                }
                status={row.index === 0 ? "playing" : undefined}
                reorderable={enabled()}
                playable
                drag={drag}
                onGrip={() => () => {}}
                onPlay={() => setStarts(starts() + 1)}
                words={{ available: true, busy: false, disabled: true, onAction: () => {} }}
                removeDisabled={false}
                onRemove={() => setRows(rows().filter((item) => item.index !== row.index))}
              />
            )}
          </For>
        </ol>
        <output aria-label="Starts">{starts()}</output>
        <output aria-label="Artwork mounts">{artworkMounts()}</output>
        <Show when={props.covers}>
          <output aria-label="Active artwork">{liveArtwork()}</output>
          <button onClick={() => setAlternateArtwork(!alternateArtwork())}>Replace artwork</button>
        </Show>
      </aside>
    </section>
  );
}
const meta = { title: "Media/QueueTrackRow", component: Demo, args: { count: 3 } } satisfies Meta<
  typeof Demo
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlacementAndRemoval: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector(".queue-track-cover")).toBeNull();
    const canvas = within(canvasElement),
      remove = canvas.getByRole("button", {
        name: "Retirer Northern Lights de la liste de lecture",
      }),
      title = canvas.getByText("Northern Lights", { exact: true });
    expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(
      title.getBoundingClientRect().left,
    );
    const center = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    expect(center(remove) - center(title)).toBeCloseTo(3, 0);
    expect(getComputedStyle(remove).color).toBe("rgb(212, 119, 119)");
    await userEvent.click(remove);
    await userEvent.click(
      canvas.getByRole("button", { name: "Retirer Another Morning de la liste de lecture" }),
    );
    expect(canvas.getByRole("button", { name: "Déplacer Last Train" })).toBeDisabled();
    expect(canvasElement.querySelector("li")?.draggable).toBe(false);
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  },
};
export const ReorderAndPreview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      first = canvasElement.querySelector<HTMLLIElement>("li[data-queue-index='0']")!,
      last = canvasElement.querySelector<HTMLLIElement>("li[data-queue-index='2']")!,
      box = first.getBoundingClientRect();
    fireEvent.dragStart(first, {
      dataTransfer: new DataTransfer(),
      clientX: box.left + 80,
      clientY: box.top + 15,
    });
    const preview = document.querySelector<HTMLElement>(".queue-drag-preview")!;
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview).toHaveAttribute("inert");
    expect(getComputedStyle(preview).pointerEvents).toBe("none");
    expect(preview.getBoundingClientRect().width).toBeCloseTo(box.width, 0);
    expect(getComputedStyle(preview.querySelector("li")!).boxShadow).not.toBe("none");
    fireEvent.dragOver(last);
    expect(last).toHaveClass("queue-drop-target");
    fireEvent.drop(last);
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(
      [...canvasElement.querySelectorAll("li[data-queue-index]")].map((row) =>
        row.getAttribute("data-queue-index"),
      ),
    ).toEqual(["1", "2", "0"]);
    const grip = canvas.getByRole("button", { name: "Déplacer Northern Lights" });
    grip.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(
      [...canvasElement.querySelectorAll("li[data-queue-index]")].map((row) =>
        row.getAttribute("data-queue-index"),
      ),
    ).toEqual(["1", "0", "2"]);
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  },
};
export const Single: Story = { args: { count: 1 } };
export const Interactive: Story = {};

export const CancelledDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      first = canvasElement.querySelector<HTMLLIElement>("li[data-queue-index='0']")!;
    fireEvent.dragStart(first, { dataTransfer: new DataTransfer() });
    expect(document.querySelectorAll(".queue-drag-preview")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    fireEvent.drop(canvasElement.querySelector("li[data-queue-index='2']")!);
    expect(
      [...canvasElement.querySelectorAll("li[data-queue-index]")].map((row) =>
        row.getAttribute("data-queue-index"),
      ),
    ).toEqual(["0", "1", "2"]);
    fireEvent.dragStart(first, { dataTransfer: new DataTransfer() });
    await userEvent.click(
      canvas.getByRole("button", { name: "Retirer Another Morning de la liste de lecture" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Retirer Last Train de la liste de lecture" }),
    );
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(canvas.getByRole("button", { name: "Déplacer Northern Lights" })).toBeDisabled();
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  },
};

export const NumbersAreInert: Story = {
  args: { count: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      numbers = canvasElement.querySelectorAll(".queue-track-number");
    await userEvent.click(numbers[0]!);
    await userEvent.click(numbers[1]!);
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
    const remove = canvas.getByRole("button", {
      name: "Retirer Northern Lights de la liste de lecture",
    });
    const center = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    expect(center(remove) - center(numbers[0]!)).toBeCloseTo(0, 0);
    expect(getComputedStyle(numbers[0]!).cursor).toBe("default");
    await userEvent.click(canvas.getByRole("button", { name: /^Northern Lights Example Artist/ }));
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("1");
  },
};
export const TwoTrackDropDirections: Story = {
  args: { count: 2 },
  play: async ({ canvasElement }) => {
    const first = canvasElement.querySelector<HTMLLIElement>("li[data-queue-index='0']")!,
      second = canvasElement.querySelector<HTMLLIElement>("li[data-queue-index='1']")!;
    const order = () =>
      [...canvasElement.querySelectorAll("li[data-queue-index]")].map((row) =>
        row.getAttribute("data-queue-index"),
      );
    fireEvent.dragStart(first, { dataTransfer: new DataTransfer() });
    fireEvent.dragOver(first);
    expect(getComputedStyle(first).boxShadow).toBe("none");
    fireEvent.dragOver(second);
    expect(getComputedStyle(second).boxShadow).toContain("0px -2px");
    fireEvent.drop(second);
    expect(order()).toEqual(["1", "0"]);
    fireEvent.dragStart(first, { dataTransfer: new DataTransfer() });
    fireEvent.dragOver(second);
    expect(getComputedStyle(second).boxShadow).toContain("0px 2px");
    fireEvent.drop(second);
    expect(order()).toEqual(["0", "1"]);
  },
};

export const StableArtwork: Story = {
  args: { count: 2, covers: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelectorAll(".queue-track-cover")).toHaveLength(2);
    expect(canvas.getByLabelText("Artwork mounts")).toHaveTextContent("2");
    await userEvent.click(canvas.getByRole("button", { name: /^Northern Lights Example Artist/ }));
    expect(canvas.getByLabelText("Artwork mounts")).toHaveTextContent("2");
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("1");
    await userEvent.click(canvas.getByRole("button", { name: "Replace artwork" }));
    expect(canvas.getByLabelText("Artwork mounts")).toHaveTextContent("4");
    expect(canvas.getByLabelText("Active artwork")).toHaveTextContent("2");
    expect(canvas.getAllByText("Updated cover", { exact: true })).toHaveLength(2);
    await userEvent.click(
      canvas.getByRole("button", { name: "Retirer Northern Lights de la liste de lecture" }),
    );
    expect(canvas.getByLabelText("Active artwork")).toHaveTextContent("1");
  },
};
