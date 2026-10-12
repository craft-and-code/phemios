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
