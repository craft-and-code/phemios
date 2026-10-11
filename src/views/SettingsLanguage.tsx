import { Feedback } from "../components/Feedback";
import { ChoiceSelect } from "../components/ChoiceSelect";
import { createSignal, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { readPreferences, applyPreferences } from "../library/preferences";
import { announceSetting } from "../library/saved-settings";
export function SettingsLanguage() {
  const [language, setLanguage] = createSignal("fr"),
    [error, setError] = createSignal("");
  onMount(() => {
    try {
      setLanguage(readPreferences(localStorage).language);
    } catch (failure) {
      setError(String(failure));
    }
  });
  onMount(() => {
    const reload = () => {
      try {
        setLanguage(readPreferences(localStorage).language);
      } catch (failure) {
        setError(String(failure));
      }
    };
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", reload));
  });
  return (
    <section class="settings-card">
      <h2>{t("Langue")}</h2>
      <label>
        {t("Langue de l’interface")}
        <ChoiceSelect
          label={t("Langue")}
          value={language()}
          onChange={(selected) => {
            try {
              const next = {
                  ...readPreferences(localStorage),
                  language: selected as "fr" | "en",
                },
                raw = JSON.stringify(next);
              localStorage.setItem("phemios.appearance", raw);
              applyPreferences(next);
              announceSetting("phemios.appearance", raw);
              setLanguage(next.language);
              setError("");
            } catch (failure) {
              setError(String(failure));
            }
          }}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ]}
        />
      </label>
      <Feedback error message={error()} />
    </section>
  );
}
