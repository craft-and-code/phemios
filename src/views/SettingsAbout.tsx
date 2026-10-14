import { createResource } from "solid-js";
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
  );
}
