import { expect } from "storybook/test";
import { StickyHeader } from "../../../src/components/StickyHeader";
import { Icon } from "../../../src/components/Icon";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { EmptyState } from "../../../src/components/EmptyState";
const meta = {
  title: "Status/EmptyState",
  component: EmptyState,
  args: { icon: "heart", children: "Aucun album favori dans cette sélection." },
  render: (args) => (
    <div class="component-empty">
      <EmptyState {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Tags: Story = {
  args: { icon: "tags", children: "Aucun élément tagué dans cette sélection." },
};
export const Layout: Story = {
  render: () => (
    <div>
      {["Tags", "Moods", "Favorites", "Rated", "Collections", "History", "Saved"].map((view) => (
        <main style={{ height: "400px" }} data-view={view}>
          <section class="page result-page">
            <StickyHeader separator={view !== "History"}>
              <div class="personal-selection-actions">
                <button class="icon-button" disabled aria-label="Collection">
                  <Icon name="library" />
                </button>
              </div>
            </StickyHeader>
            {view === "Saved" ? (
              <section class="wikipedia-panel">
                <p class="notice account-notice">
                  Connectez-vous pour accéder aux données de votre compte.
                </p>
                <EmptyState icon="heart">No retained results.</EmptyState>
              </section>
            ) : (
              <>
                <p class="notice account-notice">
                  Connectez-vous pour accéder aux données de votre compte.
                </p>
                {view === "Moods" && <div class="mood-cards" />}
                <EmptyState icon={view === "Rated" ? "star" : "heart"}>
                  No retained results.
                </EmptyState>
              </>
            )}
          </section>
        </main>
      ))}
    </div>
  ),
  play: ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll("main[data-view]")].map((page) => {
      const icon = page.querySelector(".empty-state > svg")!.getBoundingClientRect();
      const text = page.querySelector(".empty-state > p")!.getBoundingClientRect();
      expect(icon.width).toBe(38);
      expect(icon.height).toBe(38);
      const groupCenter = (icon.top + text.bottom) / 2 - page.getBoundingClientRect().top;
      return groupCenter;
    });
    for (const center of rows) expect(Math.abs(center - rows[0]!)).toBeLessThan(0.6);
  },
};
