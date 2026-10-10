import { createMemo, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { CoverPlay } from "./CoverPlay";
import { Icon } from "./Icon";
import { EmptyState } from "./EmptyState";
/** A bounded nine-cover perspective window reuses cached artwork, independent of catalog size. */
export function CoverFlow(props: { albums: readonly Album[] }) {
  const [selected, setSelected] = createSignal("");
  const index = createMemo(() =>
    Math.max(
      0,
      props.albums.findIndex((album) => album.reference === selected()),
    ),
  );
  const album = () => props.albums[index()];
  const window = createMemo(() =>
    props.albums
      .slice(Math.max(0, index() - 4), index() + 5)
      .map((album, offset) => ({ album, index: Math.max(0, index() - 4) + offset })),
  );
  const choose = (value: number) => {
    const next = props.albums[Math.max(0, Math.min(props.albums.length - 1, value))];
    if (next) setSelected(next.reference);
  };
  let movement = 0;
  return (
    <Show
      when={album()}
      fallback={<EmptyState icon="disc">{t("Aucun album dans cette sélection.")}</EmptyState>}
    >
      <div
        class="cover-flow"
        role="region"
        aria-label={t("Cover Flow")}
        tabindex="0"
        onKeyDown={(event) => {
          const next =
            event.key === "ArrowLeft"
              ? index() - 1
              : event.key === "ArrowRight"
                ? index() + 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? props.albums.length - 1
                    : undefined;
          if (next !== undefined) {
            event.preventDefault();
            choose(next);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          movement += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (Math.abs(movement) > 35) {
            choose(index() + Math.sign(movement));
            movement = 0;
          }
        }}
      >
        <div class="cover-flow-stage">
          <For each={window()}>
            {(row) => {
              const distance = () => row.index - index();
              return (
                <article
                  class="cover-flow-card"
                  classList={{ central: distance() === 0 }}
                  style={{
                    "--offset": distance(),
                    "--depth": Math.abs(distance()),
                    "z-index": 10 - Math.abs(distance()),
                  }}
                >
                  <a
                    href={`#/album/${encodeURIComponent(row.album.reference)}`}
                    tabindex={distance() === 0 ? 0 : -1}
                    aria-label={row.album.title}
                    onClick={(event) => {
                      if (distance()) {
                        event.preventDefault();
                        choose(row.index);
                      }
                    }}
                  >
                    <Artwork album={row.album} />
                  </a>
                  <Show when={distance() === 0}>
                    <CoverPlay reference={row.album.reference} title={row.album.title} />
                  </Show>
                </article>
              );
            }}
          </For>
        </div>
        <div class="cover-flow-controls">
          <button
            class="icon-button"
            aria-label={t("Album précédent")}
            disabled={index() === 0}
            onClick={() => choose(index() - 1)}
          >
            <Icon name="previous" />
          </button>
          <div class="cover-flow-caption" aria-live="polite">
            <a href={`#/album/${encodeURIComponent(album()!.reference)}`}>{album()!.title}</a>
            <small>
              {album()!.year ?? t("Année inconnue")} · {index() + 1}/{props.albums.length}
            </small>
          </div>
          <button
            class="icon-button"
            aria-label={t("Album suivant")}
            disabled={index() + 1 >= props.albums.length}
            onClick={() => choose(index() + 1)}
          >
            <Icon name="next" />
          </button>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, props.albums.length - 1)}
          step="1"
          value={index()}
          aria-label={t("Parcourir les pochettes")}
          onInput={(event) => choose(Number(event.currentTarget.value))}
        />
      </div>
    </Show>
  );
}
