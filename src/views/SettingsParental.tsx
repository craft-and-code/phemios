import { batch, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { sourceLabel } from "../library/sources";
import { createAccountList } from "../library/account-list";
import { createParentalAdmin, parentalAdministrative } from "../library/parental-admin";
import { ChoiceSelect } from "../components/ChoiceSelect";
import { Feedback } from "../components/Feedback";
import { PageLoader } from "../components/PageLoader";
import { RefreshButton } from "../components/RefreshButton";
import { ParentalPolicyForm } from "../components/ParentalPolicyForm";
/** Administrator-only policy editor; target, source and process session delimit every read and write. */
export function SettingsParental() {
  const library = useLibrary(),
    accounts = createAccountList(library.session, library.source),
    [selected, setSelected] = createSignal("");
  const identity = createMemo(() => ({ owner: library.session(), source: library.source() }));
  createEffect(() => {
    identity();
    setSelected("");
  });
  const targets = createMemo(() => accounts.values().filter((account) => account.role !== "admin"));
  const target = createMemo(() => targets().find((account) => account.id === selected()));
  const administrative = () => parentalAdministrative(library.session());
  const scope = createMemo(() => {
    const account = target(),
      session = library.session();
    return administrative() && account && session
      ? { target: account, session, source: library.source() }
      : undefined;
  });
  const admin = createParentalAdmin(scope);
  const refreshIdentity = createMemo(() => ({ owner: identity(), target: selected() }));
  const origins = createMemo(() =>
    (["local", "server"] as const).filter((source) =>
      source === "local" ? library.localSession() : library.serverSession(),
    ),
  );
  return (
    <div class="settings-card settings-parental">
      <div class="section-heading">
        <h2>{t("Contrôle parental")}</h2>
        <RefreshButton
          identity={refreshIdentity()}
          busy={accounts.loading() || admin.loading()}
          pending={!selected() && accounts.pending()}
          disabled={!administrative() || admin.saving()}
          onCancel={() => {
            accounts.cancel();
            admin.cancelLoad();
          }}
          onRefresh={() => (selected() ? admin.load() : accounts.refresh())}
        />
      </div>
      <Show when={origins().length > 1}>
        <div class="choices" aria-label={t("Bibliothèque à administrer")}>
          <For each={origins()}>
            {(source) => (
              <button
                disabled={admin.saving()}
                aria-pressed={library.source() === source}
                onClick={() => library.chooseSource(source)}
              >
                {sourceLabel(source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={!library.session()}>
        <p class="notice">
          {t("Connectez un compte administrateur pour gérer le contrôle parental.")}
        </p>
      </Show>
      <Show when={library.session() && !administrative()}>
        <p class="notice">
          {t("Connectez un compte administrateur pour gérer le contrôle parental.")}
        </p>
      </Show>
      <Show when={administrative()}>
        <p class="muted">
          {t(
            "Choisissez le compte à protéger. Les comptes administrateurs ne peuvent pas être limités.",
          )}
        </p>
        <Show when={accounts.loading() && !targets().length}>
          <PageLoader inline />
        </Show>
        <Feedback error message={accounts.error()} />
        <Show when={!accounts.loading() && !accounts.error() && !targets().length}>
          <p class="notice">{t("Créez d’abord un compte utilisateur dans l’onglet Comptes.")}</p>
        </Show>
        <Show when={targets().length}>
          <label class="parental-account">
            {t("Compte à protéger")}
            <ChoiceSelect
              value={selected()}
              label={t("Compte à protéger")}
              disabled={admin.saving()}
              options={[
                { value: "", label: t("Choisir un compte") },
                ...targets().map((account) => ({
                  value: account.id,
                  label: account.enabled
                    ? account.username
                    : `${account.username} · ${t("Désactivé")}`,
                })),
              ]}
              onChange={(value) => batch(() => setSelected(value))}
            />
          </label>
        </Show>
        <Show when={admin.loading()}>
          <PageLoader inline />
        </Show>
        <Feedback error message={admin.error()} persistent />
        <Feedback message={admin.message()} onClose={admin.dismiss} />
        <Show when={admin.locked()}>
          <p class="notice">
            {t(
              "Ce compte est verrouillé par un autre administrateur. Seul l’administrateur responsable peut modifier ses règles ou le déverrouiller.",
            )}
          </p>
        </Show>
        <Show when={admin.draft()}>
          {(policy) => (
            <ParentalPolicyForm
              policy={policy()}
              source={library.source()}
              artists={library.artists()}
              albums={library.albums()}
              image={(reference) => library.image(reference, "portrait")}
              busy={admin.saving()}
              readOnly={admin.locked()}
              dirty={admin.dirty()}
              onChange={admin.update}
              onSave={admin.save}
              onReset={admin.reset}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
