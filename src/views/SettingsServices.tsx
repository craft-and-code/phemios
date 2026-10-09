import { createToolPreferences } from "../library/tool-preferences";
import { t } from "../i18n";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { localStatus, saveLocalKeys, requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import { sourceLabel } from "../library/sources";
import { startEnrichment } from "../library/enrichment";
import { Icon } from "../components/Icon";
/** One private native key store serves explicit jobs on either library; no automatic enrichment. */
export function SettingsServices() {
  const prefs = createToolPreferences();
  const summaries = () => prefs.value().summaries,
    covers = () => prefs.value().covers,
    fanartPass = () => prefs.value().fanart,
    lyrics = () => prefs.value().lyrics,
    excluded = () => prefs.value().excluded;
  const setSummaries = (summaries: boolean) => prefs.update({ summaries }),
    setCovers = (covers: boolean) => prefs.update({ covers }),
    setFanartPass = (fanart: boolean) => prefs.update({ fanart }),
    setLyrics = (lyrics: boolean) => prefs.update({ lyrics });
  const setExcluded = (update: (held: ("local" | "server")[]) => ("local" | "server")[]) =>
    prefs.update({ excluded: update(excluded()) });
  const library = useLibrary(),
    [fanart, setFanart] = createSignal(""),
    [acoustid, setAcoustid] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  const [status, { refetch }] = createResource(() => !library.demo, localStatus);
  const targets = createMemo(() =>
    (["local", "server"] as const).filter((source) => {
      const session = source === "local" ? library.localSession() : library.serverSession();
      return session?.account.role === "admin" && session.server.startsWith("http://");
    }),
  );
  async function save(remove?: "fanart" | "acoustid") {
    const activateFanart = !remove && !!fanart().trim();
    setBusy(true);
    setMessage("");
    try {
      await saveLocalKeys(
        remove ? "" : fanart(),
        remove ? "" : acoustid(),
        remove === "fanart",
        remove === "acoustid",
      );
      if (!remove || remove === "fanart") setFanart("");
      if (!remove || remove === "acoustid") setAcoustid("");
      await refetch();
      if (activateFanart) setFanartPass(true);
      if (remove === "fanart") setFanartPass(false);
      setMessage(
        t("Clés communes enregistrées. Elles s’appliquent aux prochains enrichissements."),
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="settings-card">
      <h2>{t("Sources externes")}</h2>
      <p>
        {t(
          "Une seule configuration pour vos bibliothèques. Les clés restent dans les données privées de Phémios et sont transmises uniquement lorsque vous lancez un enrichissement. La configuration propre du serveur est conservée.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div class="service-key">
          <div class="service-key-header">
            <label for="fanart-key">
              {t("Fanart.tv ·")} {status()?.keys.fanart ? t("configurée") : t("absente")}
            </label>
            <button
              type="button"
              class="icon-button quiet"
              aria-label={t("Supprimer la clé Fanart.tv")}
              title={t("Supprimer la clé Fanart.tv")}
              disabled={busy() || library.demo || !status()?.keys.fanart}
              onClick={() => void save("fanart")}
            >
              <Icon name="trash" />
            </button>
          </div>
          <input
            id="fanart-key"
            type="password"
            autocomplete="off"
            value={fanart()}
            onInput={(event) => setFanart(event.currentTarget.value)}
          />
        </div>
        <div class="service-key">
          <div class="service-key-header">
            <label for="acoustid-key">
              {t("AcoustID ·")} {status()?.keys.acoustid ? t("configurée") : t("absente")}
            </label>
            <button
              type="button"
              class="icon-button quiet"
              aria-label={t("Supprimer la clé AcoustID")}
              title={t("Supprimer la clé AcoustID")}
              disabled={busy() || library.demo || !status()?.keys.acoustid}
              onClick={() => void save("acoustid")}
            >
              <Icon name="trash" />
            </button>
          </div>
          <input
            id="acoustid-key"
            type="password"
            autocomplete="off"
            value={acoustid()}
            onInput={(event) => setAcoustid(event.currentTarget.value)}
          />
        </div>
        <button disabled={busy() || library.demo}>{t("Enregistrer les clés communes")}</button>
        <small>{t("Un champ vide conserve la clé existante.")}</small>
      </form>
      <p class="muted">
        {t(
          "MusicBrainz, Cover Art Archive, Wikipédia et Wikidata ne demandent pas de clé API pour les passes utilisées par Aède.",
        )}
      </p>
      <h3>{t("Enrichir la bibliothèque")}</h3>
      <small>{t("Les options sont enregistrées automatiquement.")}</small>
      <Show when={prefs.error()}>
        <p role="alert">{prefs.error()}</p>
      </Show>
      <Show when={library.origins().length > 1}>
        <div class="service-targets" aria-label={t("Bibliothèques à enrichir")}>
          <For each={targets()}>
            {(source) => (
              <label class="check">
                <input
                  type="checkbox"
                  checked={!excluded().includes(source)}
                  onChange={(event) =>
                    setExcluded((held) =>
                      event.currentTarget.checked
                        ? held.filter((s) => s !== source)
                        : [...held, source],
                    )
                  }
                />
                {sourceLabel(source)}
              </label>
            )}
          </For>
        </div>
      </Show>
      <div class="settings-actions">
        <label class="check">
          <input
            type="checkbox"
            checked={summaries()}
            onChange={(e) => setSummaries(e.currentTarget.checked)}
          />
          {t("Biographies")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={covers()}
            onChange={(e) => setCovers(e.currentTarget.checked)}
          />
          {t("Pochettes")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={fanartPass()}
            onChange={(e) => setFanartPass(e.currentTarget.checked)}
          />
          {t("Fanart.tv")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={lyrics()}
            onChange={(e) => setLyrics(e.currentTarget.checked)}
          />
          {t("Paroles")}
        </label>
      </div>
      <button
        disabled={
          busy() ||
          !targets().some((s) => !excluded().includes(s)) ||
          ![summaries(), covers(), fanartPass(), lyrics()].some(Boolean)
        }
        onClick={async () => {
          setBusy(true);
          setMessage("");
          const options = {
            summaries: summaries(),
            covers: covers(),
            images: covers(),
            fanart: fanartPass(),
            lyrics: lyrics(),
            yes: true,
          };
          try {
            const results = await startEnrichment(
              targets().filter((s) => !excluded().includes(s)),
              (source) => requestAede("/api/admin/v1/fetch", {}, "POST", options, source),
            );
            setMessage(
              results
                .map((result) =>
                  "error" in result
                    ? `${sourceLabel(result.source)} · ${result.error}`
                    : t("Tâche #{0} lancée sur {1}.", result.task, sourceLabel(result.source)),
                )
                .join("\n"),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("Lancer l’enrichissement")}
      </button>
      <p class="muted">
        {t(
          "Cette action contacte les services externes. Aucun enrichissement n’est lancé en ouvrant la bibliothèque ou les Paramètres.",
        )}
      </p>
      <Show
        when={
          !targets().length ||
          [library.localSession(), library.serverSession()].some(
            (session) =>
              session &&
              (session.account.role !== "admin" || session.server.startsWith("https://")),
          )
        }
      >
        <p class="notice">
          {t(
            "Un administrateur Aède HTTP local est nécessaire pour lancer une tâche. Sur un serveur HTTPS, utilisez la commande fetch du serveur.",
          )}
        </p>
      </Show>
      <p class="service-status" role="status">
        {message()}
      </p>
    </div>
  );
}
