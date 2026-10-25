import { createSignal, For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, fireEvent, within } from "storybook/test";
import { CoverSize } from "../../../src/components/CoverSize";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
import { PlaybackActionsView } from "../../../src/components/PlaybackActionsView";
import { Icon } from "../../../src/components/Icon";
import { t } from "../../../src/i18n";

/** Shared album-list CSS and props-only controls, with fictional rows and no account state. */
function ResizableList(props: { narrow?: boolean }) {
  const [size, setSize] = createSignal(100);
  return (
    <section
      class="density-compact"
      style={{ width: props.narrow ? "380px" : "100%", "max-width": "100%" }}
    >
      <CoverSize value={size()} disabled={false} onChange={setSize} />
      <div class="album-grid" style={{ "--album-cover-min": `${size()}px` }}>
        <For each={["Les heures bleues", "Fragments de nuit"]}>
          {(title, index) => (
            <article class="album-card">
              <a class="album-art-link" href="#fictional-album">
                <div
                  class="artwork"
                  role="img"
                  aria-label={`Pochette : ${title}`}
                  data-palette={index()}
                >
                  <span>{title}</span>
                </div>
              </a>
              <a class="album-title-link" href="#fictional-album">
                <span class="album-title-line">
                  <strong>{title}</strong>
                </span>
              </a>
              <small class="album-year">{index() ? "Année inconnue" : "2022"}</small>
              <PlaybackActionsView
                append={
                  <button class="icon-button cover-play" aria-label={`Ajouter ${title} à la suite`}>
                    <Icon name="plus" />
                  </button>
                }
                play={
                  <CoverPlayView
                    reference={`release:fictional-${index()}`}
                    title={title}
                    onPlay={async () => {}}
                  />
                }
              />
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
const meta = {
  title: "Data/AlbumListLayout",
  component: CoverSize,
  args: { value: 100, disabled: false, onChange: () => {} },
  render: () => <ResizableList />,
} satisfies Meta<typeof CoverSize>;
export default meta;
type Story = StoryObj<typeof meta>;

const resize: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const slider = within(canvasElement).getByRole("slider", { name: t("Taille des pochettes") });
  const artwork = canvasElement.querySelector(".album-grid .artwork")!;
  const grid = canvasElement.querySelector(".album-grid")!;
  const card = artwork.closest(".album-card")!;
  const initial = artwork.getBoundingClientRect();
  expect(Math.round(initial.width)).toBe(100);
  // Testing Library does not implement the browser's default keyboard action for range inputs.
  fireEvent.input(slider, { target: { value: "280" } });
  expect(slider).toHaveValue("280");
  const larger = artwork.getBoundingClientRect();
  expect(larger.width).toBeGreaterThan(initial.width);
  expect(larger.width).toBeLessThanOrEqual(280);
  expect(Math.round(larger.height)).toBe(Math.round(larger.width));
  expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
  for (const control of card.querySelectorAll("button")) {
    expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right,
    );
  }
  fireEvent.input(slider, { target: { value: "100" } });
  expect(slider).toHaveValue("100");
  expect(Math.round(artwork.getBoundingClientRect().width)).toBe(100);
};
export const ResizableAlbumList: Story = { play: resize };
export const NarrowAlbumList: Story = { render: () => <ResizableList narrow />, play: resize };
