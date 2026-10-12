import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CountryExplorer } from "../../../src/components/CountryExplorer";
import { controlledValue } from "../fixtures/controlled";
import { artists, loadCountries } from "../fixtures/countries";
const meta = {
  title: "Media/CountryExplorer",
  component: CountryExplorer,
  args: { artists, loadCountries, selected: [], onSelect: () => {} },
  render: (args) => {
    const [selected, change] = controlledValue<readonly (string | null)[]>(() => args.selected);
    return (
      <CountryExplorer
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
} satisfies Meta<typeof CountryExplorer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
