import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import type { QueueSearchItem } from "../../../src/library/queue-search";
import { QueueAddView } from "../../../src/components/QueueAddView";
const rows: QueueSearchItem[] = [
  {
    key: "one",
    reference: "track:one",
    title: "Northern Lights",
    detail: "Example Artist · First Album",
    source: "server" as const,
  },
  {
    key: "two",
    reference: "track:two",
    title: "Another Morning",
    detail: "Example Artist · First Album",
    source: "server" as const,
  },
];
const meta = {
  title: "Media/QueueAdd",
  component: QueueAddView,
  args: {
    category: "tracks",
    query: "",
    rows,
    loading: false,
    pending: "",
    added: "",
    error: "",
    more: false,
    offset: 0,
    origins: false,
    image: () => undefined,
    disabled: (_row: QueueSearchItem) => "",
    onQuery: () => {},
    onCategory: () => {},
    onAdd: () => {},
    onOffset: () => {},
    onClose: () => {},
    onRefresh: () => {},
    onCancel: () => {},
  },
  render: (args) => {
    const [query, setQuery] = createSignal(args.query),
      [category, setCategory] = createSignal(args.category),
      [added, setAdded] = createSignal("");
    return (
      <aside
        class="playback-queue"
        style={{
          width: "440px",
          height: "660px",
          "max-height": "none",
          display: "flex",
          "flex-direction": "column",
        }}
      >
        <h2>Liste de lecture</h2>
        <QueueAddView
          {...args}
          query={query()}
          category={category()}
          added={added()}
          onQuery={setQuery}
          onCategory={setCategory}
          onAdd={(row) => setAdded(row.key)}
        />
        <ol>
          <li>Current track remains here</li>
        </ol>
      </aside>
    );
  },
} satisfies Meta<typeof QueueAddView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SearchAndAdd: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      field = canvas.getByRole("searchbox");
    await userEvent.type(field, "Northern");
    await expect(field).toHaveValue("Northern");
    await userEvent.click(canvas.getByRole("button", { name: /^Albums$/ }));
    await expect(canvas.getByRole("button", { name: /^Albums$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const add = canvas.getByRole("button", { name: "Ajouter Northern Lights à la suite" });
    await userEvent.click(add);
    await waitFor(() => expect(add).toHaveClass("download-complete"));
    const results = canvasElement.querySelector(".queue-add-results")!;
    if (results.clientHeight < 50) throw Error("Search results collapsed");
  },
};
export const Loading: Story = { args: { loading: true, rows: [] } };
export const Unavailable: Story = {
  args: { rows: [], error: "Serveur · Bibliothèque indisponible." },
};
export const MixedOrigins: Story = {
  args: {
    origins: true,
    rows: rows.map((row, index) => ({ ...row, source: index ? "local" : "server" })),
    disabled: (row) =>
      row.key === "two"
        ? "Lecture de plusieurs origines non prise en charge dans une seule file."
        : "",
  },
};

export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      text = canvas.getByText("Aucun résultat dans cette sélection."),
      results = canvasElement.querySelector(".queue-add-results")!;
    const a = text.getBoundingClientRect(),
      b = results.getBoundingClientRect();
    expect(Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)).toBeLessThan(1);
    expect(Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2)).toBeLessThan(1);
  },
};
