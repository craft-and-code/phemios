import { createMemo, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { tagVocabulary } from "../library/tags";
import { excludedTags } from "../library/tag-preferences";
import { normalizeName } from "../library/filtering";
import { referenceSource, sourceLabel } from "../library/sources";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
/** Current-owner vocabulary management leaves tags already written on music intact. */
export function SettingsTags() {
  const library = useLibrary(),
    preferences = library.tagPreferences;
  const excluded = () => excludedTags(preferences.entries(), library.session(), library.source());
  const vocabulary = createMemo(() =>
    tagVocabulary(
      Object.values(library.annotations).filter(
        (row) => row && referenceSource(row.reference) === library.source(),
      ),
    ),
  );
  const rows = () =>
    [
      ...new Map([...vocabulary(), ...excluded()].map((tag) => [normalizeName(tag), tag])).values(),
    ].sort((a, b) => a.localeCompare(b));
  const suppressed = (tag: string) =>
    excluded().some((value) => normalizeName(value) === normalizeName(tag));
  return (
    <section class="settings-tags">
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
          "Retirer un tag des suggestions conserve ce tag sur vos artistes, albums et pistes. Vous pouvez le réactiver ici.",
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
                <small>
                  {suppressed(tag) ? t("Retiré des suggestions") : t("Proposé en autocomplétion")}
                </small>
                <button
                  class="icon-button quiet"
                  aria-label={
                    suppressed(tag)
                      ? t("Réactiver le tag {0}", tag)
                      : t("Retirer le tag {0} des suggestions", tag)
                  }
                  onClick={() => {
                    const session = library.session();
                    if (session)
                      preferences.update(session, tag, !suppressed(tag), library.source());
                  }}
                >
                  <Icon name={suppressed(tag) ? "refresh" : "close"} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
