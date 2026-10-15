import type { ParentalPolicy } from "../../../src/library/parental-controls";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createMemo, createSignal, Show } from "solid-js";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import {
  defaultParentalPolicy,
  parseParentalPolicy,
  parentalPolicyStamp,
} from "../../../src/library/parental-controls";
import { ParentalPolicyForm } from "../../../src/components/ParentalPolicyForm";
import { Feedback } from "../../../src/components/Feedback";
function Demo(props: { busy: boolean; local: boolean; readOnly?: boolean }) {
  const initial: ParentalPolicy = {
    ...defaultParentalPolicy("Europe/Paris"),
    enabled: true,
    days: Array.from({ length: 7 }, () => ({
      windows: [{ start_minute: 1020, end_minute: 1200 }],
      limit_seconds: 3600,
    })),
    week_limit_seconds: 18000,
  };
  const [policy, setPolicy] = createSignal(initial),
    [saved, setSaved] = createSignal(initial),
    [error, setError] = createSignal("");
  const source = () => (props.local ? ("local" as const) : ("server" as const));
  const artists = createMemo(() =>
    ["Northern Ensemble", "Été", "Other-source Group"].map((name, i) => ({
      reference: `artist:@phemios/${i === 2 ? (props.local ? "server" : "local") : source()}/${i}`,
      name,
      genre: "Rock",
      country: "Example",
      biography: "",
      artwork: false,
      searchFields: ["11111111-2222-4333-8444-b13900000000"],
    })),
  );
  const albums = createMemo(() =>
    artists().map((artist, index) => ({
      reference: artist.reference.replace("artist:", "release:"),
      title: `Album ${index}`,
      artist: artist.reference,
      year: 2000,
      compilation: false,
      tags: [],
    })),
  );
  return (
    <section class="settings-page">
      <div class="settings-card settings-parental">
        <h2>Contrôle parental · Example account</h2>
        <ParentalPolicyForm
          policy={policy()}
          source={source()}
          artists={artists()}
          albums={albums()}
          image={() => undefined}
          busy={props.busy}
          readOnly={props.readOnly ?? false}
          dirty={parentalPolicyStamp(policy()) !== parentalPolicyStamp(saved())}
          onChange={setPolicy}
          onReset={() => setPolicy(saved())}
          onSave={() => {
            try {
              const value = parseParentalPolicy(policy());
              setSaved(value);
              setError("");
            } catch (failure) {
              setError(String(failure));
            }
          }}
        />
        <Feedback error message={error()} />
        <output aria-label="Saved policy">{JSON.stringify(saved())}</output>
        <Show when={props.busy}>
          <span role="status">Saving</span>
        </Show>
      </div>
    </section>
  );
}
const meta = {
  title: "Settings/ParentalControls",
  component: Demo,
  args: { busy: false, local: false },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ConfigureAccount: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText("Other-source Group")).toBeNull();
    await userEvent.click(canvas.getByLabelText("Masquer Northern Ensemble"));
    expect(canvas.getByLabelText("Masquer Northern Ensemble")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(canvas.getByRole("button", { name: "Rendre visible Northern Ensemble" })).toBeEnabled();
    await userEvent.type(canvas.getByRole("searchbox"), "ete");
    expect(canvas.getByLabelText("Masquer Été")).toBeVisible();
    expect(canvas.queryByLabelText("Masquer Northern Ensemble")).toBeNull();
    await userEvent.clear(canvas.getByRole("searchbox"));
    await userEvent.type(canvas.getByRole("searchbox"), "13");
    expect(canvas.getByText("Aucun résultat dans cette sélection.")).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Autoriser les radios Internet" }));
    fireEvent.input(canvas.getByRole("spinbutton", { name: "Maximum par semaine" }), {
      target: { value: "0" },
    });
    fireEvent.change(canvas.getByLabelText("Début · Lundi · 1"), { target: { value: "18:00" } });
    await userEvent.click(
      canvas.getByRole("button", { name: "Supprimer la plage · Dimanche · 1" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Flux RSS à masquer" }),
      "https://example.invalid/blocked.xml",
    );
    await userEvent.keyboard("{Enter}");
    expect(canvas.getByText("https://example.invalid/blocked.xml", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Enregistrer" }));
    const value = JSON.parse(canvas.getByLabelText("Saved policy").textContent!);
    expect(value.blocked_artists).toEqual(["artist:0"]);
    expect(value.radio_allowed).toBe(false);
    expect(value.week_limit_seconds).toBe(0);
    expect(value.days[0].windows[0].start_minute).toBe(1080);
    expect(value.days[6].windows).toEqual([]);
    expect(value.blocked_podcasts).toEqual(["https://example.invalid/blocked.xml"]);
    expect(canvas.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  },
};
export const LocalIdentity: Story = { ...ConfigureAccount, args: { local: true } };
export const Saving: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByRole("checkbox", { name: "Activer le contrôle parental pour ce compte" }),
    ).toBeDisabled();
    expect(canvas.getByLabelText("Masquer Northern Ensemble")).toBeDisabled();
    expect(canvas.getByRole("button", { name: "Enregistrer" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(canvas.getByRole("button", { name: "Annuler les modifications" })).toBeDisabled();
  },
};
export const ClosedAndUnlimited: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Supprimer la plage · Lundi · 1" }));
    await userEvent.click(canvas.getByRole("button", { name: "Ajouter une plage · Lundi" }));
    fireEvent.change(canvas.getByLabelText("Fin · Lundi · 1"), { target: { value: "00:00" } });
    fireEvent.input(canvas.getByRole("spinbutton", { name: "Maximum · Lundi" }), {
      target: { value: "" },
    });
    await userEvent.click(canvas.getByRole("button", { name: "Enregistrer" }));
    const value = JSON.parse(canvas.getByLabelText("Saved policy").textContent!);
    expect(value.days[0].windows).toEqual([{ start_minute: 480, end_minute: 1440 }]);
    expect(value.days[0].limit_seconds).toBeNull();
  },
};

export const LockedByAnotherAdministrator: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const control of canvasElement.querySelectorAll("input, button, select"))
      expect(control).toBeDisabled();
    expect(canvas.queryByRole("status", { name: "Saving" })).toBeNull();
    expect(canvas.getByRole("checkbox", { name: "Autoriser les podcasts" })).toBeChecked();
  },
};
