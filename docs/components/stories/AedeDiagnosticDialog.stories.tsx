import { onCleanup, Show } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AedeDiagnosticDialog } from "../../../src/components/AedeDiagnosticDialog";
import { Feedback } from "../../../src/components/Feedback";
import { aedeDiagnostics } from "../../../src/library/aede-diagnostics";
import { t } from "../../../src/i18n";

const message =
  "Les données personnelles ne peuvent pas être lues par Aède. Vérifiez la compatibilité de sa version.";
function ErrorExample() {
  aedeDiagnostics.owner("local", "fictional-ticket");
  aedeDiagnostics.failure(
    "local",
    "fictional-ticket",
    "GET",
    "/api/me/v1/preferences",
    `${message} SECRET /private/library`,
  );
  onCleanup(() => aedeDiagnostics.owner("local"));
  return (
    <>
      <Feedback error persistent message={t(message)} />
      <Show when={aedeDiagnostics.opened()}>
        <AedeDiagnosticDialog rows={aedeDiagnostics.rows()} onClose={aedeDiagnostics.close} />
      </Show>
    </>
  );
}
const meta = {
  title: "Status/AedeDiagnosticDialog",
  component: AedeDiagnosticDialog,
  args: { rows: [], onClose: () => {} },
  render: () => <ErrorExample />,
} satisfies Meta<typeof AedeDiagnosticDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FromErrorMessage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("Voir le diagnostic") }));
    const dialog = canvas.getByRole("dialog", { name: t("Diagnostic Aède") });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent("GET /api/me/v1/preferences");
    expect(dialog).toHaveTextContent(t("Données personnelles illisibles"));
    expect(dialog).not.toHaveTextContent("SECRET");
    expect(dialog).not.toHaveTextContent("/private/library");
    await userEvent.click(within(dialog).getByRole("button", { name: t("Fermer le diagnostic") }));
    expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
