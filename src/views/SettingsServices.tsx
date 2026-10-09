import { createResource, createSignal, Show } from "solid-js";
import { localStatus, saveLocalKeys, requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
/** Credentials stay native; enrichment requires an explicit user action. */
export function SettingsServices() {
  const library = useLibrary(),
    [fanart, setFanart] = createSignal(""),
    [acoustid, setAcoustid] = createSignal(""),
    [removeFanart, setRemoveFanart] = createSignal(false),
    [removeAcoustid, setRemoveAcoustid] = createSignal(false),
    [message, setMessage] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [summaries, setSummaries] = createSignal(true),
    [covers, setCovers] = createSignal(true),
    [fanartPass, setFanartPass] = createSignal(false),
    [lyrics, setLyrics] = createSignal(false);
  const [status, { refetch }] = createResource(() => !library.demo, localStatus);
  const administrative = () =>
    library.session()?.account.role === "admin" && library.session()?.server.startsWith("http://");
  return (
    <div class="settings-card">
      <h2>Sources externes</h2>
      <p>
        Les clés ci-dessous sont stockées dans les données privées de Phémios et utilisées
        uniquement par le moteur local. Les clés d’un serveur distant se configurent sur ce serveur.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await saveLocalKeys(fanart(), acoustid(), removeFanart(), removeAcoustid());
            setFanart("");
            setAcoustid("");
            setRemoveFanart(false);
            setRemoveAcoustid(false);
            await refetch();
            setMessage(
              "Clés enregistrées. Désactivez puis réactivez le moteur local pour les appliquer.",
            );
          } catch (error) {
            setMessage(String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Fanart.tv · {status()?.keys.fanart ? "configurée" : "absente"}
          <input
            type="password"
            autocomplete="off"
            value={fanart()}
            onInput={(e) => setFanart(e.currentTarget.value)}
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={removeFanart()}
            onChange={(e) => setRemoveFanart(e.currentTarget.checked)}
          />
          Supprimer la clé Fanart.tv
        </label>
        <label>
          AcoustID · {status()?.keys.acoustid ? "configurée" : "absente"}
          <input
            type="password"
            autocomplete="off"
            value={acoustid()}
            onInput={(e) => setAcoustid(e.currentTarget.value)}
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={removeAcoustid()}
            onChange={(e) => setRemoveAcoustid(e.currentTarget.checked)}
          />
          Supprimer la clé AcoustID
        </label>
        <button disabled={busy() || library.demo}>Enregistrer les clés locales</button>
        <small>Un champ vide conserve la clé existante.</small>
      </form>
      <p class="muted">
        MusicBrainz, Cover Art Archive, Wikipédia et Wikidata ne demandent pas de clé API pour les
        passes utilisées par Aède.
      </p>
      <h3>Enrichir la bibliothèque sélectionnée</h3>
      <div class="settings-actions">
        <label class="check">
          <input
            type="checkbox"
            checked={summaries()}
            onChange={(e) => setSummaries(e.currentTarget.checked)}
          />
          Biographies
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={covers()}
            onChange={(e) => setCovers(e.currentTarget.checked)}
          />
          Pochettes
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={fanartPass()}
            onChange={(e) => setFanartPass(e.currentTarget.checked)}
          />
          Fanart.tv
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={lyrics()}
            onChange={(e) => setLyrics(e.currentTarget.checked)}
          />
          Paroles
        </label>
      </div>
      <button
        disabled={
          busy() ||
          !administrative() ||
          ![summaries(), covers(), fanartPass(), lyrics()].some(Boolean)
        }
        onClick={async () => {
          setBusy(true);
          try {
            const job = await requestAede<{ task_id: number }>(
              "/api/admin/v1/fetch",
              {},
              "POST",
              {
                summaries: summaries(),
                covers: covers(),
                images: covers(),
                fanart: fanartPass(),
                lyrics: lyrics(),
                yes: true,
              },
              library.source(),
            );
            setMessage(
              `Tâche #${job.task_id} lancée sur ${library.source() === "local" ? "Local" : "Serveur"}.`,
            );
          } catch (e) {
            setMessage(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Lancer l’enrichissement
      </button>
      <p class="muted">
        Cette action contacte les services externes. Aucun enrichissement n’est lancé en ouvrant la
        bibliothèque ou les Paramètres.
      </p>
      <Show when={!administrative()}>
        <p class="notice">
          Un administrateur Aède HTTP local est nécessaire pour lancer une tâche. Sur un serveur
          HTTPS, utilisez la commande fetch du serveur.
        </p>
      </Show>
      <p role="status">{message()}</p>
    </div>
  );
}
