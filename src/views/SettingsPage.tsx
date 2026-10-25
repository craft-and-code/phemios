import { useLibrary } from "../library/context";
import type { createCollectionMenuChoices } from "../library/collection-menu-choices";
import { SettingsParental } from "./SettingsParental";
import { SettingsAbout } from "./SettingsAbout";
import { SettingsAede } from "./SettingsAede";
import { SettingsImports } from "./SettingsImports";
import { SettingsBackup } from "./SettingsBackup";
import { SettingsShortcuts } from "./SettingsShortcuts";
import { Feedback } from "../components/Feedback";
import { SettingsPlayback } from "./SettingsPlayback";
import { SettingsLanguage } from "./SettingsLanguage";
import { SettingsNavigation } from "./SettingsNavigation";
import type { createMenuPreferences } from "../navigation/menu-preferences";
import { SettingsTags } from "./SettingsTags";
import { t } from "../i18n";
import { createEffect, untrack, createSignal, For, Show } from "solid-js";
import { SettingsLibraries } from "./SettingsLibraries";
import { SettingsAccounts } from "./SettingsAccounts";
import { SettingsServices } from "./SettingsServices";
import { SettingsAppearance } from "./SettingsAppearance";
import { Icon } from "../components/Icon";
export function SettingsPage(props: {
  menu: ReturnType<typeof createMenuPreferences>;
  tab?: string;
  collectionChoices?: ReturnType<typeof createCollectionMenuChoices> | undefined;
}) {
  const library = useLibrary();
  const [tab, setTab] = createSignal(props.tab ?? "libraries");
  createEffect(() => {
    if (tab() === "navigation") untrack(() => void props.collectionChoices?.refresh());
  });
  const tabs = [
    { icon: "library", id: "libraries", label: t("Bibliothèques") },
    { icon: "users", id: "accounts", label: t("Comptes") },
    { icon: "lock", id: "parental", label: t("Contrôle parental") },
    { icon: "globe", id: "services", label: t("Sources externes") },
    { icon: "terminal", id: "aede", label: "Aède" },
    { icon: "volume", id: "playback", label: t("Lecture") },
    { icon: "tags", id: "tags", label: t("Tags") },
    { icon: "alphabet", id: "language", label: t("Langue") },
    { icon: "palette", id: "appearance", label: t("Couleurs et thèmes") },
    { icon: "menu", id: "navigation", label: t("Navigation") },
    { icon: "keyboard", id: "shortcuts", label: t("Raccourcis") },
    { icon: "download", id: "backup", label: t("Sauvegarde") },
    { icon: "upload", id: "imports", label: t("Imports") },
    { icon: "help", id: "about", label: t("À propos") },
  ];
  return (
    <section class="page settings-page">
      <div
        class="settings-tabs"
        role="tablist"
        aria-orientation="horizontal"
        aria-label={t("Paramètres")}
        onKeyDown={(event) => {
          const ids = tabs.map((item) => item.id),
            index = ids.indexOf(tab());
          const next = ["ArrowRight", "ArrowDown"].includes(event.key)
            ? (index + 1) % ids.length
            : ["ArrowLeft", "ArrowUp"].includes(event.key)
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
        <For each={tabs}>
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
        <Show when={tab() === "libraries"}>
          <SettingsLibraries />
        </Show>
        <Show when={tab() === "accounts"}>
          <SettingsAccounts />
        </Show>
        <Show when={tab() === "parental"}>
          <SettingsParental />
        </Show>
        <Show when={tab() === "services"}>
          <SettingsServices />
        </Show>
        <Show when={tab() === "aede"}>
          <SettingsAede />
        </Show>
        <Show when={tab() === "playback"}>
          <SettingsPlayback />
        </Show>
        <Show when={tab() === "tags"}>
          <SettingsTags />
        </Show>
        <Show when={tab() === "imports"}>
          <SettingsImports />
        </Show>
        <Show when={tab() === "backup"}>
          <SettingsBackup />
        </Show>
        <Show when={tab() === "shortcuts"}>
          <SettingsShortcuts />
        </Show>
        <Show when={tab() === "navigation"}>
          <SettingsNavigation menu={props.menu} collectionChoices={props.collectionChoices} />
        </Show>
        <Show when={tab() === "language"}>
          <SettingsLanguage />
        </Show>
        <Show when={tab() === "appearance"}>
          <SettingsAppearance />
        </Show>
        <Show when={tab() === "about"}>
          <SettingsAbout />
        </Show>
        <Feedback message={library.savedSettings.status()} />
        <Feedback error message={library.savedSettings.error()} />
      </div>
    </section>
  );
}
