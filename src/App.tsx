import { createResource, Show } from "solid-js";
import { getRuntimeInfo } from "./platform/desktop";

/** Show the native bridge result without implying a connected music server. */
export function App() {
  const [runtime] = createResource(getRuntimeInfo);
  return (
    <main class="welcome">
      <h1>phémios<span>.</span></h1>
      <p>Votre bibliothèque musicale, avec Aède.</p>
      <Show when={runtime()} fallback={<p>Initialisation…</p>}>
        {(info) => <p>{info().native ? "Application desktop" : "Aperçu navigateur"} · socle prêt</p>}
      </Show>
      <Show when={runtime.error}><p role="alert">Le pont desktop est indisponible.</p></Show>
    </main>
  );
}
