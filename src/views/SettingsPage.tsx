import { SettingsNavigation } from "./SettingsNavigation";
import type { createMenuPreferences } from "../navigation/menu-preferences";
import { SettingsTags } from "./SettingsTags";
import { t } from "../i18n";
import { createSignal, For, Show } from "solid-js";
import { SettingsLibraries } from "./SettingsLibraries";
import { SettingsAccounts } from "./SettingsAccounts";
import { SettingsServices } from "./SettingsServices";
import { SettingsAppearance } from "./SettingsAppearance";
import { useLibrary } from "../library/context";
import { Icon } from "../components/Icon";
import { sourceLabel } from "../library/sources";
export function SettingsPage(props: { menu: ReturnType<typeof createMenuPreferences> }) {
  const [tab, setTab] = createSignal("libraries"),
    library = useLibrary();
  return (
    <section class="page settings-page">
      <div
        class="settings-tabs"
        role="tablist"
        aria-label={t("Paramètres")}
        onKeyDown={(event) => {
          const ids = ["libraries", "accounts", "services", "tags", "appearance", "navigation"],
            index = ids.indexOf(tab());
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % ids.length
              : event.key === "ArrowLeft"
                ? (index + ids.length - 1) % ids.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? ids.length - 1
                    : undefined;
          if (next === undefined) return;
          event.preventDefault();
          setTab(ids[next]!);
          event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
        }}
      >
        <For
          each={[
            { icon: "library", id: "libraries", label: t("Bibliothèques") },
            { icon: "users", id: "accounts", label: t("Comptes") },
            { icon: "globe", id: "services", label: t("Sources externes") },
            { icon: "tags", id: "tags", label: t("Tags") },
            { icon: "palette", id: "appearance", label: t("Apparence") },
            { icon: "menu", id: "navigation", label: t("Navigation") },
          ]}
        >
          {(item) => (
            <button
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-selected={tab() === item.id}
              aria-controls="settings-panel"
              tabindex={tab() === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} />
              {t(item.label)}
            </button>
          )}
        </For>
      </div>
      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab()}`}>
        <Show when={tab() === "accounts" && library.origins().length > 1}>
          <div class="choices" aria-label={t("Bibliothèque à administrer")}>
            <For each={library.origins()}>
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
        <Show when={tab() === "tags"}>
          <SettingsTags />
        </Show>
        <Show when={tab() === "navigation"}>
          <SettingsNavigation menu={props.menu} />
        </Show>
        <Show when={tab() === "appearance"}>
          <SettingsAppearance />
        </Show>
      </div>
    </section>
  );
}
