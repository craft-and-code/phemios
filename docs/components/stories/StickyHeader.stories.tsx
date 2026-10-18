import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ResultCount } from "../../../src/components/ResultCount";
import { StarRating } from "../../../src/components/StarRating";
import { Icon } from "../../../src/components/Icon";
import { StickyHeader } from "../../../src/components/StickyHeader";
const meta = {
  title: "Foundation/StickyHeader",
  component: StickyHeader,
  args: { shell: true },
  render: (args) => (
    <main class="component-sticky">
      <StickyHeader {...args}>Fictional selection header</StickyHeader>
      {Array.from({ length: 20 }, (_, i) => (
        <p>Example catalogue row {i + 1}</p>
      ))}
    </main>
  ),
} satisfies Meta<typeof StickyHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Scrolling: Story = {};

export const PersonalSpacing: Story = {
  render: () => (
    <main class="component-sticky" style={{ height: "auto" }}>
      <section class="page rated-page">
        <StickyHeader>
          <div class="selection-filter-row">
            <ResultCount value={2} />
            <span>Note minimale</span>
            <StarRating value={1} label="Note minimale" onChange={() => {}} />
            <div class="selection-create-action">
              <button class="icon-button" aria-label="Collection">
                <Icon name="library" />
              </button>
            </div>
          </div>
        </StickyHeader>
        <div class="album-grid">
          <div class="artwork" />
        </div>
      </section>
      <section class="page tags-page">
        <StickyHeader>
          <div class="selection-filter-row">
            <ResultCount value={2} />
            <div class="tag-choices">
              <button>music</button>
              <button>live</button>
            </div>
            <div class="selection-create-action">
              <button class="icon-button" aria-label="Collection">
                <Icon name="library" />
              </button>
            </div>
          </div>
        </StickyHeader>
        <div class="album-grid tagged-grid">
          <div class="artwork" />
        </div>
      </section>
    </main>
  ),
  play: ({ canvasElement }) => {
    const rated = canvasElement.querySelector(".rated-page")!,
      tags = canvasElement.querySelector(".tags-page")!;
    const count = tags.querySelector(".result-count")!.getBoundingClientRect();
    const choice = tags.querySelector(".tag-choices button")!.getBoundingClientRect();
    expect(Math.abs(count.top + count.height / 2 - choice.top - choice.height / 2)).toBeLessThan(
      0.6,
    );
    const gaps = [rated, tags].map((section) => {
      const header = section.querySelector(".page-sticky-header")!.getBoundingClientRect();
      const controls = section
        .querySelector(".selection-filter-row, .personal-selection-actions")!
        .getBoundingClientRect();
      const content = section.querySelector(".album-grid")!.getBoundingClientRect();
      expect(controls.height).toBeGreaterThan(20);
      return [header.bottom - controls.bottom, content.top - header.bottom];
    });
    expect(Math.abs(gaps[0]![0]! - gaps[1]![0]!)).toBeLessThan(0.6);
    expect(Math.abs(gaps[0]![1]! - gaps[1]![1]!)).toBeLessThan(0.6);
  },
};

export const SummaryParity: Story = {
  render: () => (
    <main class="component-sticky" style={{ height: "auto" }}>
      <StickyHeader>
        <div class="selection-filter-row">
          <ResultCount value={2} />
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="page-heading">
          <span>Mounted players</span>
          <button class="icon-button">Action</button>
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="concerts-toolbar">
          <span>Artists · Concerts</span>
          <button class="icon-button">Action</button>
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="section-heading">
          <p>Unlocked trophies</p>
          <button class="icon-button">Action</button>
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="statistics-heading">
          <p>Whole library</p>
          <button class="icon-button">Action</button>
        </div>
      </StickyHeader>
    </main>
  ),
  play: ({ canvasElement }) => {
    const summaries = canvasElement.querySelectorAll(
      ".page-sticky-header > div > :is(span, p):not(.result-count)",
    );
    const reference = getComputedStyle(canvasElement.querySelector(".result-count")!);
    for (const summary of summaries) {
      const style = getComputedStyle(summary);
      expect(style.fontSize).toBe(reference.fontSize);
      expect(style.color).toBe(reference.color);
      expect(style.marginBlockStart).toBe("0px");
      expect(style.marginBlockEnd).toBe("0px");
      const action = summary.nextElementSibling!.getBoundingClientRect(),
        rect = summary.getBoundingClientRect();
      expect(Math.abs(rect.top + rect.height / 2 - action.top - action.height / 2)).toBeLessThan(1);
    }
  },
};

