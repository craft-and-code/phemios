import { Show } from "solid-js";
import { t } from "../i18n";
import type { Job } from "../library/jobs";
import type { MoodPage } from "../library/moods";
import { ActionButton } from "./ActionButton";
import { RefreshButton } from "./RefreshButton";
/** Shared descriptors are explicit background work; private labels remain owned by the current account. */
export function MoodFeatures(props: {
  coverage: MoodPage["acoustic"];
  job?: Job;
  admin: boolean;
  submitting: boolean;
  onStart: () => unknown;
  onStop: () => void;
}) {
  const active = () => !!props.job && ["queued", "running"].includes(props.job.status);
  return (
    <section class="settings-card mood-features">
      <div class="page-heading">
        <div>
          <h2>{t("Caractéristiques audio")}</h2>
          <p class="muted">
            {t(
              "{0} analysés · {1} à analyser",
              props.coverage?.ready ?? 0,
              props.coverage?.missing ?? 0,
            )}
          </p>
        </div>
        <Show when={props.admin}>
          <Show
            when={active()}
            fallback={
              <ActionButton
                icon="moods"
                busy={props.submitting}
                disabled={!props.coverage?.missing}
                onClick={() => void props.onStart()}
              >
                {t("Analyser en arrière-plan")}
              </ActionButton>
            }
          >
            <RefreshButton
              busy={true}
              label={t("Arrêter l’extraction audio")}
              onRefresh={() => {}}
              onCancel={props.onStop}
            />
          </Show>
        </Show>
      </div>
      <Show when={active()}>
        <p role="status">
          {props.job?.progress?.phase === "waiting_for_playback"
            ? t("En attente de la fin de lecture")
            : t("Extraction audio en cours")}{" "}
          · {props.job?.progress?.done ?? 0} / {props.job?.progress?.total ?? 0}
        </p>
      </Show>
      <Show when={props.job?.progress}>
        <p class="muted">
          {t(
            "{0} calculés · {1} réutilisés · {2} indisponibles",
            props.job?.progress?.analyzed,
            props.job?.progress?.reused,
            props.job?.progress?.failed,
          )}
        </p>
      </Show>
      <Show when={props.coverage?.cache_errors}>
        <p class="notice" role="alert">
          {t(
            "{0} caches illisibles ; les données existantes sont conservées.",
            props.coverage?.cache_errors,
          )}
        </p>
      </Show>
      <p class="muted">
        {t(
          "Les tags personnels priment. Avec au moins deux exemples tagués sur des pistes ou albums, Aède recherche des sons proches. Sans exemples suffisants, les genres restent utilisés.",
        )}
      </p>
    </section>
  );
}
