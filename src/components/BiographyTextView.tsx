import { createComputed, createSignal, For, Match, on, Show, Switch } from "solid-js";
import { Portal } from "solid-js/web";
import { t } from "../i18n";
import type { BiographyPart, BiographyTrackChoice } from "../library/biography-links";
import { BiographyTrackChoices } from "./BiographyTrackChoices";

/** Links are presentation-only; literal prose remains escaped and multiple editions require a choice. */
export function BiographyTextView(props: {
  parts: readonly BiographyPart[];
  onGenre: (genre: string) => void;
  onYear: (year: number) => void;
}) {
  const [choice, setChoice] = createSignal<{
    title: string;
    trigger: HTMLButtonElement;
    tracks: readonly BiographyTrackChoice[];
  }>();
  const close = () => {
    const trigger = choice()?.trigger;
    setChoice(undefined);
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  };
  createComputed(
    on(
      () => props.parts,
      () => setChoice(undefined),
    ),
  );
  return (
    <>
      <For each={props.parts}>
        {(part) => (
          <Show when={part.target} fallback={part.text}>
            {(target) => (
              <Switch>
                <Match when={target().kind === "artist" && target()}>
                  {(value) => {
                    const row = value();
                    return (
                      row.kind === "artist" && (
                        <a
                          class="biography-link"
                          href={`#/artist/${encodeURIComponent(row.reference)}`}
                        >
                          {part.text}
                        </a>
                      )
                    );
                  }}
                </Match>
                <Match when={target().kind === "genre" && target()}>
                  {(value) => {
                    const row = value();
                    return (
                      row.kind === "genre" && (
                        <a
                          class="biography-link"
                          href="#/genres"
                          onClick={(event) => {
                            event.preventDefault();
                            props.onGenre(row.name);
                          }}
                        >
                          {part.text}
                        </a>
                      )
                    );
                  }}
                </Match>
                <Match when={target().kind === "year" && target()}>
                  {(value) => {
                    const row = value();
                    return (
                      row.kind === "year" && (
                        <a
                          class="biography-link"
                          href="#/albums"
                          title={t("Albums de {0}", row.year)}
                          onClick={(event) => {
                            event.preventDefault();
                            props.onYear(row.year);
                          }}
                        >
                          {part.text}
                        </a>
                      )
                    );
                  }}
                </Match>
                <Match when={target().kind === "tracks" && target()}>
                  {(value) => {
                    const row = value();
                    if (row.kind !== "tracks") return;
                    return (
                      <Show
                        when={row.tracks.length === 1}
                        fallback={
                          <button
                            type="button"
                            class="biography-link"
                            aria-haspopup="dialog"
                            title={t("Choisir une version de {0}", part.text)}
                            onClick={(event) =>
                              setChoice({
                                title: part.text,
                                tracks: row.tracks,
                                trigger: event.currentTarget,
                              })
                            }
                          >
                            {part.text}
                          </button>
                        }
                      >
                        <a
                          class="biography-link"
                          href={`#/track/${encodeURIComponent(row.tracks[0]!.reference)}`}
                          title={row.tracks[0]!.title}
                        >
                          {part.text}
                        </a>
                      </Show>
                    );
                  }}
                </Match>
              </Switch>
            )}
          </Show>
        )}
      </For>
      <Show when={choice()}>
        {(row) => (
          <Portal>
            <BiographyTrackChoices title={row().title} tracks={row().tracks} onClose={close} />
          </Portal>
        )}
      </Show>
    </>
  );
}
