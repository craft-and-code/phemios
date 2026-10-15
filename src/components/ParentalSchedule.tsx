import { For, Index, Show } from "solid-js";
import { t } from "../i18n";
import type { ParentalDay } from "../library/parental-controls";
import { Icon } from "./Icon";
export const parentalWeekdays = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
function minute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}
/** Explicit zero limits are kept distinct from unlimited; Aède validates civil-time windows on save. */
export function ParentalLimit(props: {
  value: number | null;
  maximum: number;
  disabled: boolean;
  label: string;
  onChange: (seconds: number | null) => void;
}) {
  return (
    <label class="parental-limit">
      {props.label}
      <span>
        <input
          type="number"
          min="0"
          max={props.maximum / 60}
          step="1"
          placeholder={t("Illimité")}
          aria-label={props.label}
          value={props.value === null ? "" : props.value / 60}
          disabled={props.disabled}
          onInput={(event) => {
            const text = event.currentTarget.value;
            props.onChange(text === "" ? null : event.currentTarget.valueAsNumber * 60);
          }}
        />
        <small>{t("min")}</small>
      </span>
    </label>
  );
}
export function ParentalSchedule(props: {
  days: readonly ParentalDay[];
  disabled: boolean;
  onChange: (days: ParentalDay[]) => void;
}) {
  function change(index: number, next: ParentalDay) {
    props.onChange(props.days.map((day, position) => (position === index ? next : day)));
  }
  return (
    <div class="parental-schedule">
      <p class="muted">
        {t(
          "Une journée sans plage est fermée. Pour la nuit, ajoutez une plage de chaque côté de minuit. Un quota vide est illimité ; 0 interdit l’écoute.",
        )}
      </p>
      <For each={parentalWeekdays}>
        {(label, index) => {
          const day = () => props.days[index()]!;
          const updateWindow = (
            position: number,
            field: "start_minute" | "end_minute",
            value: number,
          ) =>
            change(index(), {
              ...day(),
              windows: day().windows.map((window, offset) =>
                offset === position ? { ...window, [field]: value } : window,
              ),
            });
          return (
            <section class="parental-day" aria-label={t(label)}>
              <strong>{t(label)}</strong>
              <div class="parental-windows">
                <Index each={day().windows}>
                  {(window, position) => (
                    <div class="parental-window">
                      <input
                        type="time"
                        aria-label={t("Début · {0} · {1}", t(label), position + 1)}
                        value={time(window().start_minute)}
                        disabled={props.disabled}
                        onChange={(event) =>
                          updateWindow(position, "start_minute", minute(event.currentTarget.value))
                        }
                      />
                      <span>—</span>
                      <Show
                        when={window().end_minute !== 1440}
                        fallback={
                          <button
                            type="button"
                            class="parental-midnight"
                            disabled={props.disabled}
                            aria-label={t(
                              "Modifier la fin de plage · {0} · {1}",
                              t(label),
                              position + 1,
                            )}
                            title={t("Modifier la fin de plage")}
                            onClick={() => updateWindow(position, "end_minute", 1439)}
                          >
                            24:00
                          </button>
                        }
                      >
                        <input
                          type="time"
                          aria-label={t("Fin · {0} · {1}", t(label), position + 1)}
                          value={time(window().end_minute)}
                          disabled={props.disabled}
                          onChange={(event) =>
                            updateWindow(
                              position,
                              "end_minute",
                              event.currentTarget.value === "00:00"
                                ? 1440
                                : minute(event.currentTarget.value),
                            )
                          }
                        />
                      </Show>
                      <button
                        type="button"
                        class="icon-button quiet icon-close"
                        aria-label={t("Supprimer la plage · {0} · {1}", t(label), position + 1)}
                        disabled={props.disabled}
                        onClick={() =>
                          change(index(), {
                            ...day(),
                            windows: day().windows.filter((_, offset) => offset !== position),
                          })
                        }
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  )}
                </Index>
                <Show when={!day().windows.length}>
                  <small class="muted">{t("Fermé")}</small>
                </Show>
                <button
                  type="button"
                  class="icon-button quiet"
                  aria-label={t("Ajouter une plage · {0}", t(label))}
                  disabled={
                    props.disabled ||
                    day().windows.length >= 8 ||
                    day().windows.at(-1)?.end_minute === 1440
                  }
                  onClick={() => {
                    const start = day().windows.at(-1)?.end_minute ?? 480;
                    change(index(), {
                      ...day(),
                      windows: [
                        ...day().windows,
                        { start_minute: start, end_minute: Math.min(1440, start + 60) },
                      ],
                    });
                  }}
                >
                  <Icon name="plus" />
                </button>
              </div>
              <ParentalLimit
                value={day().limit_seconds}
                maximum={86400}
                disabled={props.disabled}
                label={t("Maximum · {0}", t(label))}
                onChange={(value) => change(index(), { ...day(), limit_seconds: value })}
              />
            </section>
          );
        }}
      </For>
    </div>
  );
}
