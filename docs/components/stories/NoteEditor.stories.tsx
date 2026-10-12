import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { NoteEditor } from "../../../src/components/NoteEditor";
import { controlledValue } from "../fixtures/controlled";
const meta = {
  title: "Controls/NoteEditor",
  component: NoteEditor,
  args: {
    value: "An **example note**, with *fictional* text.\n\n- First idea\n- Second idea",
    disabled: false,
    viewOnly: false,
    onChange: () => {},
    onRead: () => {},
    onUnavailable: () => {},
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return (
      <>
        <NoteEditor {...args} value={value()} onChange={change} />
        <output class="component-readout">{value()}</output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "The actual lazy Milkdown editor. Markdown and editing remain in memory; no note is read or saved to an account.",
      },
    },
  },
} satisfies Meta<typeof NoteEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editing: Story = {};
export const ReadOnly: Story = { args: { disabled: true, viewOnly: true } };
