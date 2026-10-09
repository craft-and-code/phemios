import { createSignal, For, Show } from "solid-js";
import { SettingsLibraries } from "./SettingsLibraries";
import { SettingsAccounts } from "./SettingsAccounts";
import { SettingsServices } from "./SettingsServices";
import { SettingsAppearance } from "./SettingsAppearance";
import { useLibrary } from "../library/context";
import { sourceLabel } from "../library/sources";
export function SettingsPage() {
  const [tab, setTab] = createSignal("libraries"),
    library = useLibrary();
  return (
    <section class="page settings-page">
      <div class="choices settings-tabs" aria-label="Paramètres">
        <For
          each={[
            { id: "libraries", label: "Bibliothèques" },
            { id: "accounts", label: "Comptes" },
            { id: "services", label: "Sources externes" },
            { id: "appearance", label: "Apparence" },
          ]}
        >
          {(item) => (
            <button aria-pressed={tab() === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          )}
        </For>
      </div>
      <Show when={["accounts", "services"].includes(tab())}>
        <div class="choices" aria-label="Bibliothèque à administrer">
          <For each={["local", "server"] as const}>
            {(source) => (
              <button
                aria-pressed={library.source() === source}
                onClick={() => library.chooseSource(source)}
              >
                {sourceLabel(source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={tab() === "libraries"}>
        <SettingsLibraries />
      </Show>
      <Show when={tab() === "accounts"}>
        <SettingsAccounts />
      </Show>
      <Show when={tab() === "services"}>
        <SettingsServices />
      </Show>
      <Show when={tab() === "appearance"}>
        <SettingsAppearance />
      </Show>
    </section>
  );
}
