import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
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
    <main class="component-sticky">
      <StickyHeader>
        <div class="choices">
          <button>Favorites</button>
        </div>
      </StickyHeader>
      <StickyHeader>
        <div class="tag-choices">
          <button>music</button>
          <button>live</button>
        </div>
      </StickyHeader>
    </main>
  ),
  play: ({ canvasElement }) => {
    const headers = [...canvasElement.querySelectorAll(".page-sticky-header")];
    const gaps = headers.map(
      (header) =>
        header.getBoundingClientRect().bottom -
        header.querySelector("button")!.getBoundingClientRect().bottom,
    );
    expect(Math.abs(gaps[0]! - gaps[1]!)).toBeLessThan(0.6);
  },
};
