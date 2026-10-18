import { expect, waitFor, within } from "storybook/test";
import { t } from "../../../src/i18n";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CountryGlobe } from "../../../src/components/CountryGlobe";
import { controlledValue } from "../fixtures/controlled";
import { artists, loadCountries } from "../fixtures/countries";
const meta = {
  title: "Media/CountryGlobe",
  component: CountryGlobe,
  args: { artists, loadCountries, selected: [], onSelect: () => {} },
  render: (args) => {
    const [selected, change] = controlledValue<readonly (string | null)[]>(() => args.selected);
    return (
      <CountryGlobe
        {...args}
        selected={selected()}
        onSelect={(country, additive) => {
          if (country === undefined) change([]);
          else
            change(
              additive
                ? selected().includes(country)
                  ? selected().filter((v) => v !== country)
                  : [...selected(), country]
                : [country],
            );
        }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Real globe and country controls with fictional artists and local public borders. No country service, account or geolocation is requested.",
      },
    },
  },
} satisfies Meta<typeof CountryGlobe>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("combobox", { name: t("Pays") })).toBeVisible());
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    const summary = canvasElement.querySelector(".globe-help summary")!;
    const arrow = summary.querySelector("svg")!.getBoundingClientRect();
    const label = summary.querySelector("span")!.getBoundingClientRect();
    expect(Math.abs(arrow.top + arrow.height / 2 - (label.top + label.height / 2))).toBeLessThan(1);
    expect(label.left - arrow.right).toBe(6);
    expect(getComputedStyle(canvasElement.querySelector(".globe-panel")!).userSelect).toBe("none");
    expect(getComputedStyle(canvas.getByRole("img", { name: /Globe/ })).userSelect).toBe("none");
  },
};
