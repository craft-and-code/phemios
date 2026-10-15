import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal, Show } from "solid-js";
import { TrackIntegrity } from "../../../src/components/TrackIntegrity";
import { TrackIntegrityError } from "../../../src/components/TrackIntegrityError";
import {
  createIntegrityDisclosure,
  type IntegrityResult,
} from "../../../src/library/album-integrity";
const meta = {
  title: "Data/TrackIntegrityError",
  component: TrackIntegrityError,
  args: { id: "fictional-error", result: { status: "ko", verifier: "Rust" }, onClose: () => {} },
} satisfies Meta<typeof TrackIntegrityError>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoFurtherDetails: Story = {};
export const Disclosure: Story = {
  render: () => {
    const [result, setResult] = createSignal<IntegrityResult | undefined>({
      status: "ko",
      verifier: "Failed",
      message: "flac -t rejected the complete stream:\nERROR: MD5 mismatch\n<not-html>",
    });
    const [navigation, setNavigation] = createSignal(0);
    const [playbackKeys, setPlaybackKeys] = createSignal(0);
    const detail = createIntegrityDisclosure(result);
    const close = () => {
      detail.close();
      document.getElementById("fixture-error-toggle")?.focus();
    };
    return (
      <div
        onKeyDown={(event) => {
          if (event.code === "Space") {
            event.preventDefault();
            setPlaybackKeys((value) => value + 1);
          }
        }}
      >
        <ol class="track-list">
          <li class="track-row">
            <div class="track-main-row">
              <div class="track-heading">
                <span class="track-number">1.</span>
                <TrackIntegrity
                  result={result()}
                  id="fixture-error-toggle"
                  controls="fixture-error-detail"
                  expanded={detail.open()}
                  onToggle={detail.toggle}
                />
                <a
                  href="#fictional-track"
                  class="track-title"
                  data-testid="track-title"
                  onClick={(event) => {
                    event.preventDefault();
                    setNavigation((value) => value + 1);
                  }}
                >
                  Fictional failed track
                </a>
              </div>
            </div>
            <Show when={detail.open()}>
              <TrackIntegrityError id="fixture-error-detail" result={result()} onClose={close} />
            </Show>
          </li>
        </ol>
        <output data-testid="navigation">{navigation()}</output>
        <output data-testid="playback-keys">{playbackKeys()}</output>
        <button
          onClick={() =>
            setResult({ status: "ko", verifier: "Rust", message: "Different failure" })
          }
        >
          Fresh check result
        </button>
        <button onClick={() => setResult(undefined)}>Clear result</button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", {
      name: "Afficher ou masquer le détail de l’erreur d’intégrité",
    });
    const title = canvas.getByTestId("track-title");
    const left = title.getBoundingClientRect().left;
    expect(toggle.getBoundingClientRect().width).toBe(16);
    expect(toggle.getBoundingClientRect().height).toBe(16);
    expect(canvas.queryByRole("region")).toBeNull();
    await userEvent.click(toggle);
    const region = canvas.getByRole("region", { name: "Détail de l’erreur d’intégrité" });
    expect(region).toBeVisible();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", region.id);
    expect(region).toHaveTextContent("ERROR: MD5 mismatch");
    expect(region).toHaveTextContent("<not-html>");
    expect(region.querySelector("not-html")).toBeNull();
    expect(getComputedStyle(region.querySelector(".track-integrity-diagnostic")!).whiteSpace).toBe(
      "pre-wrap",
    );
    expect(canvas.getByTestId("navigation")).toHaveTextContent("0");
    expect(title.getBoundingClientRect().left).toBe(left);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
    expect(canvas.queryByRole("region")).toBeNull();
    expect(toggle).toHaveFocus();
    await userEvent.click(toggle);
    await userEvent.click(toggle);
    expect(canvas.queryByRole("region")).toBeNull();
    await userEvent.keyboard("[Space]");
    expect(canvas.getByRole("region")).toBeVisible();
    expect(canvas.getByTestId("playback-keys")).toHaveTextContent("0");
    canvas.getByRole("button", { name: "Fermer le détail de l’erreur" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(canvas.queryByRole("region")).toBeNull();
    expect(toggle).toHaveFocus();
    await userEvent.click(toggle);
    await userEvent.click(canvas.getByRole("button", { name: "Fermer le détail de l’erreur" }));
    expect(toggle).toHaveFocus();
    await userEvent.click(toggle);
    await userEvent.click(canvas.getByRole("button", { name: "Fresh check result" }));
    expect(canvas.queryByRole("region")).toBeNull();
    await userEvent.click(toggle);
    expect(canvas.getByRole("region")).toHaveTextContent("Different failure");
    await userEvent.click(canvas.getByRole("button", { name: "Clear result" }));
    expect(canvas.queryByRole("region")).toBeNull();
    expect(
      canvas.queryByRole("button", {
        name: "Afficher ou masquer le détail de l’erreur d’intégrité",
      }),
    ).toBeNull();
  },
};
