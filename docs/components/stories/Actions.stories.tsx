import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ActionButton } from "../../../src/components/ActionButton";

const meta = {
  title: "Controls/ActionButton",
  component: ActionButton,
  args: { children: "Lecture", icon: "play", type: "button", busy: false, disabled: false },
  argTypes: {
    children: { control: "text" },
    icon: { control: "text" },
    busy: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The application's real shared action geometry. Busy work replaces the icon and disables the action.",
      },
    },
  },
} satisfies Meta<typeof ActionButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Working: Story = { args: { busy: true } };
export const Disabled: Story = { args: { disabled: true } };
