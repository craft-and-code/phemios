import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ChoiceSelect } from "../../../src/components/ChoiceSelect";
import { controlledValue } from "../fixtures/controlled";

const meta = {
  title: "Controls/ChoiceSelect",
  component: ChoiceSelect,
  args: {
    onChange: () => {},
    value: "local",
    label: "Fictional source",
    disabled: false,
    options: [
      { value: "local", label: "Bibliothèque locale" },
      { value: "server", label: "Serveur Aède" },
      { value: "unavailable", label: "Unavailable source", disabled: true },
    ],
  },
  argTypes: {
    value: { control: "select", options: ["local", "server", "unavailable"] },
    disabled: { control: "boolean" },
    onChange: { control: false },
  },
  render: (args) => {
    const [value, change] = controlledValue(() => args.value);
    return (
      <>
        <ChoiceSelect {...args} value={value()} onChange={change} />
        <output class="component-readout">Selected: {value()}</output>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "The real themed choice popup with keyboard, accent-insensitive prefixes and outside dismissal. Selection changes only this in-memory fixture.",
      },
    },
  },
} satisfies Meta<typeof ChoiceSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Disabled: Story = { args: { disabled: true } };
