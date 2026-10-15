import { createSignal, For } from "solid-js";
import { t } from "../i18n";
import { parentalPodcastFeed, type ParentalPolicy } from "../library/parental-controls";
import type { Artist, Album } from "../library/types";
import type { SourceId } from "../library/sources";
import { ParentalArtistPicker } from "./ParentalArtistPicker";
import { ParentalSchedule, ParentalLimit } from "./ParentalSchedule";
import { ActionButton } from "./ActionButton";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
/** Controlled policy form writes nothing by itself and can be exercised independently of account IO. */
export function ParentalPolicyForm(props: {
  policy: ParentalPolicy;
  source: SourceId;
  artists: readonly Artist[];
  albums: readonly Album[];
  image: (reference: string) => string | undefined;
  busy: boolean;
  readOnly?: boolean;
  dirty: boolean;
  onChange: (policy: ParentalPolicy) => void;
  onSave: () => unknown;
  onReset: () => void;
}) {
  const [feed, setFeed] = createSignal(""),
    [feedError, setFeedError] = createSignal("");
  const update = (patch: Partial<ParentalPolicy>) => props.onChange({ ...props.policy, ...patch });
  const disabled = () => props.busy || props.readOnly || !props.policy.enabled;
  function addFeed() {
    if (!feed().trim() || disabled()) return;
    try {
      const url = parentalPodcastFeed(feed().trim());
      if (!props.policy.blocked_podcasts.includes(url))
        update({ blocked_podcasts: [...props.policy.blocked_podcasts, url] });
      setFeed("");
      setFeedError("");
    } catch (failure) {
      setFeedError(String(failure));
    }
  }
  return (
    <form
      class="parental-policy"
      onSubmit={(event) => {
        event.preventDefault();
        void props.onSave();
      }}
    >
      <label class="check parental-enable">
        <input
          type="checkbox"
          checked={props.policy.enabled}
          disabled={props.busy || props.readOnly}
          onChange={(event) => update({ enabled: event.currentTarget.checked })}
        />
        {t("Activer le contrôle parental pour ce compte")}
      </label>
      <p class="muted">
        {t(
          "Ces règles appartiennent à ce compte Aède. Elles ne modifient ni les fichiers audio, ni les autres comptes.",
        )}
      </p>
      <p class="muted">
        {t(
          "Activer ces règles verrouille ce compte pour les autres administrateurs. Les désactiver libère le verrou.",
        )}
      </p>
      <div class="parental-clock">
        <label>
          {t("Fuseau horaire")}
          <input
            aria-label={t("Fuseau horaire")}
            value={props.policy.timezone}
            disabled={disabled()}
            placeholder="Europe/Paris"
            onInput={(event) => update({ timezone: event.currentTarget.value })}
          />
        </label>
        <ParentalLimit
          label={t("Maximum par semaine")}
          value={props.policy.week_limit_seconds}
          maximum={604800}
          disabled={disabled()}
          onChange={(value) => update({ week_limit_seconds: value })}
        />
      </div>
      <h3>{t("Horaires et durée d’écoute")}</h3>
      <ParentalSchedule
        days={props.policy.days}
        disabled={disabled()}
        onChange={(days) => update({ days })}
      />
      <ParentalArtistPicker
        artists={props.artists}
        albums={props.albums}
        source={props.source}
        blocked={props.policy.blocked_artists}
        image={props.image}
        disabled={disabled()}
        onChange={(blocked_artists) => update({ blocked_artists })}
      />
      <section class="parental-external">
        <h3>{t("Radios et podcasts")}</h3>
        <label class="check">
          <input
            type="checkbox"
            checked={props.policy.radio_allowed}
            disabled={disabled()}
            onChange={(event) => update({ radio_allowed: event.currentTarget.checked })}
          />
          {t("Autoriser les radios Internet")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={props.policy.podcasts_allowed}
            disabled={disabled()}
            onChange={(event) => update({ podcasts_allowed: event.currentTarget.checked })}
          />
          {t("Autoriser les podcasts")}
        </label>
        <label>
          {t("Flux podcasts masqués")}
          <span class="parental-feed-input">
            <input
              type="url"
              aria-label={t("Flux RSS à masquer")}
              value={feed()}
              placeholder="https://example.org/feed.xml"
              disabled={disabled()}
              onInput={(event) => {
                setFeed(event.currentTarget.value);
                setFeedError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addFeed();
                }
              }}
            />
            <ActionButton
              type="button"
              icon="plus"
              disabled={disabled() || !feed().trim() || props.policy.blocked_podcasts.length >= 128}
              onClick={addFeed}
            >
              {t("Ajouter")}
            </ActionButton>
          </span>
        </label>
        <Feedback error message={feedError()} onClose={() => setFeedError("")} />
        <ul class="parental-feeds">
          <For each={props.policy.blocked_podcasts}>
            {(url) => (
              <li>
                <span>{url}</span>
                <button
                  type="button"
                  class="icon-button quiet icon-close"
                  aria-label={t("Autoriser le flux {0}", url)}
                  disabled={disabled()}
                  onClick={() =>
                    update({
                      blocked_podcasts: props.policy.blocked_podcasts.filter(
                        (feed) => feed !== url,
                      ),
                    })
                  }
                >
                  <Icon name="close" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
      <div class="settings-actions parental-save">
        <ActionButton
          type="submit"
          class="primary"
          icon="check"
          busy={props.busy}
          disabled={!props.dirty || props.readOnly}
        >
          {t("Enregistrer")}
        </ActionButton>
        <ActionButton
          type="button"
          icon="close"
          disabled={props.busy || props.readOnly || !props.dirty}
          onClick={props.onReset}
        >
          {t("Annuler les modifications")}
        </ActionButton>
      </div>
    </form>
  );
}
