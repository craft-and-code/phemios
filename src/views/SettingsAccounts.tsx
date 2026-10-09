import { createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
interface Account {
  id: string;
  username: string;
  role: string;
  enabled: boolean;
}
/** Aède retains password, role and last-administrator policy. The owned local principal is protected. */
export function SettingsAccounts() {
  const library = useLibrary(),
    [username, setUsername] = createSignal(""),
    [password, setPassword] = createSignal(""),
    [role, setRole] = createSignal("user"),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [currentPassword, setCurrentPassword] = createSignal(""),
    [newPassword, setNewPassword] = createSignal("");
  const administrative = () =>
    library.session()?.account.role === "admin" && library.session()?.server.startsWith("http://");
  const [accounts, { refetch }] = createResource(
    () => (administrative() ? { source: library.source(), session: library.session() } : false),
    (key) => requestAede<Account[]>("/api/admin/v1/accounts", {}, "GET", null, key.source),
  );
  async function perform(work: () => Promise<unknown>) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refetch();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function patch(account: Account, body: unknown) {
    await perform(() =>
      requestAede(
        `/api/admin/v1/accounts/${encodeURIComponent(account.username)}`,
        {},
        "PATCH",
        body,
        library.source(),
      ),
    );
  }
  return (
    <div class="settings-card">
      <h2>Comptes Aède</h2>
      <p class="muted">
        Bibliothèque sélectionnée : {library.source() === "local" ? "Local" : "Serveur"}. Les
        comptes et annotations restent propres à chaque Aède.
      </p>
      <Show when={!library.session()}>
        <p class="notice">Activez le moteur local ou connectez un serveur.</p>
      </Show>
      <Show when={library.session()}>
        <p>
          Compte actif : {library.session()?.account.username} · {library.session()?.account.role}
        </p>
      </Show>
      <Show
        when={administrative()}
        fallback={
          <p class="muted">
            L’administration des comptes nécessite un administrateur sur Aède HTTP local. Le serveur
            HTTPS désactive ses routes administratives ; utilisez sa commande accounts.
          </p>
        }
      >
        <Show when={accounts.error}>
          <p role="alert">{String(accounts.error)}</p>
        </Show>
        <For each={accounts()}>
          {(account) => (
            <div class="account-row">
              <strong>{account.username}</strong>
              <select
                aria-label={`Rôle de ${account.username}`}
                disabled={busy() || account.username === "phemios-local"}
                value={account.role}
                onChange={(e) => void patch(account, { role: e.currentTarget.value })}
              >
                <option value="admin">Administrateur</option>
                <option value="user">Utilisateur</option>
                <option value="auditor">Auditeur</option>
              </select>
              <button
                disabled={busy() || account.username === "phemios-local"}
                onClick={() => void patch(account, { enabled: !account.enabled })}
              >
                {account.enabled ? "Désactiver" : "Activer"}
              </button>
              <button
                disabled={busy() || account.username === "phemios-local"}
                onClick={() =>
                  void perform(() =>
                    requestAede(
                      `/api/admin/v1/accounts/${encodeURIComponent(account.username)}/sessions`,
                      {},
                      "DELETE",
                      null,
                      library.source(),
                    ),
                  )
                }
              >
                Révoquer les sessions
              </button>
              <Show when={account.username !== "phemios-local"}>
                <details>
                  <summary>Modifier ce compte</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const newName = String(form.get("username") ?? "");
                      const secret = String(form.get("password") ?? "");
                      e.currentTarget.reset();
                      void patch(account, {
                        ...(newName ? { username: newName } : {}),
                        ...(secret ? { password: secret } : {}),
                      });
                    }}
                  >
                    <label>
                      Nom d’utilisateur
                      <input name="username" placeholder={account.username} />
                    </label>
                    <label>
                      Nouveau mot de passe
                      <input name="password" type="password" autocomplete="new-password" />
                    </label>
                    <button disabled={busy()}>Enregistrer</button>
                  </form>
                </details>
              </Show>
            </div>
          )}
        </For>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const secret = password();
            setPassword("");
            void perform(() =>
              requestAede(
                "/api/admin/v1/accounts",
                {},
                "POST",
                { username: username(), password: secret, role: role() },
                library.source(),
              ),
            );
          }}
        >
          <h3>Créer un compte</h3>
          <label>
            Nom d’utilisateur
            <input
              required
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              required
              type="password"
              autocomplete="new-password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          <label>
            Rôle
            <select value={role()} onChange={(e) => setRole(e.currentTarget.value)}>
              <option value="user">Utilisateur</option>
              <option value="auditor">Auditeur</option>
              <option value="admin">Administrateur</option>
            </select>
          </label>
          <button disabled={busy()}>Créer</button>
        </form>
      </Show>
      <Show when={library.serverSession() && library.source() === "server"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body = { current_password: currentPassword(), new_password: newPassword() };
            setCurrentPassword("");
            setNewPassword("");
            void perform(async () => {
              await requestAede("/api/auth/v1/password", {}, "PUT", body, "server");
              await library.disconnect();
            });
          }}
        >
          <h3>Changer mon mot de passe</h3>
          <label>
            Mot de passe actuel
            <input
              required
              type="password"
              autocomplete="current-password"
              value={currentPassword()}
              onInput={(e) => setCurrentPassword(e.currentTarget.value)}
            />
          </label>
          <label>
            Nouveau mot de passe
            <input
              required
              type="password"
              autocomplete="new-password"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
            />
          </label>
          <button disabled={busy()}>Modifier et se déconnecter</button>
        </form>
      </Show>
      <p role="alert">{error()}</p>
    </div>
  );
}
