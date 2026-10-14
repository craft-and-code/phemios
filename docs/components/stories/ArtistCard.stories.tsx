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
    banner: image,
    fallback: <Icon name="users" />,
    play: (
      <button class="icon-button cover-play" aria-label="Lire The Northern Lights">
        <Icon name="play" />
      </button>
    ),
    children: (
      <div class="artist-presentation-thumbnails">
        {["First", "Beyond", "Tomorrow"].map((title) => (
          <a href={`#/album/${title}`} title={title}>
            <img class="artwork" src={image} alt={title} />
          </a>
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
export const Discography: Story = { args: { view: "discography" } };
export const Editorial: Story = {
  args: { view: "editorial" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Lire The Northern Lights" })).toBeEnabled();
    expect(canvas.getAllByRole("link")).toHaveLength(5);
    expect(
      getComputedStyle(canvas.getByRole("button", { name: "Lire The Northern Lights" }))
        .borderRadius,
    ).toBe("7px");
    const card = canvasElement.querySelector(".artist-presentation")!;
    expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(108);
  },
};
