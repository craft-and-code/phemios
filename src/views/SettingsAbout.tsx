import { createResource, For } from "solid-js";
import { getRuntimeInfo, openExternalLink, requestAede } from "../platform/desktop";
import { createSignal } from "solid-js";
import { useLibrary } from "../library/context";
import { engineVersions } from "../library/product-versions";
import { ProductVersions } from "../components/ProductVersions";
import { Feedback } from "../components/Feedback";
import { sourceLabel, type SourceId } from "../library/sources";
import { t } from "../i18n";
/** Display reported component versions, keeping local and remote engine identities distinct. */
export function SettingsAbout() {
  const library = useLibrary(),
    [runtime] = createResource(getRuntimeInfo),
    [error, setError] = createSignal("");
  const sources = () =>
    (["local", "server"] as const).filter(
      (source) => !!(source === "local" ? library.localSession() : library.serverSession()),
    );
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
            url: "https://craft-and-code.github.io/phemios/",
          },
        ]}
        onOpen={open}
      />
      <For each={sources().length ? sources() : [undefined]}>
        {(source) => <EngineVersion source={source} onOpen={open} />}
      </For>
      <Feedback error message={error() || String(runtime.error ?? "")} />
    </section>
  );
}
function EngineVersion(props: { source: SourceId | undefined; onOpen: (url: string) => void }) {
  const library = useLibrary();
  const [versions] = createResource(
    () => {
      const source = props.source;
      if (!source) return false;
      const owner = source === "local" ? library.localSession() : library.serverSession();
      return owner ? { source, owner } : false;
    },
    async (key) =>
      engineVersions(
        (
          await requestAede<{ versions?: unknown }>(
            "/api/v1/status",
            {},
            "GET",
            null,
            key.source,
            key.owner,
          )
        ).versions,
      ),
  );
  const suffix = () => (props.source ? ` · ${sourceLabel(props.source)}` : "");
  const unknown = () => (props.source ? t("Version non communiquée") : t("Moteur non connecté"));
  return (
    <>
      <ProductVersions
        rows={[
          {
            name: `Aède${suffix()}`,
            version: versions()?.aede ?? unknown(),
            url: "https://craft-and-code.github.io/aede/",
          },
          {
            name: `FlacCompagnon Core${suffix()}`,
            version: versions()?.flaccompagnon ?? unknown(),
            url: "https://craft-and-code.github.io/FlacCompagnon/",
          },
        ]}
        onOpen={props.onOpen}
      />
      <Feedback error message={String(versions.error ?? "")} />
    </>
  );
}
