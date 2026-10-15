import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, For } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { QueueRemoveButton } from "../../../src/components/QueueRemoveButton";
const meta = {
  title: "Media/QueueRemoveButton",
  component: QueueRemoveButton,
  args: { title: "First Track", disabled: false, onRemove: () => {} },
} satisfies Meta<typeof QueueRemoveButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Occurrences: Story = {
  render: () => {
    const [rows, setRows] = createSignal([
        { id: 0, title: "First Track" },
        { id: 1, title: "First Track" },
      ]),
      [starts, setStarts] = createSignal(0);
    return (
      <section class="playback-page">
        <div class="playback-queue" style={{ width: "460px", "max-width": "100%" }}>
          <ol>
            <For each={rows()}>
              {(row) => (
                <li onClick={() => setStarts(starts() + 1)}>
                  <span />
                  <span />
                  <QueueRemoveButton
                    title={row.title}
                    disabled={false}
                    onRemove={() => setRows(rows().filter((item) => item.id !== row.id))}
                  />
                  <button class="queue-track">
                    <span class="queue-track-description">
                      <strong>{row.title}</strong>
                      <small>Fictional artist</small>
                    </span>
                    <span class="queue-track-state" />
                  </button>
                </li>
              )}
            </For>
          </ol>
          <output aria-label="Remaining">{rows().length}</output>
          <output aria-label="Starts">{starts()}</output>
        </div>
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      buttons = canvas.getAllByRole("button", {
        name: "Retirer First Track de la liste de lecture",
      });
    expect(buttons[0]!.getBoundingClientRect().width).toBe(24);
    expect(getComputedStyle(buttons[0]!).borderWidth).toBe("0px");
    await userEvent.click(buttons[0]!);
    expect(
      canvas.getAllByRole("button", { name: "Retirer First Track de la liste de lecture" }),
    ).toHaveLength(1);
    expect(canvas.getByLabelText("Remaining")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Starts")).toHaveTextContent("0");
  },
};
export const Disabled: Story = { args: { disabled: true } };
