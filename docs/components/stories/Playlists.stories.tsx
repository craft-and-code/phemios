import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, For } from "solid-js";
import { expect, userEvent, within, fireEvent } from "storybook/test";
import { PlaylistsView } from "../../../src/components/PlaylistsView";
import { PlaybackQueueView } from "../../../src/components/PlaybackQueueView";
import { QueueTrackRow } from "../../../src/components/QueueTrackRow";
import { createQueueDrag } from "../../../src/components/queue-drag";
import { Icon } from "../../../src/components/Icon";
import { StickyHeader } from "../../../src/components/StickyHeader";
/** Fictional metadata replaces IO; both presentations observe one owner outside the switched view. */
function Demo(props: { count: number }) {
  const [order, setOrder] = createSignal(Array.from({ length: props.count }, (_, index) => index)),
    [starts, setStarts] = createSignal(0);
  const drag = createQueueDrag({
    enabled: () => order().length > 1,
    id: () => 4,
    order,
    onReorder: setOrder,
  });
  const rows = () => (
    <ol>
      <For each={order()}>
        {(index) => (
          <QueueTrackRow
            row={{
              index,
              reference: `track:${index}`,
              title: `Track ${index + 1}`,
              artist: "Example Artist",
              album: null,
              number: index + 1,
              albumTotal: 30,
            }}
            cover={
              index % 2 === 0 ? (
                <img
                  src={`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#35595f"/><circle cx="20" cy="20" r="12" fill="#c9d7bb"/></svg>')}`}
                  alt=""
                  draggable={false}
                />
              ) : (
                <Icon name="disc" />
              )
            }
            reorderable={order().length > 1}
            playable
            drag={drag}
            onGrip={() => () => {}}
            onPlay={() => setStarts(starts() + 1)}
            removeDisabled={false}
            onRemove={() => setOrder(order().filter((row) => row !== index))}
            words={{ available: false, busy: false, disabled: true, onAction: () => {} }}
          />
        )}
      </For>
    </ol>
  );
  return (
    <div class="playlist-story">
      <PlaylistsView
        queue={(navigation) => (
          <section class="playback-page playlist-page">
            <PlaybackQueueView
              standalone
              count={order().length}
              navigation={navigation}
              actions={
                <>
                  <button
                    class="icon-button"
                    aria-label="Ajouter une piste"
                    onClick={() => setOrder([...order(), Math.max(-1, ...order()) + 1])}
                  >
                    <Icon name="plus" />
                  </button>
                  <button
                    class="icon-button"
                    aria-label="Créer une collection"
                    disabled={!order().length}
                  >
                    <Icon name="library" />
                  </button>
                  <button
                    class="icon-button"
                    aria-label="Vider la liste"
                    disabled={!order().length}
                    onClick={() => setOrder([])}
                  >
                    <Icon name="trash" />
                  </button>
                </>
              }
            >
              {rows()}
            </PlaybackQueueView>
          </section>
        )}
        files={(navigation) => (
          <section class="page m3u-page">
            <StickyHeader>
              <div class="m3u-toolbar">
                {navigation}
                <span>Fichiers M3U</span>
              </div>
            </StickyHeader>
            <p>Existing list.m3u</p>
          </section>
        )}
      />
      <output aria-label="Starts">{starts()}</output>
    </div>
  );
}
const meta = { title: "Media/Playlists", component: Demo, args: { count: 0 } } satisfies Meta<
  typeof Demo
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmptyAndBuild: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("La liste de lecture est vide.")).toBeVisible();
    expect(canvas.queryByRole("button", { name: "Fermer" })).toBeNull();
    expect(canvas.getByRole("button", { name: "Créer une collection" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Ajouter une piste" }));
    expect(canvas.getByText("Track 1", { exact: true })).toBeVisible();
    expect(canvas.getByRole("button", { name: "Créer une collection" })).toBeEnabled();
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
    const files = canvas.getByRole("button", { name: "Parcourir les fichiers M3U" });
    expect(files).toHaveTextContent("Parcourir les fichiers M3U");
    expect(files.querySelector("svg")).toBeNull();
    await userEvent.click(files);
    expect(canvas.getByText("Existing list.m3u")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Revenir à la liste de lecture" }));
    expect(canvas.getByText("Track 1", { exact: true })).toBeVisible();
    expect(canvas.getByText("1 pistes")).toBeVisible();
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
    await userEvent.click(canvas.getByRole("button", { name: "Vider la liste" }));
    expect(canvas.getByText("La liste de lecture est vide.")).toBeVisible();
  },
};
export const Scrollable: Story = {
  args: { count: 30 },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(".standalone-queue")!,
      list = root.querySelector("ol")!,
      header = root.querySelector("header")!,
      top = header.getBoundingClientRect().top;
    expect(getComputedStyle(root).position).toBe("static");
    expect(root.getBoundingClientRect().width).toBeGreaterThan(300);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    list.scrollTop = list.scrollHeight;
    expect(header.getBoundingClientRect().top).toBe(top);
    expect(root.scrollTop).toBe(0);
  },
};

export const CoverPlacement: Story = {
  args: { count: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      rows = canvasElement.querySelectorAll("li[data-queue-index]");
    for (const row of rows) {
      const cover = row.querySelector(".queue-track-cover"),
        remove = row.querySelector(".queue-remove")!,
        title = row.querySelector(".queue-track")!;
      expect(cover).not.toBeNull();
      const box = cover!.getBoundingClientRect();
      expect(box.width).toBe(40);
      expect(box.height).toBe(40);
      expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(box.left);
      expect(box.right).toBeLessThanOrEqual(title.getBoundingClientRect().left);
    }
    expect(rows[0]!.querySelector(".queue-track-cover img")).not.toBeNull();
    expect(rows[1]!.querySelector(".queue-track-cover svg")).not.toBeNull();
    fireEvent.dragStart(rows[0]!, { dataTransfer: new DataTransfer() });
    const preview = document.querySelector(".queue-drag-preview .queue-track-cover")!;
    expect(preview.getBoundingClientRect().width).toBe(40);
    expect(preview.getBoundingClientRect().height).toBe(40);
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    await userEvent.click(rows[0]!.querySelector(".queue-remove")!);
    expect(canvas.queryByText("Track 1", { exact: true })).toBeNull();
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  },
};
