import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { BiographyMore } from "../../../src/components/BiographyMore";
const meta = {
  title: "Catalog/BiographyMore",
  component: BiographyMore,
  args: { busy: false, disabled: false, onOpen: () => {} },
  render: (args) => {
    const [busy, setBusy] = createSignal(args.busy);
    return (
      <section class="biography">
        <p>
          Un résumé fictif se termine ici.
          <BiographyMore {...args} busy={busy()} onOpen={() => setBusy(true)} />
        </p>
        <small>Source · licence</small>
      </section>
    );
  },
} satisfies Meta<typeof BiographyMore>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InlineActivity: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Lire plus" });
    expect(button.closest("p")).not.toBeNull();
    const before = button.querySelector(".biography-more-icon")!.getBoundingClientRect();
    await userEvent.click(button);
    expect(button).toBeDisabled();
    const spinner = button.querySelector(".spinner")!.getBoundingClientRect();
    expect(Math.abs(spinner.y + spinner.height / 2 - before.y - before.height / 2)).toBeLessThan(1);
    expect(getComputedStyle(button.querySelector(".spinner")!).width).toBe(`${before.width}px`);
    expect(button.querySelector("svg")).toBeNull();
  },
};

/** Match the artist page's positioned content and current-track link, without native/account state. */
export const DuringArtistPlayback: Story = {
  render: () => {
    const [opened, setOpened] = createSignal("none");
    return (
      <article class="artist-page">
        <div class="artist-body">
          <div class="page artist-content">
            <section class="biography">
              <h2>Biographie</h2>
              <p>
                Un résumé fictif pendant l’écoute d’une piste.
                <BiographyMore
                  busy={false}
                  disabled={false}
                  onOpen={() => setOpened("biography")}
                />
              </p>
            </section>
            <div class="artist-playing track-heading">
              <span class="track-number">1.</span>
              <a
                class="track-title"
                href="#fictional-playing-track"
                onClick={(event) => {
                  event.preventDefault();
                  setOpened("track");
                }}
              >
                Fictional current track
              </a>
            </div>
            <ol class="track-list">
              <li class="track-row">
                <div class="track-main-row" data-testid="catalogue-row">
                  <div class="track-heading">
                    <a
                      class="track-title"
                      href="#fictional-catalogue-track"
                      onClick={(event) => {
                        event.preventDefault();
                        setOpened("catalogue-track");
                      }}
                    >
                      Fictional catalogue track
                    </a>
                    <small>4:00</small>
                  </div>
                </div>
              </li>
            </ol>
            <output aria-label="Opened destination">{opened()}</output>
          </div>
        </div>
      </article>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Lire plus" });
    const bounds = button.getBoundingClientRect();
    const hit = canvasElement.ownerDocument.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
    expect(hit !== null && button.contains(hit)).toBe(true);
    await userEvent.click(button);
    expect(canvas.getByLabelText("Opened destination")).toHaveTextContent("biography");
    await userEvent.click(canvas.getByRole("link", { name: "Fictional current track" }));
    expect(canvas.getByLabelText("Opened destination")).toHaveTextContent("track");
    const row = canvas.getByTestId("catalogue-row").getBoundingClientRect();
    const track = canvas.getByRole("link", { name: "Fictional catalogue track" });
    const rowHit = canvasElement.ownerDocument.elementFromPoint(
      row.right - 2,
      row.top + row.height / 2,
    );
    expect(rowHit !== null && track.contains(rowHit)).toBe(true);
    await userEvent.click(track);
    expect(canvas.getByLabelText("Opened destination")).toHaveTextContent("catalogue-track");
  },
};
