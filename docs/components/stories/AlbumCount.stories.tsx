import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AlbumCount } from "../../../src/components/AlbumCount";
import { controlledValue } from "../fixtures/controlled";
const meta = {
  title: "Status/AlbumCount",
  component: AlbumCount,
  args: { value: 1 },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return (
      <div class="component-controls">
        <output aria-label="Album count">
          <AlbumCount value={value()} />
        </output>
        <button onClick={() => change(value() + 1)}>Add one</button>
      </div>
    );
  },
} satisfies Meta<typeof AlbumCount>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SingularAndReactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText("Album count")).toHaveTextContent(/^1 album$/);
    await userEvent.click(canvas.getByRole("button", { name: "Add one" }));
    expect(canvas.getByLabelText("Album count")).toHaveTextContent(/^2 albums$/);
  },
};
export const Empty: Story = { args: { value: 0 } };
export const Many: Story = { args: { value: 1200 } };
