import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, Show } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LabelLogoView } from "../../../src/components/LabelLogoView";
import { t } from "../../../src/i18n";
import monochrome from "../fixtures/label-logo-grayscale-alpha.png";
const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80"><text x="4" y="58" fill="white" font-family="serif" font-size="58">STUDIO QA</text></svg>')}`;
// A centered mark in a tall transparent canvas must remain inside the reserved frame.
const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="640"><rect x="40" y="280" width="240" height="80" fill="white"/></svg>')}`;
const meta = {
  title: "Catalog/LabelLogo",
  component: LabelLogoView,
  args: { name: "Studio QA", url: logo, large: false },
} satisfies Meta<typeof LabelLogoView>;
export default meta;
type Story = StoryObj<typeof meta>;
const measure: NonNullable<Story["play"]> = async ({ canvasElement, args }) => {
  const image = within(canvasElement).getByRole("img", {
    name: t("Logo de {0}", args.name),
  }) as HTMLImageElement;
  await waitFor(() => expect(image.naturalWidth).toBe(320));
  expect(getComputedStyle(image).objectFit).toBe("contain");
  const frame = canvasElement.querySelector(".label-logo")!.getBoundingClientRect();
  expect(frame.width).toBe(args.large ? 160 : 64);
  expect(frame.height).toBe(args.large ? 100 : 44);
  const painted = image.getBoundingClientRect();
  expect(painted.width).toBe(frame.width);
  expect(painted.height).toBe(frame.height);
  expect(painted.x).toBe(frame.x);
  expect(painted.y).toBe(frame.y);
};
export const Row: Story = { play: measure };
export const Header: Story = {
  args: { large: true },
  render: (args) => (
    <article class="label-page">
      <header class="artist-hero">
        <LabelLogoView {...args} />
        <div>
          <p class="eyebrow">LABEL</p>
          <div class="detail-title">
            <h1>{args.name}</h1>
          </div>
        </div>
      </header>
    </article>
  ),
  play: async (context) => {
    await measure(context);
    const hero = context.canvasElement.querySelector(".artist-hero")!;
    expect(getComputedStyle(hero).flexDirection).toBe("row");
  },
};
export const PortraitRow: Story = { args: { url: portrait }, play: measure };
export const PortraitHeader: Story = {
  ...Header,
  args: { large: true, url: portrait },
};
export const TransparentMonochromeHeader: Story = {
  ...Header,
  args: { large: true, url: monochrome },
};
export const OpenCachedLogoAtHeaderSize: Story = {
  args: { large: true, url: monochrome },
  render: (args) => {
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <Show when={open()} fallback={<LabelLogoView {...args} large={false} />}>
          <article class="label-page">
            <header class="artist-hero">
              <LabelLogoView {...args} />
              <div>
                <h1>{args.name}</h1>
              </div>
            </header>
          </article>
        </Show>
        <button onClick={() => setOpen(true)}>Open label</button>
      </>
    );
  },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    const preview = canvas.getByRole("img", {
      name: t("Logo de {0}", context.args.name),
    }) as HTMLImageElement;
    await waitFor(() => expect(preview.naturalWidth).toBe(320));
    expect(preview.getBoundingClientRect().height).toBe(44);
    await userEvent.click(canvas.getByRole("button", { name: "Open label" }));
    await measure(context);
  },
};
export const Unavailable: Story = {
  args: { url: undefined },
  play: async ({ canvasElement }) => {
    expect(
      within(canvasElement).getByRole("img", {
        name: t("Logo indisponible pour {0}", "Studio QA"),
      }),
    ).toBeVisible();
    expect(canvasElement.querySelector("img")).toBeNull();
  },
};
export const DecodeFailureAndReplacement: Story = {
  render: (args) => {
    const [url, setUrl] = createSignal("data:image/png;base64,AAAA");
    return (
      <>
        <LabelLogoView {...args} url={url()} />
        <button onClick={() => setUrl(logo)}>Replace logo</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByRole("img", { name: t("Logo indisponible pour {0}", "Studio QA") }),
      ).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Replace logo" }));
    const image = canvas.getByRole("img", {
      name: t("Logo de {0}", "Studio QA"),
    }) as HTMLImageElement;
    await waitFor(() => expect(image.naturalWidth).toBe(320));
  },
};