export const StatisticsSeparator: Story = {
  render: () => (
    <main class="component-sticky" style={{ height: "auto" }}>
      <StickyHeader>
        <div class="selection-filter-row">
          <ResultCount value={2} />
          <button class="icon-button">Tag action</button>
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="statistics-heading">
          <p>Whole library</p>
          <div class="settings-actions">
            <button class="icon-button">CSV</button>
            <button class="icon-button">Refresh</button>
          </div>
        </div>
      </StickyHeader>
    </main>
  ),
  play: ({ canvasElement }) => {
    const headers = canvasElement.querySelectorAll(".page-sticky-header");
    expect(headers[1]!.getBoundingClientRect().height).toBe(
      headers[0]!.getBoundingClientRect().height,
    );
    const controls = canvasElement.querySelector(".settings-actions")!.getBoundingClientRect(),
      header = headers[1]!.getBoundingClientRect();
    expect(Math.abs(header.bottom - controls.bottom - 13)).toBeLessThan(1);
  },
};

export const DetailAlignment: Story = {
  render: () => (
    <div>
      {["ALBUM", "PISTE"].map((kind, index) => (
        <div class="album-hero">
          <div class="artwork" style={{ height: "200px" }} />
          <div class="detail-hero-text">
            <p class="eyebrow">{kind}</p>
            <h1>Fictional detail</h1>
            {Array.from({ length: index ? 1 : 4 }, () => (
              <p>Context</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
  play: ({ canvasElement }) => {
    for (const hero of canvasElement.querySelectorAll(".album-hero")) {
      expect(
        Math.abs(
          hero.querySelector(".eyebrow")!.getBoundingClientRect().top -
            6 -
            hero.querySelector(".artwork")!.getBoundingClientRect().top,
        ),
      ).toBeLessThan(1);
    }
  },
};

export const BottomSpacing: Story = {
  render: () => (
    <div>
      {["doctor-page", "analysis-page", "achievements-page"].map((view) => (
        <main class="component-sticky" style={{ height: "320px", overflow: "auto" }}>
          <section class={`page result-page ${view}`}>
            <StickyHeader>Fictional header</StickyHeader>
            <div class="fixture-last-content" style={{ height: "500px" }}>
              Fictional result
            </div>
          </section>
        </main>
      ))}
    </div>
  ),
  play: ({ canvasElement }) => {
    for (const page of canvasElement.querySelectorAll(".result-page")) {
      const bottom =
        page.getBoundingClientRect().bottom -
        page.querySelector(".fixture-last-content")!.getBoundingClientRect().bottom;
      expect(bottom).toBeGreaterThanOrEqual(
        !page.classList.contains("achievements-page") ? 24 : 36,
      );
    }
  },
};

export const AccountVisibility: Story = {
  render: () => {
    const [connected, setConnected] = createSignal(false);
    return (
      <>
        <button onClick={() => setConnected(!connected())}>Toggle account</button>
        {[
          "moods",
          "favourites",
          "rated",
          "tags",
          "collections",
          "podcasts",
          "concerts",
          "achievements",
          "doctor",
          "analysis",
        ].map((view) => (
          <section class={`page result-page ${view}-page`} data-account-view={view}>
            <StickyHeader shell={false} visible={connected()}>
              <span>{view}</span>
              <button>Account action</button>
            </StickyHeader>
            <p class="notice">Fictional account result</p>
          </section>
        ))}
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const headers = [...canvasElement.querySelectorAll("[data-account-view] > header")];
    expect(headers).toHaveLength(10);
    for (const header of headers) expect(header.getBoundingClientRect().height).toBe(0);
    expect(canvas.queryByRole("button", { name: "Account action" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Toggle account" }));
    for (const header of headers)
      expect(header.getBoundingClientRect().height).toBeGreaterThanOrEqual(61);
    expect(canvas.getAllByRole("button", { name: "Account action" })).toHaveLength(10);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle account" }));
    for (const header of headers) expect(header.getBoundingClientRect().height).toBe(0);
  },
};
