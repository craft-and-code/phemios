import { For, Show } from "solid-js";
/** Product links and reported versions share one compact accessible presentation. */
export function ProductVersions(props: {
  rows: readonly { name: string; version: string; url?: string }[];
  onOpen: (url: string) => void;
}) {
  return (
    <div class="product-versions">
      <For each={props.rows}>
        {(row) => (
          <div class="product-version">
            <Show when={row.url} fallback={<strong>{row.name}</strong>}>
              {(url) => (
                <a
                  href={url()}
                  onClick={(event) => {
                    event.preventDefault();
                    props.onOpen(url());
                  }}
                >
                  {row.name}
                </a>
              )}
            </Show>
            <span>{row.version}</span>
          </div>
        )}
      </For>
    </div>
  );
}
