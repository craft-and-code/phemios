import { For, Show, type JSX } from "solid-js";
import type { ResourcePart, ResourceLink } from "../encyclopedia/resource-links";
import { t } from "../i18n";
/** Only literal text and validated external anchors enter the reader, never remote HTML. */
export function WikipediaResourceText(props: {
  parts: readonly ResourcePart[];
  renderText?: ((text: string) => JSX.Element) | undefined;
}) {
  return (
    <For each={props.parts}>
      {(part) => (
        <Show when={part.url} fallback={props.renderText?.(part.text) ?? part.text}>
          <a href={part.url} target="_blank" rel="noreferrer noopener">
            {part.text}
          </a>
        </Show>
      )}
    </For>
  );
}
/** Preserve access even when the plain extract spells a provider differently from the rendered article. */
export function WikipediaUnmatchedResources(props: { links: readonly ResourceLink[] }) {
  return (
    <Show when={props.links.length}>
      <section class="wikipedia-resource-links">
        <h3>{t("Liens externes")}</h3>
        <ul>
          <For each={props.links}>
            {(link) => (
              <li>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  {link.label}
                </a>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
