import { AlbumCount } from "./AlbumCount";
import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import type { ArtistView } from "../library/tool-preferences";
/** Shared card geometry accepts resident artwork and album navigation without a native import. */
export function ArtistCard(props: {
  view: ArtistView;
  name: string;
  href: string;
  metadata: string;
  albumCount: number;
  image?: string | undefined;
  logo?: string | undefined;
  fallback: JSX.Element;
  badge?: JSX.Element;
  play: JSX.Element;
  children?: JSX.Element;
}) {
  return (
    <article class={`artist-presentation artist-presentation-${props.view}`}>
      <a class="artist-presentation-open" href={props.href} aria-hidden="true" tabIndex={-1} />
      <Show when={props.logo && props.view === "discography"}>
        <a class="artist-presentation-logo" href={props.href}>
          <img
            src={props.logo}
            alt={t("Logo de {0}", props.name)}
            loading="lazy"
            decoding="async"
          />
        </a>
      </Show>
      <div class="artist-presentation-identity">
        <div class="artist-presentation-picture">
          <a href={props.href} aria-label={props.name}>
            <Show when={props.image} fallback={props.fallback}>
              {(url) => <img src={url()} alt="" loading="lazy" decoding="async" />}
            </Show>
          </a>
        </div>
        <a class="artist-presentation-name" href={props.href}>
          <h2>
            {props.name} {props.badge}
          </h2>
          <p>{props.metadata}</p>
          <small>
            <AlbumCount value={props.albumCount} />
          </small>
        </a>
        <Show when={props.view === "discography"}>
          <div class="artist-presentation-play">{props.play}</div>
        </Show>
      </div>
      <div class="artist-presentation-albums">{props.children}</div>
    </article>
  );
}
