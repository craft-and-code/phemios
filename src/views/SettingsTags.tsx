import { createMemo, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { tagVocabulary } from "../library/tags";
import { suggestionVocabulary } from "../library/tag-preferences";
import { referenceSource, sourceLabel } from "../library/sources";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
/** Current-owner vocabulary management leaves tags already written on music intact. */
export function SettingsTags() {
  const library = useLibrary(),
    preferences = library.tagPreferences;
  const vocabulary = createMemo(() =>
    tagVocabulary(
      Object.values(library.annotations).filter(
        (row) => row && referenceSource(row.reference) === library.source(),
      ),
    ),
  );
  const rows = () =>
    suggestionVocabulary(vocabulary(), preferences.entries(), library.session(), library.source());
  return (
    <section class="settings-tags settings-card">
      <Show when={library.origins().length > 1}>
        <div class="choices">
          <For each={library.origins()}>
            {(source) => (
              <button
                aria-pressed={library.source() === source}
                onClick={() => library.chooseSource(source)}
              >
                {sourceLabel(source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <h2>{t("Tags proposés")}</h2>
      <p class="muted">
        {t(
          "Supprimer un tag le retire du vocabulaire et de l’autocomplétion. Les annotations existantes sont conservées. Une nouvelle saisie du tag le réintroduit.",
        )}
      </p>
      <Show when={preferences.error()}>
        <p role="alert">{preferences.error()}</p>
      </Show>
      <Show when={!library.session()}>
        <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
      </Show>
      <Show
        when={rows().length}
        fallback={<EmptyState icon="tags">{t("Aucun tag enregistré.")}</EmptyState>}
      >
        <ul class="personal-list">
          <For each={rows()}>
            {(tag) => (
              <li>
                <strong>{tag}</strong>
                <small>{t("Proposé en autocomplétion")}</small>
                <button
                  class="icon-button quiet"
                  aria-label={t("Supprimer le tag {0} du vocabulaire", tag)}
                  onClick={() => {
                    const session = library.session();
                    if (session) preferences.update(session, tag, true, library.source());
                  }}
                >
                  <Icon name="trash" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
