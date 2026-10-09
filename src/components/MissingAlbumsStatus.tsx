import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
/** Reversible suggestions retain MusicBrainz evidence and the originating account. */
export function MissingAlbumsStatus(props: { artist?: string }) {
  const library = useLibrary(),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  const rows = () =>
    library.missing
      .rows()
      .filter((row) => row.set_aside && (!props.artist || row.artist === props.artist));
  return (
    <div class="missing-status">
      <For each={library.missing.errors()}>
        {(message) => (
          <p class="notice" role="status">
            {message}
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
