import { SourceBadge } from "./SourceBadge";
import { createSignal, For, Show } from "solid-js";
import { locale, t } from "../i18n";
import type { Concert, ConcertCache } from "../concerts/directory";
import { Icon } from "./Icon";
/** Bounded chronological provider rows retain source attribution and unknown fields. */
export function ConcertResults(props: {
  rows: readonly {
    event: Concert;
    claim: ConcertCache;
    artist: { name: string; references: string[] };
  }[];
}) {
  const [visible, setVisible] = createSignal(100);
  const date = (value: string | null) =>
    value
      ? new Date(`${value}T12:00:00Z`).toLocaleDateString(locale(), {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : t("Date à confirmer");
  const status = (value: string | null) =>
    t(
      (
        {
          onsale: "Billets disponibles",
          offsale: "Vente terminée",
          canceled: "Annulé",
          cancelled: "Annulé",
          postponed: "Reporté",
          rescheduled: "Reprogrammé",
        } as Record<string, string>
      )[value ?? ""] ?? "Statut non communiqué",
    );

  return (
    <>
      <ol class="concerts-list">
        <For each={props.rows.slice(0, visible())}>
          {(row) => (
            <li>
              <time>
                {date(row.event.date)}
                <small>
                  {row.event.time?.slice(0, 5)} {row.event.time && row.event.timezone}
                </small>
              </time>
              <div>
                <h3>
                  <For each={row.artist.references}>
                    {(ref, index) => (
                      <>
                        <Show when={index() > 0}> · </Show>
                        <a href={`#/artist/${encodeURIComponent(ref)}`}>
                          {row.artist.name} <SourceBadge reference={ref} />
                        </a>
                      </>
                    )}
                  </For>
                </h3>
                <strong>{row.event.title}</strong>
                <p>
                  {[row.event.venue, row.event.city, row.event.country].filter(Boolean).join(" · ")}
                </p>
                <small>
                  {status(row.event.status)} · Ticketmaster ·{" "}
                  {t("Consulté le {0}", new Date(row.claim.at).toLocaleDateString(locale()))}
                </small>
                <details>
                  <summary>{t("Informations")}</summary>
                  <p>{row.event.address}</p>
                  <p>{row.event.info}</p>
                  <p>{row.event.notice}</p>
                  <Show when={row.event.price}>
                    {(price) => (
                      <p>
                        {price().min}–{price().max} {price().currency}
                      </p>
                    )}
                  </Show>
                </details>
              </div>
              <Show when={row.event.url}>
                {(url) => (
                  <a
                    class="icon-button"
                    href={url()}
                    title={t("Voir le concert et les billets")}
                    aria-label={t("Voir le concert et les billets")}
                  >
                    <Icon name="external" />
                  </a>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={props.rows.length > visible()}>
        <button onClick={() => setVisible((value) => value + 100)}>
          {t("Afficher davantage")}
        </button>
      </Show>
    </>
  );
}
