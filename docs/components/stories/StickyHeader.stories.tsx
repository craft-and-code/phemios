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
