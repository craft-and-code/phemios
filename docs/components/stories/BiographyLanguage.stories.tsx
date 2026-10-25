import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { BiographyLanguageNotice } from "../../../src/components/BiographyLanguageNotice";
import { changeLanguage } from "../../../src/i18n";
const meta = {
  title: "Catalog/BiographyLanguageNotice",
  component: BiographyLanguageNotice,
  args: { language: "en" },
  decorators: [
    (Story) => {
      changeLanguage("fr");
      return <Story />;
    },
  ],
} satisfies Meta<typeof BiographyLanguageNotice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EnglishFallback: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText("Biographie affichée en anglais.")).toBeVisible();
  },
};
export const French: Story = {
  args: { language: "fr" },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector(".biography-language-notice")).toBeNull();
  },
};
export const Unknown: Story = {
  args: { language: undefined },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector(".biography-language-notice")).toBeNull();
  },
};

export const LanguageSwitch: Story = {
  render: (args) => (
    <>
      <BiographyLanguageNotice {...args} />
      <button onClick={() => changeLanguage("en")}>English</button>
      <button onClick={() => changeLanguage("fr")}>Français</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Biographie affichée en anglais.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "English" }));
    expect(canvasElement.querySelector(".biography-language-notice")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Français" }));
    expect(canvas.getByText("Biographie affichée en anglais.")).toBeVisible();
  },
};
