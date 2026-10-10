import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
/** Reversible suggestions retain MusicBrainz evidence and the originating account. */
export function MissingAlbumsStatus(props: { artist?: string }) {
  const library = useLibrary(),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  const rows = () =>
    library.missing
      .rows()
      .filter((row) => row.set_aside && (!props.artist || row.artist === props.artist));
  const visible = () =>
    library.missing
      .rows()
      .filter((row) => !row.set_aside && (!props.artist || row.artist === props.artist));
  const failed = () => visible().filter((row) => library.missingArtwork.status(row) === "failed");
  const counted = (status: string) =>
    visible().filter((row) => library.missingArtwork.status(row) === status).length;
  return (
    <div class="missing-status">
      <Show when={visible().length}>
        <p class="missing-notice cover-status" role="status">
          <span>
            {t(
              "Pochettes chargées : {0} · indisponibles : {1} · échecs : {2}",
              counted("ready"),
              counted("absent"),
              failed().length,
            )}
          </span>
          <Show when={counted("loading")}>
            <span>{t("Téléchargement en cours…")}</span>
          </Show>
          <Show when={failed().length || counted("absent") || counted("loading")}>
            <button
              class="icon-button quiet"
              aria-label={t("Réessayer les pochettes")}
              title={t("Réessayer les pochettes")}
              disabled={counted("loading") > 0}
              aria-busy={counted("loading") > 0}
              onClick={() =>
                void Promise.all(
                  visible()
                    .filter((row) =>
                      ["failed", "absent"].includes(library.missingArtwork.status(row)),
                    )
                    .map((row) => library.missingArtwork.load(row, true)),
                )
              }
            >
              <Show when={counted("loading")} fallback={<Icon name="refresh" />}>
                <span class="spinner" aria-hidden="true" />
              </Show>
            </button>
          </Show>
        </p>
        <Show when={counted("unsupported")}>
          <p class="notice">
            {t(
              "Ce serveur ne télécharge pas encore les pochettes manquantes. Mettez à jour puis redémarrez Aède.",
            )}
          </p>
        </Show>
      </Show>
      <For each={library.missing.errors()}>
        {(message) => (
          <p class="notice missing-notice" role="status">
            <span>{message}</span>
            <button onClick={() => library.missing.refetch()}>{t("Réessayer")}</button>
          </p>
        )}
      </For>
      <Show when={rows().length}>
        <details>
          <summary>{t("Suggestions masquées ({0})", rows().length)}</summary>
          <ul>
            <For each={rows()}>
              {(row) => (
                <li>
                  <span>
                    {row.artist_name} · {row.title}
                  </span>
                  <button
                    disabled={busy() || library.sessionFor(row.artist)?.account.role === "auditor"}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await library.missing.decide(row, false);
                      } catch (failure) {
                        setError(String(failure));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("Rétablir")}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </details>
      </Show>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
      <Show
        when={library.missing
          .rows()
          .some((row) => !row.set_aside && (!props.artist || row.artist === props.artist))}
      >
        <small>
          {t(
            "Manquants : albums studio issus des discographies MusicBrainz récupérées, absents de cette bibliothèque.",
          )}
        </small>
      </Show>
    </div>
  );
}
