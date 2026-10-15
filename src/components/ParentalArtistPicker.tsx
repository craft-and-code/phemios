import { createMemo, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { normalizeName } from "../library/filtering";
import type { Artist, Album } from "../library/types";
import { referenceSource, type SourceId } from "../library/sources";
import { matchesQueueMetadata } from "../library/queue-search-text";
import { LibraryPickerRow } from "./LibraryPickerRow";
import { Icon } from "./Icon";
const bare = (reference: string) =>
  reference.replace(/^artist:@phemios\/(?:local|server)\//, "artist:");
/** The same row as queue search selects group restrictions, with no playback or append dependency. */
export function ParentalArtistPicker(props: {
  artists: readonly Artist[];
  albums: readonly Album[];
  source: SourceId;
  blocked: readonly string[];
  disabled: boolean;
  image: (reference: string) => string | undefined;
  onChange: (references: string[]) => void;
}) {
  const [query, setQuery] = createSignal(""),
    [visible, setVisible] = createSignal(30);
  const artists = createMemo(() => {
    const principal = new Set(
      props.albums
        .filter((album) => referenceSource(album.reference) === props.source)
        .map((album) => album.artist),
    );
    return props.artists
      .filter(
        (artist) =>
          referenceSource(artist.reference) === props.source && principal.has(artist.reference),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const artistNames = createMemo(
    () => new Map(artists().map((artist) => [bare(artist.reference), artist.name])),
  );
  const rows = createMemo(() => {
    const term = normalizeName(query().trim());
    return artists().filter(
      (artist) =>
        normalizeName(artist.name).includes(term) ||
        matchesQueueMetadata(artist.searchFields ?? [], term),
    );
  });
  return (
    <section class="parental-artist-picker" aria-label={t("Groupes masqués")}>
      <h3>{t("Groupes masqués")}</h3>
      <div class="parental-blocked">
        <For each={props.blocked}>
          {(reference) => (
            <span class="tag">
              {artistNames().get(reference) ?? reference}
              <button
                type="button"
                class="icon-button quiet icon-close"
                aria-label={t("Rendre visible {0}", artistNames().get(reference) ?? reference)}
                disabled={props.disabled}
                onClick={() => props.onChange(props.blocked.filter((item) => item !== reference))}
              >
                <Icon name="close" />
              </button>
            </span>
          )}
        </For>
        <Show when={!props.blocked.length}>
          <small class="muted">{t("Aucun groupe masqué.")}</small>
        </Show>
      </div>
      <input
        type="search"
        aria-label={t("Rechercher un groupe à masquer")}
        placeholder={t("Rechercher un groupe…")}
        value={query()}
        disabled={props.disabled}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setVisible(30);
        }}
      />
      <div class="parental-picker-results">
        <For each={rows().slice(0, visible())}>
          {(artist) => {
            const selected = () => props.blocked.includes(bare(artist.reference));
            return (
              <LibraryPickerRow
                title={artist.name}
                detail={[artist.genre, artist.country].filter(Boolean).join(" · ")}
                image={props.image(artist.reference)}
                icon="users"
                action={
                  <button
                    type="button"
                    class="icon-button quiet"
                    aria-pressed={selected()}
                    aria-label={t("Masquer {0}", artist.name)}
                    disabled={props.disabled || (!selected() && props.blocked.length >= 256)}
                    onClick={() =>
                      props.onChange(
                        selected()
                          ? props.blocked.filter((ref) => ref !== bare(artist.reference))
                          : [...props.blocked, bare(artist.reference)],
                      )
                    }
                  >
                    <Icon name={selected() ? "check" : "plus"} />
                  </button>
                }
              />
            );
          }}
        </For>
        <Show when={!rows().length}>
          <p class="muted">{t("Aucun résultat dans cette sélection.")}</p>
        </Show>
        <Show when={rows().length > visible()}>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => setVisible(visible() + 30)}
          >
            {t("Afficher davantage")}
          </button>
        </Show>
      </div>
    </section>
  );
}
