import { createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { publicWebDemo, webMode } from "./runtime";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
import { locale, t } from "../i18n";
/** Demo reset is separate from connecting a real library; no browser action can delete server music. */
export function WebSettings() {
  const library = useLibrary(),
    [username, setUsername] = createSignal(""),
    [password, setPassword] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  async function mode(value: "demo" | "personal", reset = false) {
    setBusy(true);
    setError("");
    try {
      await (await import("./bridge")).changeWebMode(value, reset);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <div class="web-settings">
      <section>
        <h2>{t("Phémios dans votre navigateur")}</h2>
        <p>
          {t(
            "Explorez la bibliothèque libre, lancez un morceau et construisez votre liste de lecture. Le son utilise le même DSP Rust que l’application desktop, compilé en WebAssembly.",
          )}
        </p>
        <Show
          when={webMode() === "demo"}
          fallback={
            <ActionButton icon="play" disabled={busy()} onClick={() => void mode("demo")}>
              {t("Retrouver la démonstration")}
            </ActionButton>
          }
        >
          <div class="web-settings-actions">
            <Show
              when={!publicWebDemo()}
              fallback={
                <a
                  class="metadata-link"
                  href={`../docs/${locale()}/getting-started.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Utiliser Phémios chez soi")} →
                </a>
              }
            >
              <ActionButton icon="library" disabled={busy()} onClick={() => void mode("personal")}>
                {t("Utiliser ma bibliothèque")}
              </ActionButton>
            </Show>
            <ActionButton icon="reset" disabled={busy()} onClick={() => void mode("demo", true)}>
              {t("Réinitialiser la démonstration")}
            </ActionButton>
          </div>
          <p class="hint">
            {t(
              "La réinitialisation concerne uniquement vos réglages de démonstration dans ce navigateur.",
            )}
          </p>
        </Show>
      </section>
      <Show when={publicWebDemo()}>
        <p>
          {t(
            "Cette démonstration fonctionne sans compte. Pour votre collection, installez Phémios ou hébergez la version Web avec votre serveur Aède.",
          )}
        </p>
      </Show>
      <Show when={!publicWebDemo() && webMode() === "personal"}>
        <section>
          <h2>{t("Connexion à votre serveur Aède")}</h2>
          <p>
            {t(
              "L’interface Web et l’API Aède doivent être publiées à la même adresse. Vos fichiers restent sur votre serveur ; les identifiants ne sont pas enregistrés dans le navigateur.",
            )}
          </p>
          <Show
            when={library.serverSession()}
            fallback={
              <form
                class="web-login"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  try {
                    await library.connect(location.origin, username(), password());
                  } finally {
                    setPassword("");
                    setBusy(false);
                  }
                }}
              >
                <label>
                  {t("Adresse du serveur")}
                  <input value={location.origin} readonly />
                </label>
                <label>
                  {t("Identifiant")}
                  <input
                    value={username()}
                    onInput={(event) => setUsername(event.currentTarget.value)}
                    autocomplete="username"
                    required
                  />
                </label>
                <label>
                  {t("Mot de passe")}
                  <input
                    type="password"
                    value={password()}
                    onInput={(event) => setPassword(event.currentTarget.value)}
                    autocomplete="current-password"
                    required
                  />
                </label>
                <ActionButton
                  icon="users"
                  busy={busy()}
                  disabled={busy() || library.busy() || !username().trim() || !password()}
                >
                  {t("Se connecter")}
                </ActionButton>
              </form>
            }
          >
            <p>{t("Connecté : {0}", library.serverSession()?.account.username ?? "")}</p>
            <ActionButton
              icon="close"
              disabled={busy() || library.busy()}
              onClick={() => void library.disconnect()}
            >
              {t("Se déconnecter")}
            </ActionButton>
          </Show>
          <p class="hint">
            {t(
              "Lecture Web initiale : fichiers compatibles avec le navigateur, jusqu’à 64 Mio par titre. Le fondu, la normalisation, les CD et les périphériques natifs restent disponibles dans l’application desktop.",
            )}
          </p>
        </section>
      </Show>
      <Feedback error message={error() || library.error()} />
    </div>
  );
}
