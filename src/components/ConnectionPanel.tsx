import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
/** Credentials are entered once, cleared after submission and never persisted in the webview. */
export function ConnectionPanel(props: { onClose: () => void }) {
  let panel: HTMLElement | undefined;
  onMount(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    panel?.querySelector<HTMLElement>("input,button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
      if (event.key === "Tab") {
        const controls = [
          ...(panel?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),a[href]",
          ) ?? []),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    onCleanup(() => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    });
  });
  const library = useLibrary();
  const [server, setServer] = createSignal(library.snapshot()?.server ?? "http://127.0.0.1:3412");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  return (
    <div
      class="popover-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        ref={(element) => {
          panel = element;
        }}
        role="dialog"
        aria-modal="true"
        class="connection-panel"
        aria-label="Connexion Aède"
      >
        <button class="connection-close" aria-label="Fermer la connexion" onClick={props.onClose}>
          ×
        </button>
        <Show
          when={library.session()}
          fallback={
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const secret = password();
                setPassword("");
                await library.connect(server(), username(), secret);
                if (library.session() && !library.error()) props.onClose();
              }}
            >
              <p class="eyebrow">VOTRE SERVEUR AÈDE</p>
              <label>
                Serveur
                <input
                  required
                  type="url"
                  value={server()}
                  onInput={(event) => setServer(event.currentTarget.value)}
                />
              </label>
              <label>
                Compte
                <input
                  required
                  autocomplete="username"
                  value={username()}
                  onInput={(event) => setUsername(event.currentTarget.value)}
                />
              </label>
              <label>
                Mot de passe
                <input
                  required
                  type="password"
                  autocomplete="off"
                  value={password()}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                />
              </label>
              <button class="primary" disabled={library.busy() || library.demo}>
                {library.busy() ? "Connexion et synchronisation…" : "Se connecter"}
              </button>
              <Show when={library.demo}>
                <p class="muted">La connexion utilise le pont natif de l’application desktop.</p>
              </Show>
              <small>
                Les identifiants restent en mémoire. Les données du catalogue et les images
                disposent d’un cache local.
              </small>
            </form>
          }
        >
          <p>Connecté : {library.session()?.account.username}</p>
          <p class="muted">{library.session()?.server}</p>
          <button disabled={library.busy()} onClick={() => library.sync()}>
            Synchroniser la bibliothèque
          </button>
          <button onClick={() => library.disconnect()}>Se déconnecter</button>
        </Show>
        <Show when={library.error()}>
          <p role="alert">{library.error()}</p>
        </Show>
      </section>
    </div>
  );
}
