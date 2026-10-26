import { t } from "../../../src/i18n";
import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { TaskRecoveryButton, type TaskRecovery } from "../../../src/components/TaskRecoveryButton";
const meta = {
  title: "Controls/TaskRecoveryButton",
  component: TaskRecoveryButton,
  args: { job: { task_id: 7, source: "server" }, active: undefined, onRefresh: () => {} },
} satisfies Meta<typeof TaskRecoveryButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SharedSource: Story = {
  render: () => {
    const [active, setActive] = createSignal<TaskRecovery>();
    return (
      <div>
        {[7, 8].map((task) => (
          <TaskRecoveryButton
            job={{ task_id: task, source: "server" }}
            active={active()}
            onRefresh={(_event, signal) => {
              setActive({ task, source: "server" });
              return new Promise<void>((done) =>
                signal.addEventListener(
                  "abort",
                  () => {
                    setActive(undefined);
                    done();
                  },
                  { once: true },
                ),
              );
            }}
          />
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      buttons = canvas.getAllByRole("button", { name: t("Réessayer") });
    await userEvent.click(buttons[0]!);
    expect(buttons[1]!).toBeDisabled();
    expect(canvasElement.querySelectorAll(".spinner")).toHaveLength(1);
    await userEvent.hover(buttons[0]!);
    expect(buttons[0]!.querySelector(".activity-stop")).not.toBeNull();
    await userEvent.click(buttons[0]!);
    expect(buttons[0]!).not.toHaveAttribute("aria-busy");
    expect(buttons[1]!).toBeEnabled();
  },
};

export const OtherSource: Story = {
  args: { job: { task_id: 7, source: "local" }, active: { source: "server", task: 7 } },
  play: ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: t("Réessayer") });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector(".spinner")).toBeNull();
  },
};
