import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, Show } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { createQueueSearch } from "../../../src/library/queue-search-controller";
import { normalizeName } from "../../../src/library/filtering";
import { QueueAddView } from "../../../src/components/QueueAddView";
function Demo(props: { connected: boolean }) {
  const context = {
    owners: props.connected
      ? [
          {
            source: "server" as const,
            session: {
              server: "http://fixture.invalid",
              account: { id: "owner", username: "example", role: "user" },
            },
          },
        ]
      : [],
    albums: ["Un été", "Second Album", "13"].map((title, index) => ({
      reference: `release:${index}`,
      title,
      artist: "artist:principal",
      year: 2001,
      compilation: false,
      tags: [],
      searchFields: ["FLAC"],
    })),
    artists: [
      {
        reference: "artist:principal",
        name: "Été",
        genre: "",
        country: null,
        biography: "",
        artwork: false,
        searchFields: ["11111111-2222-4333-8444-b13900000000"],
      },
    ],
  };
  const tracks = ["Northern Lights", "Another Morning", "Thirteen"].map((title, index) => ({
    reference: `track:${index}`,
    title,
    release: index === 2 ? "release:2" : "release:0",
    album_title: index === 2 ? "13" : "Un été",
    disc_no: 1,
    track_no: index + 1,
    album_position: index + 1,
    duration_ms: 1000,
    analysis_available: false,
    spectrum_available: false,
  }));
  const search = createQueueSearch(
    () => context,
    async (path, query) => {
      if (path.endsWith("m3u-files")) throw Error("Inventory unavailable");
      if (path.endsWith("/m3u")) {
        const items = [
          {
            id: "playlist-" + "a".repeat(64),
            name: "Été mixes",
            path: "/music/summer.m3u",
            track_count: 2,
          },
        ].filter((row) => normalizeName(row.name).includes(normalizeName(query.q ?? "")));
        return { items, total: items.length, offset: 0 };
      }
      if (path.endsWith("collections"))
        return { items: [{ name: "Été collection", expression: "*" }], total: 1, offset: 0 };
      const matching = tracks.filter((row) =>
        normalizeName([row.title, row.album_title].join(" ")).includes(
          normalizeName(query.q ?? ""),
        ),
      );
      return { items: matching, total: matching.length, offset: 0, limit: 50, scanned_at: 1 };
    },
  );
  const [added, setAdded] = createSignal(""),
    [closed, setClosed] = createSignal(false);
  return (
    <aside
      class="playback-queue"
      style={{
        width: "460px",
        height: "680px",
        "max-height": "none",
        display: "flex",
        "flex-direction": "column",
      }}
    >
      <Show when={!closed()}>
        <QueueAddView
          category={search.category()}
          query={search.query()}
          rows={search.read.current()?.items ?? []}
          loading={search.waiting() || search.read.loading()}
          pending=""
          added={added()}
          error={search.read.error() || search.read.current()?.errors.join("\n") || ""}
          more={search.read.current()?.more ?? false}
          offset={search.offset()}
          origins={false}
          image={() => undefined}
          disabled={() =>
            props.connected ? "" : "Connectez-vous pour ajouter à la liste de lecture."
          }
          onQuery={search.setQuery}
          onCategory={search.chooseCategory}
          onSearch={search.submit}
          onOffset={search.setOffset}
          onAdd={(row) => setAdded(row.key)}
          onClose={() => setClosed(true)}
          onRefresh={() => void search.read.refetch()}
          onCancel={search.read.cancel}
        />
      </Show>
      <output aria-label="Added">{added()}</output>
      <output aria-label="Closed">{String(closed())}</output>
    </aside>
  );
}
const meta = {
  title: "Media/QueueSearch",
  component: Demo,
  args: { connected: true },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SearchCategoriesAndAdd: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      field = canvas.getByRole("searchbox");
    expect(field).toHaveFocus();
    await userEvent.type(field, "north");
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Ajouter Northern Lights à la suite" }),
      ).toBeEnabled(),
    );
    expect(canvas.queryByText("Another Morning")).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Ajouter Northern Lights à la suite" }),
    );
    expect(canvas.getByLabelText("Added")).toHaveTextContent("track:0");
    await userEvent.clear(field);
    expect(canvas.queryByText("Northern Lights")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Albums" }));
    await userEvent.type(field, "ete");
    await waitFor(() => expect(canvas.getByText("Un été", { exact: true })).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Artistes" }));
    await waitFor(() => expect(canvas.getByText("Été", { exact: true })).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "M3U" }));
    await waitFor(() => expect(canvas.getByText("Été mixes", { exact: true })).toBeVisible());
    expect(canvas.getByText("Serveur · Inventory unavailable")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Collections" }));
    await waitFor(() => expect(canvas.getByText("Été collection", { exact: true })).toBeVisible());
    await userEvent.click(field);
    await userEvent.keyboard("{Escape}");
    expect(canvas.getByLabelText("Closed")).toHaveTextContent("true");
  },
};
export const Interactive: Story = {};

export const NumericAlbum: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      field = canvas.getByRole("searchbox");
    await userEvent.click(canvas.getByRole("button", { name: "Albums" }));
    await userEvent.type(field, "13");
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Ajouter 13 à la suite" })).toBeEnabled();
      expect(canvas.queryByText("Un été", { exact: true })).toBeNull();
    });
    expect(canvas.getByText("13", { exact: true })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(canvas.getByRole("button", { name: "Ajouter 13 à la suite" }));
    expect(canvas.getByLabelText("Added")).toHaveTextContent("release:2");
  },
};

export const DisconnectedNumericAlbum: Story = {
  args: { connected: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Albums" }));
    await userEvent.type(canvas.getByRole("searchbox"), "13");
    await waitFor(() => expect(canvas.getByText("13", { exact: true })).toBeVisible());
    const add = canvas.getByRole("button", { name: "Ajouter 13 à la suite" });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", "Connectez-vous pour ajouter à la liste de lecture.");
    expect(canvas.getByText("Connectez-vous pour ajouter à la liste de lecture.")).toBeVisible();
    await userEvent.click(add);
    expect(canvas.getByLabelText("Added")).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole("button", { name: "Collections" }));
    expect(canvas.queryByText("Été collection")).toBeNull();
  },
};

export const AllCategories: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Tous" }));
    await userEvent.type(canvas.getByRole("searchbox"), "13");
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Ajouter 13 à la suite" })).toBeEnabled();
      expect(canvas.getByRole("button", { name: "Ajouter Thirteen à la suite" })).toBeEnabled();
      expect(canvas.queryByRole("button", { name: "Ajouter Été à la suite" })).toBeNull();
      expect(canvas.queryByRole("button", { name: "Ajouter Été mixes à la suite" })).toBeNull();
    });
    expect(canvas.getByText("Albums · Été · 2001")).toBeVisible();
    expect(canvas.getByText("Pistes · 13")).toBeVisible();
  },
};
