import type { JSX } from "solid-js";
/** Shared catalog markup keeps cover actions beside, never inside, the navigation link. */
export function AlbumCardView(props: {
  href: string;
  title: string;
  year: string | number;
  artwork: JSX.Element;
  source?: JSX.Element;
  rating?: JSX.Element;
  actions: JSX.Element;
}) {
  return (
    <article class="album-card">
      <div class="album-cover">
        <a class="album-art-link" href={props.href}>
          {props.artwork}
        </a>
        {props.actions}
      </div>
      <a class="album-title-link" href={props.href}>
        <span class="album-title-line">
          <strong>{props.title}</strong>
          {props.source}
        </span>
        {props.rating}
        <small class="album-year">{props.year}</small>
      </a>
    </article>
  );
}
