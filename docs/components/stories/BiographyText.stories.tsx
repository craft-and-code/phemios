import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, fireEvent, fn, userEvent, within, waitFor } from "storybook/test";
import { biographyLinker } from "../../../src/library/biography-links";
import { BiographyTextView } from "../../../src/components/BiographyTextView";

const artists = [
  { reference: "artist:solo", name: "Aster Vale", genre: "Heavy Metal" },
  { reference: "artist:band", name: "Northern Signal", genre: "Heavy Metal" },
];
const linker = biographyLinker(artists, "artist:solo", {
  albums: [
    {
      reference: "release:first",
      title: "First Light",
      year: 1980,
      artist: "artist:band",
      tags: [],
    },
    { reference: "release:live", title: "On Stage", year: 1990, artist: "artist:band", tags: [] },
  ],
  tracks: [
    {
      reference: "track:studio",
      title: "Silver Wings (charity version)",
      release: "release:first",
      album_title: "First Light",
      track_no: 1,
    },
    {
      reference: "track:live",
      title: "Silver Wings (live)",
      release: "release:live",
      album_title: "On Stage",
      track_no: 3,
    },
    {
      reference: "track:unique",
      title: "Distant Shore",
      release: "release:first",
      album_title: "First Light",
      track_no: 2,
    },
  ],
});
const text =
  "Aster Vale rejoint Northern Signal, un groupe de heavy metal. Ses titres comprennent Silver Wings et Distant Shore. <b>Texte littéral</b>.";
const meta = {
  title: "Catalog/BiographyText",
  component: BiographyTextView,
  args: { parts: linker(text), onGenre: fn(), onYear: fn() },
  render: (args) => (
    <p style={{ "max-width": "75ch", "line-height": "1.7" }}>
      <BiographyTextView {...args} />
    </p>
  ),
} satisfies Meta<typeof BiographyTextView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CatalogLinks: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const artist = canvas.getByRole("link", { name: "Northern Signal" });
    expect(artist).toHaveAttribute("href", "#/artist/artist%3Aband");
    for (const mention of [artist, canvas.getByRole("button", { name: "Silver Wings" })]) {
      const proseColor = getComputedStyle(mention.parentElement!).color;
      expect(getComputedStyle(mention).color).toBe(proseColor);
      expect(getComputedStyle(mention).textDecorationLine).toContain("underline");
      await userEvent.hover(mention);
      expect(getComputedStyle(mention).color).toBe(proseColor);
      expect(getComputedStyle(mention).textDecorationLine).toContain("underline");
      await userEvent.unhover(mention);
    }
    await userEvent.click(canvas.getByRole("link", { name: "heavy metal" }));
    expect(args.onGenre).toHaveBeenCalledWith("Heavy Metal");
    expect(canvas.getByRole("link", { name: "Distant Shore" })).toHaveAttribute(
      "href",
      "#/track/track%3Aunique",
    );
    expect(canvasElement.textContent).toBe(text);
    expect(canvasElement.querySelector("b")).toBeNull();
  },
};
export const EditionChoice: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Silver Wings" });
    await userEvent.click(trigger);
    const dialog = page.getByRole("dialog", { name: "Choisir une version de Silver Wings" });
    const choices = within(dialog);
    const heading = choices.getByRole("heading");
    expect(heading).toHaveFocus();
    expect(getComputedStyle(heading).outlineStyle).toBe("none");
    const links = choices.getAllByRole("link");
    const borders = links.map((link) => ({
      color: getComputedStyle(link).borderTopColor,
      width: getComputedStyle(link).borderTopWidth,
      bounds: link.getBoundingClientRect().toJSON(),
    }));
    await userEvent.tab();
    expect(choices.getByRole("button", { name: "Fermer" })).toHaveFocus();
    for (const [index, link] of links.entries()) {
      await userEvent.tab();
      expect(link).toHaveFocus();
      const style = getComputedStyle(link);
      expect(style.outlineStyle).toBe("none");
      expect(style.borderTopColor).not.toBe(borders[index]!.color);
      expect(style.borderTopWidth).toBe(borders[index]!.width);
      expect(link.getBoundingClientRect().toJSON()).toEqual(borders[index]!.bounds);
    }
    expect(dialog.textContent).toContain("Silver Wings (charity version)");
    expect(dialog.textContent).toContain("Silver Wings (live)");
    expect(within(dialog).getByRole("link", { name: /First Light/ })).toHaveAttribute(
      "href",
      "#/track/track%3Astudio",
    );
    expect(within(dialog).getByRole("link", { name: /On Stage/ })).toHaveAttribute(
      "href",
      "#/track/track%3Alive",
    );
    await fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  },
};
export const RetiredCatalog: Story = {
  render: (args) => {
    const [parts, setParts] = createSignal(args.parts);
    return (
      <>
        <button onClick={() => setParts([{ text }])}>Retire catalogue</button>
        <p>
          <BiographyTextView {...args} parts={parts()} />
        </p>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Silver Wings" }));
    expect(page.getByRole("dialog")).toBeVisible();
    // Simulate catalogue retirement while the modal is open, without violating focus containment.
    (canvas.getByRole("button", { name: "Retire catalogue" }) as HTMLButtonElement).click();
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    expect(canvas.queryByRole("link")).toBeNull();
    expect(canvasElement.textContent).toContain(text);
  },
};

export const ExactGenresOnly: Story = {
  args: {
    parts: biographyLinker(
      [{ reference: "artist:solo", name: "Aster Vale", genre: "Metal" }],
      "artist:solo",
    )("Un groupe de heavy metal. Du Metal, sans rapprochement de genres."),
  },
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Metal");
    expect(canvasElement.textContent).toContain("heavy metal");
  },
};

export const AvailableYears: Story = {
  args: {
    parts: linker(
      "Né le 3 décembre 1948, Aster Vale publie des albums en 1980 et 1990. Rien en 1981.",
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("link", { name: "1948" })).toBeNull();
    expect(canvas.queryByRole("link", { name: "1981" })).toBeNull();
    const year = canvas.getByRole("link", { name: "1980" });
    expect(year).toHaveAttribute("href", "#/albums");
    expect(year).toHaveAttribute("title", "Albums de 1980");
    expect(getComputedStyle(year).textDecorationLine).toContain("underline");
    await userEvent.click(year);
    expect(args.onYear).toHaveBeenCalledWith(1980);
    expect(canvas.getByRole("link", { name: "1990" })).toBeVisible();
    expect(canvasElement.textContent).toContain("3 décembre 1948");
  },
};
