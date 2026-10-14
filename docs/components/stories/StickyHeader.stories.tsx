import { expect } from "storybook/test";
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
