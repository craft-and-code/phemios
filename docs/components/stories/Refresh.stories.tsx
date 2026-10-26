import { createDiagnosticRead } from "../../../src/library/diagnostic-read";
import { createSignal } from "solid-js";
import { expect, userEvent, within, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RefreshButton } from "../../../src/components/RefreshButton";
const meta = {
  title: "Controls/RefreshButton",
  component: RefreshButton,
  args: { busy: false, disabled: false, onRefresh: () => {} },
} satisfies Meta<typeof RefreshButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Cancel: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false),
      [result, setResult] = createSignal("Idle");
    return (
      <>
        <RefreshButton
          busy={busy()}
          onRefresh={() => {
            setBusy(true);
            setResult("Waiting");
          }}
          onCancel={() => {
            setBusy(false);
            setResult("Cancelled");
          }}
        />
        <output>{result()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Actualiser" });
    const before = button.getBoundingClientRect();
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-busy", "true");
    const spinner = button.querySelector(".spinner")!.getBoundingClientRect();
    expect(spinner.width).toBeGreaterThan(10);
    expect(Math.abs(spinner.width - spinner.height)).toBeLessThan(0.6);
    await userEvent.hover(button);
    expect(getComputedStyle(button.querySelector(".activity-stop")!).opacity).toBe("1");
    expect(button.getBoundingClientRect().width).toBe(before.width);
    await userEvent.click(button);
    await expect(canvas.getByText("Cancelled")).toBeVisible();
    await expect(button).not.toHaveAttribute("aria-busy");
  },
};

/** A fast read uses the same loader, with brief acknowledgement and no delayed data publication. */
export const ImmediateFeedback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    expect(button.querySelector(".spinner")).not.toBeNull();
    await userEvent.hover(button);
    expect(getComputedStyle(button.querySelector(".activity-stop")!).opacity).toBe("1");
    expect(button).toBeEnabled();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"), { timeout: 2000 });
    expect(button.querySelector(".spinner")).toBeNull();
  },
};

/** Even a completed synchronous read can stop its remaining visual acknowledgement. */
export const StopImmediateFeedback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.hover(button);
    expect(getComputedStyle(button.querySelector(".activity-stop")!).opacity).toBe("1");
    await userEvent.click(button);
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector(".spinner")).toBeNull();
  },
};

/** A retained control never adopts the preceding login's acknowledgement or pending promise. */
export const OwnerReplacement: Story = {
  render: () => {
    const [owner, setOwner] = createSignal("A"),
      [stopped, setStopped] = createSignal("");
    const finish: Array<() => void> = [];
    return (
      <>
        <RefreshButton
          identity={owner()}
          label={`Refresh ${owner()}`}
          busy={false}
          onRefresh={() => new Promise<void>((done) => finish.push(done))}
          onCancel={() => setStopped(owner())}
        />
        <button onClick={() => setOwner("B")}>Switch account</button>
        <button onClick={() => finish[0]?.()}>Finish old read</button>
        <output>{stopped()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Refresh A" }));
    await userEvent.click(canvas.getByRole("button", { name: "Switch account" }));
    const current = canvas.getByRole("button", { name: "Refresh B" });
    expect(current).not.toHaveAttribute("aria-busy");
    await userEvent.click(current);
    await userEvent.click(canvas.getByRole("button", { name: "Finish old read" }));
    expect(current).toHaveAttribute("aria-busy", "true");
    await userEvent.click(current);
    expect(canvas.getByRole("status")).toHaveTextContent("B");
    expect(current).not.toHaveAttribute("aria-busy");
  },
};

/** A cancelled dispatched read stays unavailable until the bounded transport releases it. */
export const CancelledPendingRead: Story = {
  render: () => {
    let calls = 0,
      finish: (() => void) | undefined;
    const read = createDiagnosticRead(
      () => ({ scope: "fictional" }),
      async () => {
        if (++calls > 1)
          await new Promise<void>((done) => {
            finish = done;
          });
        return "Ready";
      },
    );
    return (
      <>
        <RefreshButton
          busy={read.loading()}
          pending={read.pending()}
          onRefresh={read.refetch}
          onCancel={read.cancel}
        />
        <button onClick={() => finish?.()}>Finish transport</button>
        <output>{read.current()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Ready"));
    const button = canvas.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    await userEvent.click(canvas.getByRole("button", { name: "Arrêter" }));
    expect(button).toBeDisabled();
    expect(button.querySelector(".spinner")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Finish transport" }));
    await waitFor(() => expect(button).toBeEnabled());
  },
};

/** Completing a new query cannot leave the button waiting for the abandoned query's promise. */
export const ReplacedQuery: Story = {
  render: () => {
    const [query, setQuery] = createSignal("Old");
    let count = 0,
      finish: (() => void) | undefined;
    const read = createDiagnosticRead(
      () => ({ query: query() }),
      async ({ query }) => {
        if (query === "Old" && ++count > 1)
          await new Promise<void>((done) => {
            finish = done;
          });
        return query;
      },
    );
    return (
      <>
        <RefreshButton
          busy={read.loading()}
          pending={read.pending()}
          onRefresh={read.refetch}
          onCancel={read.cancel}
        />
        <button onClick={() => setQuery("New")}>Change query</button>
        <button onClick={() => finish?.()}>Finish old query</button>
        <output>{read.current()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Old"));
    const button = canvas.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    await userEvent.click(canvas.getByRole("button", { name: "Change query" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("New"));
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"), { timeout: 2000 });
    expect(button).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Finish old query" }));
    expect(canvas.getByRole("status")).toHaveTextContent("New");
    expect(button).not.toHaveAttribute("aria-busy");
  },
};
