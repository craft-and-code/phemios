import { Icon } from "./Icon";
import { t } from "../i18n";
import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { readLoginPreference, saveLoginPreference } from "../library/login-preference";
import { useLibrary } from "../library/context";
/** Successful login names are remembered; passwords and bearer credentials stay ephemeral. */
export function ConnectionPanel(props: { onClose: () => void; embedded?: boolean }) {
  let panel: HTMLElement | undefined;
  onMount(() => {
    if (props.embedded) return;
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
  const [preferenceError, setPreferenceError] = createSignal("");
  let remembered: ReturnType<typeof readLoginPreference>;
  try {
    remembered = readLoginPreference(localStorage);
  } catch {
    setPreferenceError(t("Le nom d’utilisateur mémorisé est indisponible."));
  }
  const initialServer = remembered?.server ?? "http://127.0.0.1:3412";
  const [server, setServer] = createSignal(initialServer);
  const [username, setUsername] = createSignal(
    remembered?.server === initialServer ? remembered.username : "",
  );
  const [password, setPassword] = createSignal("");
  return (
    <div
      class={props.embedded ? "settings-connection" : "popover-backdrop"}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        ref={(element) => {
          panel = element;
        }}
        role={props.embedded ? undefined : "dialog"}
        aria-modal={props.embedded ? undefined : true}
        class="connection-panel"
        aria-label={t("Connexion Aède")}
      >
        <Show when={!props.embedded}>
          <button
            class="connection-close icon-close"
            aria-label={t("Fermer la connexion")}
            onClick={props.onClose}
          >
            ×
          </button>
        </Show>
        <Show
          when={library.serverSession()}
          fallback={
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const secret = password();
                setPassword("");
                await library.connect(server(), username(), secret);
                const session = library.serverSession();
                if (session) {
                  try {
                    saveLoginPreference(localStorage, session.server, session.account.username);
                    setPreferenceError("");
                  } catch {
                    setPreferenceError(
                      t("Connexion réussie, mais le nom d’utilisateur n’a pas pu être mémorisé."),
                    );
                  }
                }
                if (!props.embedded && session && !library.error() && !preferenceError())
                  props.onClose();
              }}
            >
              <p class="eyebrow">{t("VOTRE SERVEUR AÈDE")}</p>
              <label>
                {t("Serveur")}{" "}
                <input
                  required
                  type="url"
                  value={server()}
                  onInput={(event) => setServer(event.currentTarget.value)}
                />
              </label>
              <label>
                {t("Compte")}{" "}
                <input
                  required
                  autocomplete="username"
                  value={username()}
                  onInput={(event) => setUsername(event.currentTarget.value)}
                />
              </label>
              <label>
                {t("Mot de passe")}{" "}
                <input
                  required
                  type="password"
                  autocomplete="off"
                  value={password()}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                />
              </label>
              <button class="primary" disabled={library.busy() || library.demo}>
                {library.busy() ? t("Connexion et synchronisation…") : t("Se connecter")}
              </button>
              <Show when={library.demo}>
                <p class="muted">
                  {t("La connexion utilise le pont natif de l’application desktop.")}
                </p>
              </Show>
              <small>
                {t(
                  "Le nom d’utilisateur est mémorisé sur cet appareil. Le mot de passe est demandé à chaque connexion.",
                )}{" "}
              </small>
            </form>
          }
        >
          <p>
            {library.connected() ? t("Connecté") : t("Session")} :{" "}
            {library.serverSession()?.account.username}
          </p>
          <Show when={!library.connected()}>
            <p role="status">
              {t(
                "Connexion perdue ou session expirée. Si nécessaire, déconnectez-vous puis reconnectez-vous.",
              )}{" "}
            </p>
          </Show>
          <p class="muted">{library.serverSession()?.server}</p>
          <div class="settings-actions">
            <button
              disabled={library.busy()}
              aria-busy={library.busy()}
              onClick={() => void library.sync("server")}
            >
              <Show when={library.busy()} fallback={<Icon name="refresh" />}>
                <span class="spinner" aria-hidden="true" />
              </Show>
              {library.busy() ? t("Synchronisation…") : t("Synchroniser la bibliothèque")}
            </button>
            <button disabled={library.busy()} onClick={() => void library.disconnect()}>
              <Icon name="disconnect" />
              {t("Se déconnecter")}
            </button>
          </div>
        </Show>
        <Show when={preferenceError()}>
          <p role="status">{preferenceError()}</p>
        </Show>
        <Show when={library.error()}>
          <p role="alert">{library.error()}</p>
        </Show>
      </section>
    </div>
  );
}
