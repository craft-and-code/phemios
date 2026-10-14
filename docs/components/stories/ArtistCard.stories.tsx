import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, within } from "storybook/test";
import { ArtistCard } from "../../../src/components/ArtistCard";
import { Icon } from "../../../src/components/Icon";
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#264247"/><stop offset="1" stop-color="#151718"/></linearGradient></defs><rect width="400" height="400" fill="url(#a)"/><circle cx="200" cy="150" r="58" fill="#819586"/><path d="M80 400V300a120 100 0 0 1 240 0v100" fill="#516a65"/></svg>')}`;
const meta = {
  title: "Catalog/ArtistCard",
  component: ArtistCard,
  args: {
    view: "portrait",
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
      <div style={{ "max-width": "700px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArtistCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Portrait: Story = {};
export const Discography: Story = {
  args: {
    view: "discography",
    children: (
      <div class="artist-presentation-thumbnails">
        {["First", "Beyond"].map((title) => (
          <div class="artist-album-preview">
            <a href={`#/album/${title}`} title={title}>
              <img class="artwork" src={image} alt={title} />
              <span class="artist-featured-album-title">
                {title}
                <small>2020</small>
              </span>
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
    const card = canvasElement.querySelector(".artist-presentation")!;
    const picture = canvasElement.querySelector(".artist-presentation-picture")!;
    expect(picture.getBoundingClientRect().height).toBeGreaterThan(
      card.getBoundingClientRect().height * 0.8,
    );
    expect(
      within(canvasElement).getByRole("img", { name: "Logo de The Northern Lights" }),
    ).toBeVisible();
    expect(canvasElement.querySelectorAll(".artist-album-preview")).toHaveLength(2);
  },
};
export const Editorial: Story = {
  args: { view: "editorial" },
  decorators: [
    (Story) => (
      <ul class="artist-presentations artist-presentations-editorial">
        <li>
          <Story />
        </li>
      </ul>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Lire The Northern Lights" })).toBeEnabled();
    expect(canvas.getAllByRole("link")).toHaveLength(4);
    expect(
      getComputedStyle(canvas.getByRole("button", { name: "Lire The Northern Lights" }))
        .borderRadius,
    ).toBe("7px");
    const card = canvasElement.querySelector(".artist-presentation")!;
    const picture = card.querySelector(".artist-presentation-picture")!,
      covers = card.querySelectorAll(".artist-album-preview .artwork");
    expect(picture.getBoundingClientRect().height).toBeGreaterThanOrEqual(128);
    expect(
      Math.abs(card.getBoundingClientRect().height - picture.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(2);
    for (const cover of covers)
      if (cover.getClientRects().length)
        expect(
          Math.abs(cover.getBoundingClientRect().height - picture.getBoundingClientRect().height),
        ).toBeLessThanOrEqual(2);
  },
};
