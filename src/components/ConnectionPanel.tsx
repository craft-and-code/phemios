import { createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
/** Credentials are entered once, cleared after submission and never persisted in the webview. */
export function ConnectionPanel(props: { onClose: () => void }) {
  const library = useLibrary();
  const [server, setServer] = createSignal(library.snapshot()?.server ?? "http://127.0.0.1:3412");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  return (
    <section class="connection-panel" aria-label="Connexion Aède">
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
              Les identifiants restent en mémoire. Les données du catalogue et les images disposent
              d’un cache local.
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
  );
}
