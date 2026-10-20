import { errorMessage, isAedeConnectionError } from "../library/aede-availability";
import { completeServiceKeySave } from "../library/service-key-save";
import { interfaceProfileIdentity } from "../library/account-preferences";
import { createServiceCancellation } from "../library/service-cancellation";
import { SettingsJamBase } from "./SettingsJamBase";
import { Feedback } from "../components/Feedback";
import { createToolPreferences } from "../library/tool-preferences";
import { t } from "../i18n";
import { createMemo, createResource, createSignal, onCleanup, For, Show } from "solid-js";
import { localStatus, saveLocalKeys } from "../platform/desktop";
import { useLibrary } from "../library/context";
import type { SourceId } from "../library/sources";
import { sourceLabel } from "../library/sources";
import { hasActiveEnrichment, visibleEnrichmentJobs } from "../library/enrichment";
import { ActionButton } from "../components/ActionButton";
import { Icon } from "../components/Icon";
/** One private native key store serves explicit jobs on either library; no automatic enrichment. */
export function SettingsServices() {
  const prefs = createToolPreferences();
  const summaries = () => prefs.value().summaries,
    covers = () => prefs.value().covers,
    fanartPass = () => prefs.value().fanart,
    lyrics = () => prefs.value().lyrics,
    discogs = () => prefs.value().discogs,
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
    [busy, setBusy] = createSignal(false),
    [failure, setFailure] = createSignal(false),
    [retrying, setRetrying] = createSignal<SourceId>();
  const cancellation = createServiceCancellation({
    session: (source) => (source === "local" ? library.localSession() : library.serverSession()),
    cancel: library.tasks.cancel,
  });
  const launching = library.tasks.enrichmentPending;
  const enrichmentActive = () => hasActiveEnrichment(library.tasks.jobs());
  const recentJobs = createMemo(() => visibleEnrichmentJobs(library.tasks.jobs()));
  const [status, { refetch }] = createResource(() => !library.demo, localStatus);
  const targets = createMemo(() =>
    (["local", "server"] as const).filter((source) => {
      const session = source === "local" ? library.localSession() : library.serverSession();
      return session?.account.role === "admin";
    }),
  );
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  async function save(remove?: "fanart" | "acoustid") {
    if (busy()) return;
    const held = interfaceProfileIdentity(),
      current = () => alive && interfaceProfileIdentity() === held,
      fanartKey = fanart(),
      acoustidKey = acoustid(),
      activateFanart = !remove && !!fanartKey.trim();
    setBusy(true);
    setMessage("");
    setFailure(false);
    try {
      await completeServiceKeySave({
        current,
        save: () =>
          saveLocalKeys(
            remove ? "" : fanartKey,
            remove ? "" : acoustidKey,
            remove === "fanart",
            remove === "acoustid",
          ),
        refresh: async () => refetch(),
        commit: () => {
          if ((!remove || remove === "fanart") && fanart() === fanartKey) setFanart("");
          if ((!remove || remove === "acoustid") && acoustid() === acoustidKey) setAcoustid("");
          if (activateFanart) setFanartPass(true);
          if (remove === "fanart") setFanartPass(false);
          setMessage(
            t("Clés communes enregistrées. Elles s’appliquent aux prochains enrichissements."),
          );
        },
      });
    } catch (error) {
      if (current()) {
        setFailure(true);
        setMessage(String(error));
      }
    } finally {
      if (alive) setBusy(false);
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
          "MusicBrainz, Cover Art Archive, Wikipédia, Wikidata et Discogs ne demandent pas de clé API pour les passes utilisées par Aède.",
        )}
      </p>
      <p class="muted">
        {t(
          "Discogs fournit les biographies des labels sans article Wikipédia, à partir de leur lien MusicBrainz. La récupération est lancée uniquement avec l’enrichissement.",
        )}
      </p>
      <SettingsJamBase />
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
          {t("Fanart.tv · bannières et arrière-plans")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={lyrics()}
            onChange={(e) => setLyrics(e.currentTarget.checked)}
          />
          {t("Paroles")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={discogs()}
            onChange={(e) => prefs.update({ discogs: e.currentTarget.checked })}
          />
          {t("Discogs · biographies des labels")}
        </label>
      </div>
      <div class="enrichment-actions">
        <ActionButton
          icon="refresh"
          busy={launching() || enrichmentActive()}
          disabled={
            busy() ||
            launching() ||
            enrichmentActive() ||
            !targets().some((s) => !excluded().includes(s)) ||
            ![summaries(), covers(), fanartPass(), lyrics(), discogs()].some(Boolean)
          }
          onClick={async () => {
            if (busy() || launching() || enrichmentActive()) return;
            setMessage("");
            setFailure(false);
            const options = {
              musicbrainz: true,
              summaries: summaries(),
              covers: covers(),
              images: covers(),
              fanart: fanartPass(),
              lyrics: lyrics(),
              labels: discogs(),
              discogs: discogs(),
              yes: true,
            };
            try {
              const results = await library.tasks.enrich(
                targets().filter((s) => !excluded().includes(s)),
                options,
              );
              if (!results) return;
              setFailure(results.some((result) => "error" in result));
              setMessage(
                results
                  .map((result) =>
                    "error" in result
                      ? `${sourceLabel(result.source)} · ${result.error}`
                      : t("Tâche #{0} lancée sur {1}.", result.task, sourceLabel(result.source)),
                  )
                  .join("\n"),
              );
            } catch (error) {
              setFailure(true);
              setMessage(String(error));
            }
          }}
        >
          {t("Lancer l’enrichissement")}
        </ActionButton>
        <ActionButton
          icon="stop"
          busy={cancellation.pending()}
          disabled={!enrichmentActive() || cancellation.pending()}
          onClick={() => void cancellation.stopEnrichment(library.tasks.jobs())}
        >
          {t("Arrêter l’enrichissement")}
        </ActionButton>
      </div>
      <p class="muted">
        {t(
          "MusicBrainz identifie d’abord les nouveaux artistes et albums, puis les services sélectionnés complètent leurs données. Les bannières et arrière-plans nécessitent Fanart.tv et sa clé API. Les correspondances incertaines doivent être validées dans Aède.",
        )}
      </p>
      <p class="muted">
        {t(
          "Une biographie nécessite une identité validée et un lien Wikidata fourni par MusicBrainz. Sans identifiant dans les fichiers, les correspondances proposées doivent être validées dans Aède. Trouver un nom dans l’Encyclopédie ne suffit pas ; Picard est une possibilité, pas une obligation.",
        )}
      </p>
      <Show
        when={
          !targets().length ||
          [library.localSession(), library.serverSession()].some(
            (session) => session && session.account.role !== "admin",
          )
        }
      >
        <p class="notice">{t("Connectez un compte administrateur Aède pour lancer une tâche.")}</p>
      </Show>
      <Feedback error message={library.tasks.error()} />
      <Feedback error message={cancellation.error()} onClose={cancellation.clear} />
      <Show when={recentJobs().length}>
        <div class="enrichment-jobs">
          <For each={recentJobs()}>
            {(job) => (
              <section class="enrichment-job">
                <div class="page-heading">
                  <strong>
                    {t("Tâche #{0}", job.task_id)} · {sourceLabel(job.source ?? "server")}
                  </strong>
                  <Show when={job.tracking_error}>
                    <button
                      class="icon-button quiet"
                      title={t("Réessayer")}
                      aria-label={t("Réessayer")}
                      disabled={!!retrying()}
                      onClick={async () => {
                        if (retrying()) return;
                        const source = job.source ?? "server";
                        setRetrying(source);
                        try {
                          await library.tasks.restore(source);
                        } finally {
                          setRetrying(undefined);
                        }
                      }}
                    >
                      <Show
                        when={retrying() === (job.source ?? "server")}
                        fallback={<Icon name="refresh" />}
                      >
                        <span class="spinner" aria-hidden="true" />
                      </Show>
                    </button>
                  </Show>
                  <Show when={!job.tracking_error && ["queued", "running"].includes(job.status)}>
                    <span
                      class="spinner"
                      role="status"
                      aria-label={t("Enrichissement en cours…")}
                    />
                    <button
                      class="icon-button quiet"
                      title={t("Annuler la tâche")}
                      aria-label={t("Annuler la tâche")}
                      disabled={cancellation.pendingJob(job.task_id, job.source ?? "server")}
                      onClick={() => void cancellation.cancel(job.task_id, job.source ?? "server")}
                    >
                      <Icon name="close" />
                    </button>
                  </Show>
                </div>
                <p>
                  {(job.tracking_error
                    ? isAedeConnectionError(job.tracking_error)
                      ? t("Suivi de tâche interrompu.")
                      : errorMessage(job.tracking_error)
                    : undefined) ??
                    {
                      queued: t("En attente"),
                      running: t("Enrichissement en cours…"),
                      completed: t("Enrichissement terminé."),
                      failed: t(
                        "Enrichissement partiel ou en échec ; les données enregistrées sont conservées.",
                      ),
                      cancelled: t("Tâche annulée ; les données enregistrées sont conservées."),
                    }[job.status]}
                </p>
                <Show when={job.result || job.error}>
                  <details>
                    <summary>{t("Résultats et diagnostics")}</summary>
                    <pre>
                      {[job.result?.stdout, job.result?.stderr, job.error?.message]
                        .filter(Boolean)
                        .join("\n")}
                    </pre>
                  </details>
                </Show>
              </section>
            )}
          </For>
        </div>
      </Show>
      <Feedback error={failure()} message={message()} />
    </div>
  );
}
