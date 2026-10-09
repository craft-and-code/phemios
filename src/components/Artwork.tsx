import { t } from "../i18n";
import { Icon } from "./Icon";
import { Show } from "solid-js";
import type { Album } from "../library/types";
import { useLibrary } from "../library/context";
/** Stable squares reuse resident object URLs; scrolling never fetches a cover. */
export function Artwork(props: { album: Album; compact?: boolean; thumbnail?: boolean }) {
  const library = useLibrary();
  const index = () =>
    ["blue", "islands", "edges", "dawn", "first", "lines"].indexOf(props.album.reference);
  return (
    <div
      class="artwork"
      classList={{ compact: props.compact ?? false, "real-art": !library.demo }}
      data-palette={Math.max(0, index()) % 6}
      role="img"
      aria-label={t("Pochette : {0}", props.album.title)}
    >
      <Show
        when={library.demo}
        fallback={
          <Show
            when={library.image(props.album.reference, "cover")}
            fallback={
              <span
                class="cover-fallback"
                title={library.imageError(props.album.reference, "cover")}
              >
                <Show
                  when={props.thumbnail}
                  fallback={
                    props.album.cover && !library.imageError(props.album.reference, "cover")
                      ? t("Chargement de la pochette…")
                      : t("Pochette indisponible")
                  }
                >
                  <Icon name="disc" />
                </Show>
              </span>
            }
          >
            {(url) => <img src={url()} alt="" decoding="async" />}
          </Show>
        }
      >
        <span>{props.album.title}</span>
        <small>{library.artists().find((a) => a.reference === props.album.artist)?.name}</small>
      </Show>
    </div>
  );
}
