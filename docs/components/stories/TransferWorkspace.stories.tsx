import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { TransferSelection } from "../../../src/components/TransferSelection";
import { QueueAddView } from "../../../src/components/QueueAddView";
import { addTransferSelection } from "../../../src/library/transfers";
import type { PlayableSelection } from "../../../src/library/playback-selection";
import { t } from "../../../src/i18n";
const initial: PlayableSelection[] = Array.from({ length: 30 }, (_, index) => ({
  reference: `track:selected-${index}`,
  title: `Selected track ${index + 1}`,
  artist: "Example artist",
  album: null,
  number: index + 1,
  albumTotal: 30,
}));
const meta = {
  title: "Media/TransferWorkspace",
  component: TransferSelection,
  args: { rows: initial, disabled: false, onRemove: () => {} },
  render: (args) => {
    const [selected, setSelected] = createSignal<PlayableSelection[]>([...args.rows]);
    return (
      <div class="transfer-workspace">
        <QueueAddView
          title={t("Choisir la musique à copier")}
          footer={t("Ajout à la sélection de transfert")}
          category="tracks"
          query=""
          rows={[
            {
              key: "new",
              title: "Northern Lights",
              detail: "Example artist",
              source: "local",
              reference: "track:new",
            },
          ]}
          loading={false}
          pending=""
          added=""
          error=""
          more={false}
          offset={0}
          origins={false}
          image={() => undefined}
          disabled={() => (args.disabled ? "Transfer running" : "")}
          actionLabel={(row) => t("Sélectionner {0}", row.title)}
          onQuery={() => {}}
          onCategory={() => {}}
          onOffset={() => {}}
          onRefresh={() => {}}
          onCancel={() => {}}
          onAdd={() =>
            setSelected((rows) =>
              addTransferSelection(rows, [
                {
                  reference: "track:new",
                  title: "Northern Lights",
                  artist: "Example artist",
                  album: null,
                  number: 1,
                  albumTotal: 1,
                },
              ]),
            )
          }
        />
        <TransferSelection
          rows={selected()}
          disabled={args.disabled}
          onRemove={(ref) => setSelected((rows) => rows.filter((row) => row.reference !== ref))}
        />
      </div>
    );
  },
} satisfies Meta<typeof TransferSelection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PermanentPanes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      left = canvasElement.querySelector(".transfer-selection-panel")!,
      right = canvasElement.querySelector(".queue-add-panel")!;
    expect(canvasElement.querySelector(".transfer-workspace")?.firstElementChild).toBe(right);
    expect(
      Math.abs(left.getBoundingClientRect().height - right.getBoundingClientRect().height),
    ).toBeLessThan(1);
    expect(canvas.queryByRole("button", { name: t("Ajouter à la sélection") })).toBeNull();
    expect(canvas.queryByRole("button", { name: t("Fermer la recherche") })).toBeNull();
    const list = left.querySelector(".transfer-selection")!,
      heading = left.querySelector(".page-heading")!;
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    expect(
      list.getBoundingClientRect().right - heading.getBoundingClientRect().right,
    ).toBeGreaterThanOrEqual(5);
    await userEvent.click(
      canvas.getByRole("button", { name: t("Sélectionner {0}", "Northern Lights") }),
    );
    expect(within(left as HTMLElement).getByText("Northern Lights")).toBeVisible();
    expect(canvas.getByText(t("{0} pistes sélectionnées", 31))).toBeVisible();
  },
};
