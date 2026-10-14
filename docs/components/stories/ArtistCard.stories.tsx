import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ArtistCard } from "../../../src/components/ArtistCard";
import { Icon } from "../../../src/components/Icon";
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#264247"/><stop offset="1" stop-color="#151718"/></linearGradient></defs><rect width="400" height="400" fill="url(#a)"/><circle cx="200" cy="150" r="58" fill="#819586"/><path d="M80 400V300a120 100 0 0 1 240 0v100" fill="#516a65"/></svg>')}`;
const meta = {
  title: "Catalog/ArtistCard",
  component: ArtistCard,
  args: {
    view: "discography",
    name: "The Northern Lights",
    href: "#/artist/fictional",
    metadata: "Post-rock · Islande",
    albumCount: 8,
    image,
    logo: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><text x="4" y="62" fill="white" font-family="serif" font-weight="bold" font-size="64">NORTH</text></svg>')}`,
    fallback: <Icon name="users" />,
    play: (
      <button class="icon-button cover-play" aria-label="Lire The Northern Lights">
        <Icon name="play" />
      </button>
    ),
    children: (
      <div class="artist-presentation-thumbnails">
        {["First", "Beyond", "Tomorrow"].map((title) => (
          <div class="artist-album-preview">
            <a href={`#/album/${title}`} title={title}>
              <img class="artwork" src={image} alt={title} />
            </a>
          </div>
        ))}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ "max-width": "1400px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArtistCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Discography: Story = {
  args: {
    view: "discography",
    children: (
      <div class="artist-presentation-thumbnails">
        {["First", "Beyond"].map((title) => (
          <div class="artist-album-preview">
            <a href={`#/album/${title}`} title={title}>
              <img class="artwork" src={image} alt={title} />
            </a>
          </div>
        ))}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "540px", width: "340px" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const play = within(canvasElement).getByRole("button", { name: "Lire The Northern Lights" });
    expect(getComputedStyle(play).cursor).toBe("pointer");
    await userEvent.click(play);
    const button = play.getBoundingClientRect();
    expect(
      play.contains(
        canvasElement.ownerDocument.elementFromPoint(
          button.left + button.width / 2,
          button.top + button.height / 2,
        ),
      ),
    ).toBe(true);
    const card = canvasElement.querySelector(".artist-presentation")!;
    const picture = canvasElement.querySelector(".artist-presentation-picture")!;
    expect(picture.getBoundingClientRect().height).toBeGreaterThan(
      card.getBoundingClientRect().height * 0.8,
    );
    expect(
      within(canvasElement).getByRole("img", { name: "Logo de The Northern Lights" }),
    ).toBeVisible();
    const albums = canvasElement.querySelectorAll(".artist-album-preview");
    expect(albums).toHaveLength(2);
    for (const album of albums)
      expect(album.getBoundingClientRect().width).toBeGreaterThan(
        card.getBoundingClientRect().width * 0.4,
      );
    const first = albums[0]!.getBoundingClientRect(),
      second = albums[1]!.getBoundingClientRect();
    expect(second.left - first.right).toBeLessThanOrEqual(16);
  },
};
export const Editorial: Story = {
  args: { view: "editorial" },
  decorators: [
    (Story) => (
      <ul class="artist-presentations artist-presentations-editorial" style={{ width: "1200px" }}>
        <li>
          <Story />
        </li>
      </ul>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const play = canvas.getByRole("button", { name: "Lire The Northern Lights" });
    expect(play).toBeEnabled();
    expect(canvas.getAllByRole("link")).toHaveLength(5);
    expect(getComputedStyle(play).borderRadius).toBe("7px");
    const card = canvasElement.querySelector(".artist-presentation")!;
    const picture = card.querySelector(".artist-presentation-picture")!;
    const row = card.getBoundingClientRect(),
      photo = picture.getBoundingClientRect();
    expect(photo.width).toBeGreaterThan(row.width * 0.3);
    expect(Math.abs(photo.height - row.height)).toBeLessThanOrEqual(2);
    const covers = [...card.querySelectorAll(".artist-album-preview .artwork")];
    expect(covers.filter((cover) => cover.getClientRects().length)).toHaveLength(3);
    for (const cover of covers) {
      const rect = cover.getBoundingClientRect();
      expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(2);
      expect(rect.height).toBeGreaterThan(row.height * 0.6);
      expect(rect.height).toBeLessThan(row.height * 0.8);
      expect(
        Math.abs((rect.top + rect.bottom) / 2 - (row.top + row.bottom) / 2),
      ).toBeLessThanOrEqual(2);
    }
    await userEvent.click(play);
    expect(getComputedStyle(card.querySelector("h2")!).color).toBe(
      getComputedStyle(card).borderTopColor,
    );
  },
};
export const VerticalGallery: Story = {
  args: { ...Discography.args },
  decorators: [
    (Story) => (
      <div class="artist-featured-library">
        <div>
          <div class="library-results" style={{ width: "1000px", height: "580px", flex: "none" }}>
            <ul class="artist-presentations artist-presentations-discography">
              {[0, 1, 2, 3, 4, 5].map(() => (
                <li>
                  <Story />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll(".artist-presentation"),
      grid = canvasElement.querySelector(".artist-presentations")!,
      scroller = canvasElement.querySelector(".library-results")!;
    expect(cards).toHaveLength(6);
    expect(getComputedStyle(scroller).scrollSnapType).toBe("y mandatory");
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      expect(rect.width).toBeGreaterThan(grid.getBoundingClientRect().width * 0.3);
      expect(Math.abs(rect.height - scroller.getBoundingClientRect().height)).toBeLessThanOrEqual(
        2,
      );
      expect(getComputedStyle(card.parentElement!).scrollSnapStop).toBe("always");
      for (const cover of card.querySelectorAll(".artist-album-preview .artwork"))
        expect(cover.getBoundingClientRect().width).toBeGreaterThan(rect.width * 0.4);
      const logo = card.querySelector(".artist-presentation-logo img")!;
      expect(getComputedStyle(logo).filter).toContain("grayscale(1)");
      expect(getComputedStyle(logo).filter).not.toContain("brightness");
    }
    const rowDistance =
      cards[3]!.getBoundingClientRect().top - cards[0]!.getBoundingClientRect().top;
    expect(
      Math.abs(rowDistance - scroller.getBoundingClientRect().height - 20),
    ).toBeLessThanOrEqual(2);
  },
};

export const NarrowEditorial: Story = {
  args: { view: "editorial" },
  decorators: [
    (Story) => (
      <ul class="artist-presentations artist-presentations-editorial" style={{ width: "640px" }}>
        <li>
          <Story />
        </li>
      </ul>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector(".artist-presentation")!;
    const row = card.getBoundingClientRect();
    const covers = [...card.querySelectorAll(".artist-album-preview .artwork")].filter(
      (cover) => cover.getClientRects().length,
    );
    expect(covers).toHaveLength(1);
    const photo = card.querySelector(".artist-presentation-picture")!.getBoundingClientRect();
    expect(photo.width).toBeGreaterThan(row.width * 0.3);
    const play = within(canvasElement)
      .getByRole("button", { name: "Lire The Northern Lights" })
      .getBoundingClientRect();
    expect(play.right).toBeLessThanOrEqual(row.right);
    expect(Math.abs((play.top + play.bottom) / 2 - (row.top + row.bottom) / 2)).toBeLessThanOrEqual(
      2,
    );
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
