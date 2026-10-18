import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { RadioFavourites } from "../../../src/components/RadioFavourites";
import { CountryGlobe } from "../../../src/components/CountryGlobe";
import { artists, loadCountries } from "../fixtures/countries";
const stations = Array.from({ length: 30 }, (_, index) => ({
  uuid: `fictional-${index}`,
  name: `Example station ${index + 1}`,
  country: "France",
  countryCode: "FR",
  tags: "Rock",
  codec: "MP3",
  bitrate: 128,
}));
const meta = {
  title: "Media/RadioFavourites",
  component: RadioFavourites,
  args: {
    favourites: { stations: () => stations, error: () => "", toggle: async () => {} },
    play: () => {},
    busy: false,
    writable: true,
  },
  render: (args) => (
    <section class="page radio-page radio-explorer">
      <aside class="radio-world" tabindex="0" aria-label="Country and favourite stations">
        <CountryGlobe
          artists={artists}
          loadCountries={loadCountries}
          selected={[]}
          onSelect={() => {}}
        />
        <RadioFavourites {...args} />
      </aside>
      <div class="radio-results">Fictional directory results</div>
    </section>
  ),
} satisfies Meta<typeof RadioFavourites>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WholeColumnScroll: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByRole("combobox", { name: "Pays" })).toBeVisible(),
    );
    const column = canvasElement.querySelector<HTMLElement>(".radio-world")!;
    const list = canvasElement.querySelector<HTMLElement>(".radio-favourites .radio-stations")!;
    expect(getComputedStyle(column).overflowY).toBe("auto");
    expect(parseFloat(getComputedStyle(column).paddingInlineEnd)).toBeGreaterThanOrEqual(8);
    expect(column.scrollHeight).toBeGreaterThan(column.clientHeight);
    expect(getComputedStyle(list).overflowY).toBe("visible");
    expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight + 1);
  },
};
