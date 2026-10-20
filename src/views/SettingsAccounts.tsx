import { createAccountDrafts } from "../library/account-drafts";
import { sourceLabel } from "../library/sources";
import { RoleHelp } from "../components/RoleHelp";
import { Feedback } from "../components/Feedback";
import { ChoiceSelect } from "../components/ChoiceSelect";
import { t } from "../i18n";
import { createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { createAccountList, managedLocalAccount, type Account } from "../library/account-list";
/** Aède retains password, role and last-administrator policy. The owned local principal is protected. */
export function SettingsAccounts() {
  const library = useLibrary();
  const [draft, setDraft] = createAccountDrafts(library.session, library.source);
  const [busy, setBusy] = createSignal(false);
  const username = () => draft.username,
    setUsername = (value: string) => setDraft("username", value),
    password = () => draft.password,
    setPassword = (value: string) => setDraft("password", value),
    role = () => draft.role,
    setRole = (value: string) => setDraft("role", value),
    error = () => draft.error,
    setError = (value: string) => setDraft("error", value),
    currentPassword = () => draft.currentPassword,
    setCurrentPassword = (value: string) => setDraft("currentPassword", value),
    newPassword = () => draft.newPassword,
    setNewPassword = (value: string) => setDraft("newPassword", value);
  const administrative = () => library.session()?.account.role === "admin";
  const accounts = createAccountList(library.session, library.source);
  const managed = (account: Account) => managedLocalAccount(account, library.source());
  const locked = (account: Account) =>
    !!account.parental_locked_by && account.parental_locked_by !== library.session()?.account.id;
  async function perform(work: () => Promise<unknown>) {
    if (busy()) return;
    const owner = library.session(),
      source = library.source();
    setBusy(true);
    setError("");
    try {
      await work();
      if (owner === library.session() && source === library.source()) await accounts.refresh();
    } catch (e) {
      if (owner === library.session() && source === library.source()) setError(String(e));
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
      <h2>{t("Comptes Aède")}</h2>
      <Show when={library.origins().length > 1}>
        <div class="choices" aria-label={t("Bibliothèque à administrer")}>
          <For each={library.origins()}>
            {(source) => (
              <button
                aria-pressed={library.source() === source}
                onClick={() => library.chooseSource(source)}
              >
                {sourceLabel(source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <p class="muted">
        {t("Bibliothèque sélectionnée :")}{" "}
        {library.source() === "local" ? t("Local") : t("Serveur")}
        {t(". Les comptes et annotations restent propres à chaque Aède.")}{" "}
      </p>
      <Show when={!library.session()}>
        <p class="notice">{t("Activez le moteur local ou connectez un serveur.")}</p>
      </Show>
      <Show when={library.session()}>
        <p>
          {t("Compte actif :")} {library.session()?.account.username} ·{" "}
          {library.session()?.account.role}
        </p>
      </Show>
      <Show
        when={administrative()}
        fallback={
          <p class="muted">
            {t("Connectez un compte administrateur pour gérer les comptes Aède.")}{" "}
          </p>
        }
      >
        <Show when={accounts.error()}>
          <Feedback error persistent message={String(accounts.error())} />
        </Show>
        <For each={accounts.values()}>
          {(account) => (
            <div class="account-row">
              <strong>
                {account.username}
                <Show when={locked(account)}> · {t("Verrouillé")}</Show>
              </strong>
              <div class="account-role">
                <RoleHelp />
                <ChoiceSelect
                  label={t("Rôle")}
                  value={account.role}
                  disabled={busy() || locked(account) || managed(account)}
                  onChange={(value) => void patch(account, { role: value })}
                  options={[
                    { value: "admin", label: t("Administrateur") },
                    { value: "user", label: t("Utilisateur") },
                    { value: "auditor", label: t("Auditeur") },
                  ]}
                />
              </div>

              <button
                disabled={busy() || locked(account) || managed(account)}
                onClick={() => void patch(account, { enabled: !account.enabled })}
              >
                {account.enabled ? t("Désactiver") : t("Activer")}
              </button>
              <button
                disabled={busy() || locked(account) || managed(account)}
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
                {t("Révoquer les sessions")}{" "}
              </button>
              <Show when={!managed(account) && !locked(account)}>
                <details>
                  <summary>{t("Modifier ce compte")}</summary>
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
                      {t("Nom d’utilisateur")}{" "}
                      <input name="username" placeholder={account.username} />
                    </label>
                    <label>
                      {t("Nouveau mot de passe")}{" "}
                      <input name="password" type="password" autocomplete="new-password" />
                    </label>
                    <button disabled={busy()}>{t("Enregistrer")}</button>
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
          <h3>{t("Créer un compte")}</h3>
          <label>
            {t("Nom d’utilisateur")}{" "}
            <input
              required
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
          <label>
            {t("Mot de passe")}{" "}
            <input
              required
              type="password"
              autocomplete="new-password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          <label>
            <span class="role-label">
              {t("Rôle")} <RoleHelp />
            </span>
            <ChoiceSelect
              label={t("Rôle")}
              value={role()}
              onChange={setRole}
              options={[
                { value: "user", label: t("Utilisateur") },
                { value: "auditor", label: t("Auditeur") },
                { value: "admin", label: t("Administrateur") },
              ]}
            />
          </label>
          <button disabled={busy()}>{t("Créer")}</button>
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
          <h3>{t("Changer mon mot de passe")}</h3>
          <label>
            {t("Mot de passe actuel")}{" "}
            <input
              required
              type="password"
              autocomplete="current-password"
              value={currentPassword()}
              onInput={(e) => setCurrentPassword(e.currentTarget.value)}
            />
          </label>
          <label>
            {t("Nouveau mot de passe")}{" "}
            <input
              required
              type="password"
              autocomplete="new-password"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
            />
          </label>
          <button disabled={busy()}>{t("Modifier et se déconnecter")}</button>
        </form>
      </Show>
      <Feedback error message={error()} onClose={() => setError("")} />
    </div>
  );
}
