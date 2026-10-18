import { createResource, For } from "solid-js";
import { externalServices, dependencyCredits } from "../library/external-credits";
import { getRuntimeInfo, openExternalLink } from "../platform/desktop";
import { createSignal } from "solid-js";
import { ProductVersions } from "../components/ProductVersions";
import { Feedback } from "../components/Feedback";
import { t } from "../i18n";
/** Report only the app and its embedded components; account/server connections add no rows. */
export function SettingsAbout() {
  const [runtime] = createResource(getRuntimeInfo),
    [error, setError] = createSignal("");
  const open = (url: string) =>
    void openExternalLink(url).catch((failure) => setError(String(failure)));
  return (
    <div class="settings-credits">
      <section class="settings-card">
        <h2>{t("À propos")}</h2>
        <ProductVersions
          rows={[
            {
              name: "Phémios",
              version: runtime()?.version ?? "—",
            },
            {
              name: "Aède",
              version: runtime()?.embedded?.aede ?? "—",
              url: "https://craft-and-code.github.io/aede/",
            },
            {
              name: "FlacCompagnon Core",
              version: runtime()?.embedded?.flaccompagnon ?? "—",
              url: "https://craft-and-code.github.io/FlacCompagnon/",
            },
          ]}
          onOpen={open}
        />
        <Feedback error message={error() || String(runtime.error ?? "")} />
      </section>
      <section class="settings-card">
        <h2>{t("Services externes")}</h2>
        <ProductVersions
          rows={externalServices.map((row) => ({ ...row, version: "" }))}
          onOpen={open}
        />
      </section>
      <section class="settings-card">
        <h2>{t("Ressources graphiques")}</h2>
        <ProductVersions
          rows={[
            { name: "Lucide · piano", version: "SVG · ISC", url: "https://lucide.dev/icons/piano" },
          ]}
          onOpen={open}
        />
      </section>
      <section class="settings-card">
        <h2>{t("Bibliothèques externes")}</h2>
        <p class="muted">
          {t(
            "Versions verrouillées à la compilation. Les composants Rust peuvent dépendre de la plateforme.",
          )}
        </p>
        <For each={["npm", "cargo"]}>
          {(ecosystem) => (
            <details>
              <summary>
                {ecosystem === "npm" ? "JavaScript / TypeScript" : "Rust"} ·{" "}
                {dependencyCredits.filter((row) => row.ecosystem === ecosystem).length}
              </summary>
              <ProductVersions
                rows={dependencyCredits.filter((row) => row.ecosystem === ecosystem)}
                onOpen={open}
              />
            </details>
          )}
        </For>
      </section>
    </div>
  );
}
