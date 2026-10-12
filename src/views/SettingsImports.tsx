import { createSignal, createEffect, createMemo, on, onCleanup, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { sourceLabel, referenceSource } from "../library/sources";
import { isNative, requestAede } from "../platform/desktop";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
import { RoonImportMapping } from "../components/RoonImportMapping";
import { RoonImportPreview } from "../components/RoonImportPreview";
import { readImportCsv, type ImportCsv } from "../imports/csv";
import {
  planRoonImport,
  suggestRoonMapping,
  type RoonMapping,
  type RoonRow,
} from "../imports/roon-plan";
import { writeRoonImport } from "../imports/roon-write";
/** Imports exist only in memory until explicit review/confirmation for the current private account. */
export function SettingsImports() {
  const library = useLibrary(),
    owner = createMemo(() => ({ session: library.session(), source: library.source() }));
  const [table, setTable] = createSignal<ImportCsv>(),
    [mapping, setMapping] = createSignal<RoonMapping>(),
    [preview, setPreview] = createSignal<RoonRow[]>(),
    [opened, setOpened] = createSignal(false),
    [fileName, setFileName] = createSignal(""),
    [busy, setBusy] = createSignal<"" | "file" | "import">(""),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [progress, setProgress] = createSignal({ saved: 0, skipped: 0 });
  let generation = 0,
    disposed = false,
    cancelled = false;
  const writable = () => ["admin", "user"].includes(library.session()?.account.role ?? "");
  function clear() {
    generation++;
    cancelled = true;
    setTable(undefined);
    setMapping(undefined);
    setPreview(undefined);
    setBusy("");
    setError("");
    setMessage("");
    setOpened(false);
    setFileName("");
  }
  createEffect(on(owner, clear));
  onCleanup(() => {
    disposed = true;
    generation++;
    cancelled = true;
  });
  function changed(value: RoonMapping) {
    setMapping(value);
    setPreview(undefined);
    setMessage("");
    setError("");
  }
  async function fileSelected(file: File | undefined) {
    if (!file || busy() || !writable()) return;
    const ticket = ++generation,
      held = owner(),
      active = () => !disposed && ticket === generation && held === owner();
    setBusy("file");
    setPreview(undefined);
    setTable(undefined);
    setFileName("");
    setError("");
    setMessage("");
    try {
      if (!/\.(csv|tsv)$/i.test(file.name) || file.size > 8 * 1024 * 1024)
        throw new Error(
          t(
            "Choisissez un export CSV ou TSV UTF-8 de 8 Mio maximum. Convertissez l’export Excel en CSV UTF-8.",
          ),
        );
      const bytes = await file.arrayBuffer();
      if (!active()) return;
      const data = readImportCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      setTable(data);
      setFileName(file.name);
      setMapping(suggestRoonMapping(data.headers));
    } catch (failure) {
      if (active()) setError(failure instanceof Error ? failure.message : t("Export illisible."));
    } finally {
      if (active()) setBusy("");
    }
  }
  function review() {
    const data = table(),
      fields = mapping();
    if (!data || !fields || !writable()) return;
    try {
      setError("");
      setMessage("");
      setPreview(
        planRoonImport(
          data,
          fields,
          library.albums().filter((row) => referenceSource(row.reference) === library.source()),
          library.artists().filter((row) => referenceSource(row.reference) === library.source()),
          library.annotations,
        ),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Aperçu impossible."));
    }
  }
  async function apply() {
    const rows = preview(),
      held = owner();
    if (!rows || busy() || !writable() || !held.session) return;
    const ticket = ++generation,
      active = () => !disposed && ticket === generation && held === owner();
    cancelled = false;
    setBusy("import");
    setError("");
    setMessage("");
    setProgress({ saved: 0, skipped: 0 });
    try {
      const result = await writeRoonImport(rows, {
        active,
        cancelled: () => cancelled,
        read: (reference) =>
          requestAede(
            "/api/me/v1/annotation",
            { ref: reference },
            "GET",
            null,
            held.source,
            held.session,
          ),
        write: (reference, patch) =>
          requestAede(
            "/api/me/v1/annotation",
            { ref: reference },
            "PUT",
            patch,
            held.source,
            held.session,
          ),
        publish: library.updateAnnotation,
        progress: (saved, skipped) => setProgress({ saved, skipped }),
      });
      if (active()) {
        setPreview(undefined);
        setMessage(
          t(
            "{0} albums enregistrés · {1} lignes ignorées. Les écritures confirmées sont conservées.",
            result.saved,
            result.skipped + rows.filter((row) => row.status !== "ready").length,
          ),
        );
      }
    } catch (failure) {
      if (active()) {
        setPreview(undefined);
        setError(
          t(
            "Import interrompu après {0} albums enregistrés : {1}",
            progress().saved,
            failure instanceof Error ? failure.message : t("Enregistrement impossible."),
          ),
        );
      }
    } finally {
      if (active()) setBusy("");
    }
  }
  return (
    <section class="settings-card settings-imports">
      <h2>{t("Importer depuis un autre lecteur")}</h2>
      <p>
        {t(
          "Retrouvez dans votre compte Aède les favoris, étoiles, tags et notes présents dans un export d’albums Roon.",
        )}
      </p>
      <Show when={library.trackSources().length > 1}>
        <div class="choices" aria-label={t("Compte de destination")}>
          <For each={library.trackSources()}>
            {(row) => (
              <button
                disabled={!!busy()}
                aria-pressed={row.source === library.source()}
                onClick={() => library.chooseSource(row.source)}
              >
                {sourceLabel(row.source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show
        when={library.session()}
        fallback={
          <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
        }
      >
        {(account) => (
          <p class="muted">
            {t(
              "Destination : {0} · {1}",
              account().account.username,
              sourceLabel(library.source()),
            )}
          </p>
        )}
      </Show>
      <div class="settings-actions">
        <ActionButton
          icon="upload"
          disabled={!isNative() || !writable() || !!busy()}
          onClick={() => setOpened(!opened())}
        >
          Roon
        </ActionButton>
        <ActionButton
          icon="upload"
          disabled
          title={t("Playlists M3U documentées ; export des annotations Audirvana non confirmé.")}
        >
          Audirvana
        </ActionButton>
        <ActionButton
          icon="upload"
          disabled
          title={t(
            "Format d’export des annotations Tune non confirmé ; import prévu ultérieurement.",
          )}
        >
          Tune
        </ActionButton>
      </div>
      <Show when={opened()}>
        <div class="roon-import-workspace">
          <p>
            {t(
              "Dans Roon, exportez les albums en CSV (Soundiiz), ou convertissez l’export Excel en CSV UTF-8. Choisissez ensuite les colonnes : seules vos étoiles personnelles doivent être importées, jamais les notes éditoriales AllMusic.",
            )}
          </p>
          <p class="muted">
            {t(
              "Aucun fichier audio n’est modifié. Les albums ambigus, absents ou en conflit sont ignorés ; les tags sont ajoutés sans supprimer les tags existants.",
            )}
          </p>
          <label class="roon-import-file">
            {t("Export Roon (CSV / TSV)")}
            <input
              type="file"
              accept=".csv,.tsv"
              disabled={!!busy() || !writable()}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void fileSelected(file);
              }}
            />
          </label>
          <Show when={fileName()}>
            <p class="muted">{t("{0} · {1} lignes", fileName(), table()?.rows.length ?? 0)}</p>
          </Show>
          <Show when={table() && mapping()}>
            <RoonImportMapping
              headers={table()!.headers}
              mapping={mapping()!}
              disabled={!!busy()}
              onChange={changed}
            />
          </Show>
          <div class="settings-actions">
            <ActionButton
              icon="search"
              busy={busy() === "file"}
              disabled={!table() || !writable() || !!busy()}
              onClick={review}
            >
              {t("Prévisualiser l’import")}
            </ActionButton>
          </div>
          <Show when={preview()}>
            {(rows) => (
              <>
                <RoonImportPreview rows={rows()} />
                <div class="settings-actions">
                  <ActionButton
                    icon="check"
                    busy={busy() === "import"}
                    disabled={!writable() || !rows().some((row) => row.status === "ready")}
                    onClick={() => void apply()}
                  >
                    {t("Importer dans ce compte")}
                  </ActionButton>
                  <Show when={busy() === "import"}>
                    <ActionButton
                      icon="stop"
                      onClick={() => {
                        cancelled = true;
                      }}
                    >
                      {t("Arrêter après cet album")}
                    </ActionButton>
                    <small>{t("{0} albums enregistrés", progress().saved)}</small>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </div>
      </Show>
      <Feedback error message={error()} onClose={() => setError("")} />
      <Feedback message={message()} onClose={() => setMessage("")} />
    </section>
  );
}
