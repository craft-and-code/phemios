import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect } from "storybook/test";
import { TracksHeader } from "../../../src/components/TracksHeader";
import { ChoiceSelect } from "../../../src/components/ChoiceSelect";
const meta = {
  title: "Foundation/TracksHeader",
  component: TracksHeader,
  args: {
    total: 200,
    offset: 0,
    size: 50,
    busy: false,
    pending: false,
    onRefresh: () => {},
    onCancel: () => {},
    onOffset: () => {},
  },
} satisfies Meta<typeof TracksHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FixedWhileScrolling: Story = {
  render: (args) => (
    <main class="component-sticky" style={{ height: "480px" }}>
      <section class="page result-page tracks-page">
        <TracksHeader {...args} />
        <div class="tracks-results" tabIndex={0}>
          {Array.from({ length: 50 }, (_, i) => (
            <p>Example track {i + 1}</p>
          ))}
        </div>
        <div class="track-page-size">
          <span>Tracks per page</span>
          <ChoiceSelect
            label="Tracks per page"
            value="50"
            options={[{ value: "50", label: "50" }]}
            onChange={() => {}}
          />
        </div>
      </section>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector(".page-sticky-header")!,
      scroller = canvasElement.querySelector<HTMLElement>(".tracks-results")!,
      controls = canvasElement.querySelector(".page-controls")!;
    const top = header.getBoundingClientRect().top;
    scroller.scrollTop = 200;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(header.getBoundingClientRect().top).toBe(top);
    expect(getComputedStyle(controls).gap).toBe("8px");
    expect(getComputedStyle(controls).marginTop).toBe("0px");
    expect(header.contains(canvasElement.querySelector(".track-page-size"))).toBe(false);
  },
};
