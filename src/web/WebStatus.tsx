import { createSignal, Show, For } from "solid-js";
import { demoAuthor, demoMusic } from "./catalog";
import { webMode } from "./runtime";
import { t } from "../i18n";
/** Attribution remains available from every demo page, including during playback. */
export function WebStatus() {
  const [credits, setCredits] = createSignal(false);
  return (
    <div class="web-status">
      <strong>
        {webMode() === "demo" ? t("Démonstration Web") : t("Bibliothèque personnelle")}
      </strong>
      <small>{t("Audio · DSP Aède WebAssembly")}</small>
      <a href="#/settings">{t("Ma bibliothèque et réglages")}</a>
      <button
        class="metadata-link"
        onClick={() => setCredits(!credits())}
        aria-expanded={credits()}
      >
        {t("Crédits audio · CC BY 4.0")}
      </button>
      <Show when={credits()}>
        <div class="web-credits">
          <For each={demoMusic}>
            {(row) => (
              <p>
                <a href={row.source} target="_blank" rel="noopener noreferrer">
                  {row.title}
                </a>{" "}
                — {demoAuthor(row.author).name}
                <Show when={row.album !== row.title}>
                  <small>{row.album}</small>
                </Show>
              </p>
            )}
          </For>
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution 4.0
          </a>
          <small>
            {t("Pochettes originales de démonstration Phémios. Enregistrements inchangés.")}
          </small>
        </div>
      </Show>
    </div>
  );
}
