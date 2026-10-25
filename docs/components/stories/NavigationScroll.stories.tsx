import { createSignal, For, onCleanup, Show } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createNavigation, type NavigationHost } from "../../../src/navigation/history";
import {
  navigationViewport,
  restoreElementPosition,
} from "../../../src/navigation/scroll-position";

/** Real DOM geometry and observers, with a fictional asynchronous catalogue and private history. */
function NavigationScroll(props: { delayed?: boolean; nestedArtists?: boolean }) {
  let panel: HTMLDivElement | undefined;
  let current = { hash: "#/artists", state: {} as unknown };
  let cancelRestore = () => {};
  const [loaded, setLoaded] = createSignal(!props.delayed);
  const host: NavigationHost = {
    current: () => current,
    push: (hash, state) => {
      current = { hash, state };
    },
    replace: (state) => {
      current.state = state;
    },
    back: () => {},
    top: () => navigationViewport(panel ?? null)?.scrollTop ?? 0,
    restore: (top) => {
      const viewport = navigationViewport(panel ?? null);
      if (viewport) cancelRestore = restoreElementPosition(viewport, top);
    },
    cancelRestore: () => cancelRestore(),
    defer: (fn) => requestAnimationFrame(fn),
    listen: () => () => {},
  };
  const navigation = createNavigation(host, () => "Catalogue");
  const albums = () => navigation.section() === "albums";
  const visit = (hash: string) => {
    const leavingAlbums = albums();
    navigation.navigate(hash);
    if (props.delayed && leavingAlbums) setLoaded(false);
  };
  onCleanup(() => cancelRestore());
  return (
    <section>
      <nav class="settings-actions" aria-label="Catalogue views">
        <button onClick={() => visit("#/artists")}>Artists</button>
        <button onClick={() => visit("#/albums")}>Albums</button>
        <button
          onClick={() =>
            navigationViewport(panel ?? null)?.scrollTo({ top: albums() ? 720 : 1280 })
          }
        >
          Locate a row
        </button>
        <Show when={albums() && !loaded()}>
          <button onClick={() => setLoaded(true)}>Load albums</button>
        </Show>
      </nav>
      <div
        aria-label="Catalogue viewport"
        ref={(element) => {
          panel = element;
        }}
        tabindex="0"
        style={{
          height: "320px",
          overflow: props.nestedArtists && !albums() ? "hidden" : "auto",
          "overflow-anchor": "none",
          border: "1px solid var(--border)",
        }}
      >
        <div
          aria-label={props.nestedArtists && !albums() ? "Artist cards viewport" : undefined}
          data-navigation-scroll={props.nestedArtists && !albums() ? "" : undefined}
          style={
            props.nestedArtists && !albums() ? { height: "100%", overflow: "auto" } : undefined
          }
        >
          <Show when={!albums() || loaded()} fallback={<p role="status">Loading albums</p>}>
            <For each={Array.from({ length: 40 }, (_, index) => index + 1)}>
              {(index) => (
                <div style={{ height: "80px", padding: "16px" }}>
                  {albums() ? "Album" : "Artist"} {index === 17 && !albums() ? "Nacre" : index}
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </section>
  );
}
const meta = { title: "Shell/NavigationScroll", component: NavigationScroll } satisfies Meta<
  typeof NavigationScroll
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SectionReturn: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const panel = page.getByLabelText("Catalogue viewport");
    await userEvent.click(page.getByRole("button", { name: "Locate a row" }));
    await waitFor(() => expect(panel.scrollTop).toBe(1280));
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    await waitFor(() => expect(panel.scrollTop).toBe(0));
    await userEvent.click(page.getByRole("button", { name: "Locate a row" }));
    await waitFor(() => expect(panel.scrollTop).toBe(720));
    await userEvent.click(page.getByRole("button", { name: "Artists" }));
    await waitFor(() => expect(panel.scrollTop).toBe(1280));
    expect(page.getByText("Artist Nacre").getBoundingClientRect().top).toBeGreaterThanOrEqual(
      panel.getBoundingClientRect().top,
    );
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    await waitFor(() => expect(panel.scrollTop).toBe(720));
  },
};
export const DelayedReturn: Story = {
  args: { delayed: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const panel = page.getByLabelText("Catalogue viewport");
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    await userEvent.click(page.getByRole("button", { name: "Load albums" }));
    await new Promise<number>(requestAnimationFrame);
    await userEvent.click(page.getByRole("button", { name: "Locate a row" }));
    await waitFor(() => expect(panel.scrollTop).toBe(720));
    await userEvent.click(page.getByRole("button", { name: "Artists" }));
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    expect(page.getByRole("status")).toHaveTextContent("Loading albums");
    expect(panel.scrollTop).toBe(0);
    await userEvent.click(page.getByRole("button", { name: "Load albums" }));
    await waitFor(() => expect(panel.scrollTop).toBe(720));
  },
};

export const NestedArtistReturn: Story = {
  args: { nestedArtists: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const shell = page.getByLabelText("Catalogue viewport");
    const artists = page.getByLabelText("Artist cards viewport");
    await userEvent.click(page.getByRole("button", { name: "Locate a row" }));
    await waitFor(() => expect(artists.scrollTop).toBe(1280));
    expect(shell.scrollTop).toBe(0);
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    await waitFor(() => expect(shell.scrollTop).toBe(0));
    await userEvent.click(page.getByRole("button", { name: "Locate a row" }));
    await waitFor(() => expect(shell.scrollTop).toBe(720));
    await userEvent.click(page.getByRole("button", { name: "Artists" }));
    await waitFor(() => expect(artists.scrollTop).toBe(1280));
    expect(shell.scrollTop).toBe(0);
    await userEvent.click(page.getByRole("button", { name: "Albums" }));
    await waitFor(() => expect(shell.scrollTop).toBe(720));
  },
};
