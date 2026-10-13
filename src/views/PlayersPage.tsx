import { createDiagnosticRead } from "../library/diagnostic-read";
import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { PageLoader } from "../components/PageLoader";
import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { discoverPlayers, isNative } from "../platform/desktop";
import { parsePlayers } from "../library/players";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
/** OS-mounted destinations are discovered independently from Aède's local or remote library. */
export function PlayersPage() {
  const [selected, setSelected] = createSignal("");
  const read = createDiagnosticRead(
    () => (isNative() ? { native: true } : false),
    async () => parsePlayers(await discoverPlayers()),
  );
  const volumes = read.current;
  return (
    <section class="page result-page players-page">
      <StickyHeader>
        <div class="page-heading">
          <span>{t("Lecteurs, cartes et volumes montés")}</span>
          <RefreshButton
            busy={read.loading()}
            disabled={!isNative() || (read.pending() && !read.loading())}
            onCancel={read.cancel}
            onRefresh={read.refetch}
          />
        </div>
      </StickyHeader>
      <p class="muted">
        {t(
          "Branchez et montez le lecteur dans votre système, puis actualisez. Les partages réseau montés apparaissent aussi.",
        )}
      </p>
      <Show when={read.loading() && !volumes()}>
        <PageLoader inline label={t("Détection des lecteurs…")} />
      </Show>
      <Show when={read.error()}>
        <p role="alert">{String(read.error())}</p>
      </Show>
      <Show when={!read.loading() && !read.error() && !volumes()?.length}>
        <EmptyState icon="drive">{t("Aucun lecteur monté détecté.")}</EmptyState>
      </Show>
      <ul class="personal-list">
        <For each={volumes()}>
          {(volume) => (
            <li>
              <Icon name="drive" />
              <div>
                <strong>{volume.name}</strong>
                <small>
                  {volume.path} · {volume.format} ·{" "}
                  {volume.kind === "network"
                    ? t("Réseau")
                    : volume.kind === "removable"
                      ? t("Amovible")
                      : t("Volume monté")}
                </small>
              </div>
              <button
                aria-pressed={selected() === volume.path}
                onClick={() => setSelected(volume.path)}
              >
                {t("Sélectionner")}
              </button>
            </li>
          )}
        </For>
      </ul>
      <Show when={volumes()?.some((row) => row.path === selected())}>
        <p class="notice">{t("Destination sélectionnée : {0}", selected())}</p>
      </Show>
      <p class="muted">
        {t(
          "La détection est connectée. Le transfert avec vérification et conversion reste à raccorder ; aucune copie n’est lancée ici.",
        )}
      </p>
    </section>
  );
}
