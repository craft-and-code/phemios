import landscape from "../../../public/demo/landscape.svg";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";
import { StickyHeader } from "../../../src/components/StickyHeader";
import { ArtistBiography } from "../../../src/components/ArtistBiography";
const meta = {
  title: "Catalog/ArtistBiography",
  component: ArtistBiography,
  args: {
    onDownload: fn(async () => "/Downloads/Phémios/Encyclopédie/wikipedia-fr-42.txt"),
    artist: "The Northern Lights",
    article: {
      title: "The Northern Lights",
      language: "fr",
      pageId: 42,
      revision: 91,
      retrievedAt: 1790000000000,
      text: "Une biographie fictive : de longues histoires et un voyage musical.\n\n== Les débuts ==\nLe groupe se retrouve dans un studio ! Une aventure : nouvelles chansons, nouvelles scènes.\n\n== Au fil des albums ==\nCes paragraphes servent uniquement à présenter la lecture. Les textes de Wikipédia ne sont pas inclus dans cet aperçu.\n\n== Sur scène ==\nUne dernière section, pour voir comment le texte et les images se partagent la page.",
    },
    photos: [landscape],
  },
  render: (args) => (
    <div style={{ height: "85vh", overflow: "auto" }}>
      <ArtistBiography {...args} />
    </div>
  ),
} satisfies Meta<typeof ArtistBiography>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Reading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("heading", { name: "Les débuts" })).toBeVisible();
    expect(canvas.getByRole("link", { name: "Auteurs et historique" })).toHaveAttribute(
      "href",
      "https://fr.wikipedia.org/w/index.php?curid=42&action=history",
    );
    const toc = canvas.getByRole("navigation", { name: "Sommaire" });
    await userEvent.click(within(toc).getByRole("button", { name: "Sur scène" }));
    expect(canvas.getByRole("heading", { name: "Sur scène" })).toHaveFocus();
    expect(canvas.queryByRole("button", { name: "The Northern Lights" })).toBeNull();
    expect(canvasElement.textContent).toContain("fictive\u00a0:");
    expect(
      canvasElement.querySelector(".wikipedia-prose")!.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(900);
  },
};

export const Overview: Story = {};

export const LongReading: Story = {
  render: (args) => (
    <div style={{ height: "85vh", overflow: "auto" }}>
      <StickyHeader>
        <div class="page-heading">
          <span>Navigation</span>
        </div>
      </StickyHeader>
      <ArtistBiography {...args} />
    </div>
  ),
  args: {
    photos: [],
    article: {
      ...meta.args.article,
      text: Array.from(
        { length: 8 },
        (_, index) =>
          `== Section ${index + 1} ==\n${"A fictional musical history unfolds over several records. ".repeat(90)}`,
      ).join("\n\n"),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      scroller = canvasElement.querySelector(".artist-biography-reader")!.parentElement!;
    await userEvent.click(
      within(canvas.getByRole("navigation", { name: "Sommaire" })).getByRole("button", {
        name: "Section 8",
      }),
    );
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(120));
    await userEvent.click(canvas.getByRole("button", { name: "Retour en haut" }));
    await waitFor(() => expect(scroller.scrollTop).toBeLessThan(1), { timeout: 3000 });
    expect(canvas.getByRole("heading", { name: "The Northern Lights" })).toHaveFocus();
    expect(canvas.queryByRole("button", { name: "Retour en haut" })).toBeNull();
  },
};

export const Download: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Télécharger la biographie complète" }),
    );
    await waitFor(() => expect(args.onDownload).toHaveBeenCalledTimes(1));
    expect(args.onDownload).toHaveBeenCalledWith(args.article);
    expect(canvas.getByRole("button", { name: "Télécharger la biographie complète" })).toHaveClass(
      "download-complete",
    );
    expect(canvas.getByRole("heading", { name: args.article.title })).toBeVisible();
  },
};
