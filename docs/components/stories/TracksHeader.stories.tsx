import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect } from "storybook/test";
import { TracksHeader } from "../../../src/components/TracksHeader";
import { Pagination } from "../../../src/components/Pagination";
const meta = {
  title: "Foundation/TracksHeader",
  component: TracksHeader,
  args: {
    total: 200,
    offset: 0,
    size: 50,
    sizes: [25, 50, 100, 200],
    busy: false,
    pending: false,
    onRefresh: () => {},
    onCancel: () => {},
    onSize: () => {},
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
        <Pagination
          total={args.total}
          offset={args.offset}
          size={args.size}
          count={args.size}
          onOffset={() => {}}
        />
      </section>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector(".page-sticky-header")!,
      scroller = canvasElement.querySelector<HTMLElement>(".tracks-results")!,
      controls = canvasElement.querySelector(".tracks-header-controls")!;
    const top = header.getBoundingClientRect().top;
    scroller.scrollTop = 200;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(header.getBoundingClientRect().top).toBe(top);
    expect(getComputedStyle(controls).gap).toBe("8px");
    expect(getComputedStyle(controls).marginTop).toBe("0px");
    expect(header.contains(canvasElement.querySelector(".pagination-controls"))).toBe(false);
    const arrows = canvasElement.querySelectorAll(".pagination-controls button svg path");
    expect(arrows[0]?.getAttribute("d")).toBe("M19 12H5m7-7-7 7 7 7");
    expect(arrows[1]?.getAttribute("d")).toBe("M5 12h14m-7-7 7 7-7 7");
    expect(header.contains(canvasElement.querySelector(".track-page-size"))).toBe(true);
    expect(
      header.querySelectorAll("button[title='Précédentes'], button[title='Suivantes']").length,
    ).toBe(0);
    expect(parseFloat(getComputedStyle(scroller).paddingRight)).toBeGreaterThanOrEqual(12);
  },
};
