import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { AccountNotice } from "../components/AccountNotice";
import { For, Show } from "solid-js";
import { locale, t } from "../i18n";
import { useLibrary } from "../library/context";
import { createAchievementLoading } from "../library/achievement-loading";
import { Icon } from "../components/Icon";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
/** The engine exposes only anonymous locks until owner-private evidence unlocks them. */
export function AchievementsPage() {
  const library = useLibrary();
  const loaded = createAchievementLoading(library.session, library.source);
  const rows = loaded.current;
  return (
    <section class="page result-page achievements-page">
      <StickyHeader visible={!!library.session()}>
        <div class="section-heading">
          <p>{rows() ? t("{0} / {1} dévoilés", rows()!.unlocked, rows()!.total) : ""}</p>
          <RefreshButton
            identity={library.session()}
            busy={loaded.loading()}
            disabled={!library.session() || (loaded.pending() && !loaded.loading())}
            onCancel={loaded.cancel}
            onRefresh={loaded.refetch}
          />
        </div>
      </StickyHeader>
      <AccountNotice />
      <Feedback error message={loaded.error()} />
      <Show
        when={library.session()}
        fallback={
          <EmptyState icon="trophy">{t("Aucun trophée dévoilé dans cette sélection.")}</EmptyState>
        }
      >
        <div class="achievement-grid">
          <For each={rows()?.items}>
            {(row) => (
              <article class="achievement-card" classList={{ locked: row.unlocked_at === null }}>
                <Icon name={row.unlocked_at === null ? "lock" : row.icon!} />
                <Show when={row.unlocked_at !== null} fallback={<span>{t("À découvrir")}</span>}>
                  <strong>{row.title?.[locale()]}</strong>
                  <p>{row.description?.[locale()]}</p>
                  <small>
                    {new Intl.DateTimeFormat(locale(), { dateStyle: "medium" }).format(
                      (row.unlocked_at ?? 0) * 1000,
                    )}
                  </small>
                </Show>
              </article>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
