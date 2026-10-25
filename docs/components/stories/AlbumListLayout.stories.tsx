import { createSignal, For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { CoverSize } from "../../../src/components/CoverSize";
import { CoverPlayView } from "../../../src/components/CoverPlayView";
import { PlaybackActionsView } from "../../../src/components/PlaybackActionsView";
import { AlbumCardView } from "../../../src/components/AlbumCardView";
import { QueueAppendView } from "../../../src/components/QueueAppendView";
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
        <For
          each={[
            "Les heures bleues",
            "Fragments de nuit — un très long titre pour vérifier le retour à la ligne",
          ]}
        >
          {(title, index) => (
            <AlbumCardView
              href="#fictional-album"
              title={title}
              year={index() ? t("Année inconnue") : "2022"}
              artwork={
                <div
                  class="artwork"
                  role="img"
                  aria-label={`Pochette : ${title}`}
                  data-palette={index()}
                >
                  <span>{title}</span>
                </div>
              }
              actions={
                <PlaybackActionsView
                  append={
                    <QueueAppendView
                      reference={`release:fictional-${index()}`}
                      title={title}
                      class="cover-play"
                      onAppend={async () => 1}
                    />
                  }
                  play={
                    <CoverPlayView
                      reference={`release:fictional-${index()}`}
                      title={title}
                      onPlay={async () => {}}
                    />
                  }
                />
              }
            />
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
  const assertLayout = () => {
    for (const row of canvasElement.querySelectorAll(".album-card")) {
      const cover = row.querySelector(".album-cover")!;
      const picture = cover.getBoundingClientRect();
      const title = row.querySelector(".album-title-link")!.getBoundingClientRect();
      const heading = row.querySelector(".album-title-line")!.getBoundingClientRect();
      const year = row.querySelector(".album-year")!.getBoundingClientRect();
      expect(year.top).toBeGreaterThanOrEqual(heading.bottom);
      expect(
        Math.abs(title.top + title.height / 2 - (picture.top + picture.height / 2)),
      ).toBeLessThanOrEqual(1);
      expect(row.querySelector(":scope > .media-actions")).toBeNull();
      const buttons = cover.querySelectorAll("button");
      expect(buttons).toHaveLength(2);
      const add = buttons[0]!.getBoundingClientRect(),
        play = buttons[1]!.getBoundingClientRect();
      expect(add.right).toBeLessThanOrEqual(play.left);
      for (const control of [add, play]) {
        expect(control.left).toBeGreaterThanOrEqual(picture.left);
        expect(control.right).toBeLessThanOrEqual(picture.right);
        expect(control.top).toBeGreaterThanOrEqual(picture.top);
        expect(control.bottom).toBeLessThanOrEqual(picture.bottom);
        expect(Math.round(control.width)).toBe(Math.round(control.height));
      }
    }
  };
  assertLayout();
  const initial = artwork.getBoundingClientRect();
  const initialButton = card.querySelector("button")!.getBoundingClientRect().width;
  expect(Math.round(initial.width)).toBe(100);
  // Testing Library does not implement the browser's default keyboard action for range inputs.
  fireEvent.input(slider, { target: { value: "280" } });
  expect(slider).toHaveValue("280");
  const larger = artwork.getBoundingClientRect();
  expect(larger.width).toBeGreaterThan(initial.width);
  expect(larger.width).toBeLessThanOrEqual(280);
  expect(Math.round(larger.height)).toBe(Math.round(larger.width));
  expect(card.querySelector("button")!.getBoundingClientRect().width).toBeGreaterThan(
    initialButton,
  );
  assertLayout();
  expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
  for (const control of card.querySelectorAll("button")) {
    expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right,
    );
  }
  fireEvent.input(slider, { target: { value: "100" } });
  expect(slider).toHaveValue("100");
  expect(Math.round(artwork.getBoundingClientRect().width)).toBe(100);
  fireEvent.input(slider, { target: { value: "56" } });
  assertLayout();
  // Focusing a cover reveals its sibling actions without hovering or navigating.
  (card.querySelector(".album-art-link") as HTMLAnchorElement).focus();
  await userEvent.tab();
  expect(card.querySelector("button")).toHaveFocus();
  expect(getComputedStyle(card.querySelector(".media-actions")!).opacity).toBe("1");
  await userEvent.tab();
  expect(card.querySelectorAll("button")[1]).toHaveFocus();
  fireEvent.input(slider, { target: { value: "100" } });
};
export const ResizableAlbumList: Story = { play: resize };
export const NarrowAlbumList: Story = { render: () => <ResizableList narrow />, play: resize };
