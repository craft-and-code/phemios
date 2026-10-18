import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { RefreshButton } from "../../../src/components/RefreshButton";
import { TransferPanel } from "../../../src/components/TransferPanel";
import { createTransferRecipe } from "../../../src/library/transfer-recipe";
import { TransferDestination } from "../../../src/components/TransferDestination";
import type { PlayerVolume } from "../../../src/library/players";
import { t } from "../../../src/i18n";
const folder: PlayerVolume = {
  id: "mount:9",
  adapter: "mounted",
  name: "Exports",
  path: "/Users/example/Exports",
  kind: "folder",
  icon: "folder",
  format: "",
  available: true,
  ejectable: false,
};
const meta = {
  title: "Media/TransferDestination",
  component: TransferDestination,
  args: {
    busy: false,
    volumes: [],
    selected: "",
    canChoose: true,
    onChoose: () => {},
    onSelect: () => {},
  },
  render: (args) => {
    const [volumes, setVolumes] = createSignal<readonly PlayerVolume[] | undefined>(args.volumes);
    const [selected, setSelected] = createSignal(args.selected);
    return (
      <TransferDestination
        {...args}
        volumes={volumes()}
        selected={selected()}
        onSelect={setSelected}
        onChoose={() => {
          setVolumes([folder]);
          setSelected(folder.id!);
        }}
      />
    );
  },
} satisfies Meta<typeof TransferDestination>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PickFolder: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: t("Choisir un dossier…") }));
    expect(c.getByText(folder.path, { exact: false })).toBeVisible();
    expect(c.getByRole("button", { name: t("Sélectionner") })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(c.queryByRole("button", { name: /Éjecter/ })).toBeNull();
  },
};
export const Locked: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    expect(
      within(canvasElement).getByRole("button", { name: t("Choisir un dossier…") }),
    ).toBeDisabled();
  },
};

export const StableRefresh: Story = {
  render: (args) => {
    const [busy, setBusy] = createSignal(false),
      [selected, setSelected] = createSignal("mount:0");
    return (
      <>
        <RefreshButton
          busy={busy()}
          busyIndicator="stop"
          onRefresh={() => {
            setSelected("");
            setBusy(true);
          }}
          onCancel={() => setBusy(false)}
        />
        <TransferDestination
          {...args}
          busy={busy()}
          selected={selected()}
          volumes={Array.from({ length: 5 }, (_, index) => ({
            ...folder,
            id: `mount:${index}`,
            name: `Example device ${index}`,
          }))}
        />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      region = canvas.getByRole("region", { name: t("Périphérique de destination") });
    expect(canvas.getByText("Destination sélectionnée : Example device 0")).toBeVisible();
    const before = region.getBoundingClientRect().height;
    await userEvent.click(canvas.getByRole("button", { name: t("Actualiser") }));
    expect(Math.abs(before - region.getBoundingClientRect().height)).toBeLessThan(1);
    const spinner = region.querySelector(".spinner")!.getBoundingClientRect(),
      bounds = region.getBoundingClientRect();
    expect(Math.abs(spinner.y + spinner.height / 2 - bounds.y - bounds.height / 2)).toBeLessThan(1);
    expect(canvas.queryByRole("button", { name: t("Sélectionner") })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: t("Arrêter") }));
    expect(canvas.getAllByRole("button", { name: t("Sélectionner") })).toHaveLength(5);
  },
};

export const ForgetFolderAndReset: Story = {
  render: (args) => {
    const [volumes, setVolumes] = createSignal<readonly PlayerVolume[]>([]);
    const recipe = createTransferRecipe(volumes, () => false);
    return (
      <>
        <TransferDestination
          {...args}
          volumes={volumes()}
          selected={recipe.selected()}
          onSelect={recipe.select}
          onChoose={() => {
            setVolumes([folder]);
            recipe.select(folder.id!);
          }}
          onRemove={() => setVolumes([])}
        />
        <TransferPanel
          rows={[]}
          destination={recipe.selected()}
          ipod={false}
          options={recipe.options()}
          preview={undefined}
          status={{ phase: "idle", running: false }}
          preparing={false}
          error=""
          onOptions={recipe.setOptions}
          onPreview={() => {}}
          onStart={() => {}}
          onCancel={() => {}}
        />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const format = c.getByRole("combobox", { name: t("Format de destination") });
    expect(format).toBeDisabled();
    await userEvent.click(c.getByRole("button", { name: t("Choisir un dossier…") }));
    expect(format).toBeEnabled();
    await userEvent.click(format);
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("option", { name: /^MP3$/ }),
    );
    const replace = c.getByRole("checkbox", {
      name: t("Autoriser le remplacement des fichiers existants"),
    });
    await userEvent.click(replace);
    expect(replace).toBeChecked();
    await userEvent.click(c.getByRole("button", { name: t("Retirer {0}", folder.name) }));
    expect(c.queryByText(folder.path, { exact: false })).toBeNull();
    expect(format).toBeDisabled();
    expect(format).toHaveTextContent(t("Original · sans conversion"));
    expect(replace).not.toBeChecked();
    expect(replace).toBeDisabled();
    expect(
      c.getByRole("checkbox", { name: t("Vérifier les fichiers copiés et déjà présents") }),
    ).toBeChecked();
  },
};
