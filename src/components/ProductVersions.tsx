import { For } from "solid-js";
/** Product links and reported versions share one compact accessible presentation. */
export function ProductVersions(props: {
  rows: readonly { name: string; version: string; url: string }[];
  onOpen: (url: string) => void;
}) {
  return (
    <div class="product-versions">
      <For each={props.rows}>
        {(row) => (
          <div class="product-version">
            <a
              href={row.url}
              onClick={(event) => {
                event.preventDefault();
                props.onOpen(row.url);
              }}
            >
              {row.name}
            </a>
            <span>{row.version}</span>
          </div>
        )}
      </For>
    </div>
  );
}
