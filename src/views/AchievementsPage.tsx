import { createResource, For, Show } from "solid-js";
import { locale, t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseAchievements } from "../library/achievements";
import { Icon } from "../components/Icon";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
/** The engine exposes only anonymous locks until owner-private evidence unlocks them. */
export function AchievementsPage() {
  const library = useLibrary();
  const [loaded, { refetch }] = createResource(
    () => library.session() && { session: library.session()!, source: library.source() },
    async (key) => {
      const info = await requestAede<{ capabilities: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        key.source,
      );
      if (!info.capabilities.includes("private_achievements"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour les trophées."));
      const raw = await requestAede(
        "/api/me/v1/achievements",
        {},
        key.session.account.role === "auditor" ? "GET" : "POST",
        key.session.account.role === "auditor" ? null : {},
        key.source,
      );
      if (key.session !== library.session() || key.source !== library.source())
        throw new Error(t("Session invalide."));
      return { session: key.session, source: key.source, value: parseAchievements(raw) };
    },
  );
  const rows = () => {
    const value = loaded();
    return value && value.session === library.session() && value.source === library.source()
      ? value.value
      : undefined;
  };
  return (
    <section class="page achievements-page">
      <div class="section-heading">
        <p>{rows() ? t("{0} / {1} dévoilés", rows()!.unlocked, rows()!.total) : ""}</p>
        <button
          class="icon-button quiet"
          aria-label={t("Actualiser")}
          disabled={!library.session() || loaded.loading}
          onClick={() => void refetch()}
        >
          <Show when={loaded.loading} fallback={<Icon name="refresh" />}>
            <span class="spinner" />
          </Show>
        </button>
      </div>
      <Feedback error message={loaded.error ? String(loaded.error) : ""} />
      <Show
        when={library.session()}
        fallback={
          <EmptyState icon="trophy">
            {t("Connectez-vous pour accéder aux données de votre compte.")}
          </EmptyState>
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
