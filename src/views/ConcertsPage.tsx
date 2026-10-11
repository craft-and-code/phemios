import { ConcertResults } from "../components/ConcertResults";
import { createMemo, createResource, createSignal, onCleanup, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { configureConcerts, searchConcerts } from "../platform/desktop";
import {
  concertArtists,
  collectConcerts,
  readConcertCache,
  retainConcerts,
  type ConcertCache,
} from "../concerts/directory";
import { normalizeName } from "../library/filtering";
import { ActionButton } from "../components/ActionButton";
import { Icon } from "../components/Icon";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
/** Explicit provider lookups keep partial batch progress; offline navigation reads only cached claims. */
export function ConcertsPage(props: { query: string }) {
  const library = useLibrary(),
    [cache, setCache] = createSignal<ConcertCache[]>([]),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [key, setKey] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [progress, setProgress] = createSignal({ done: 0, total: 0 }),
    [country, setCountry] = createSignal(""),
    [editing, setEditing] = createSignal(false);
  let disposed = false,
    cancelled = false;
  onCleanup(() => {
    disposed = true;
    cancelled = true;
  });
  try {
    setCache(readConcertCache(localStorage));
  } catch (failure) {
    setError(String(failure));
  }
  const [configured, { refetch }] = createResource(async () => {
    try {
      return { ready: await configureConcerts() };
    } catch (failure) {
      return { ready: false, error: String(failure) };
    }
  });
  const artists = createMemo(() => concertArtists(library.artists(), library.albums()));
  const indexed = createMemo(() => new Map(artists().map((row) => [normalizeName(row.name), row])));
  const rows = createMemo(() =>
    cache()
      .filter((row) => indexed().has(normalizeName(row.artist)))
      .flatMap((row) =>
        row.events.map((event) => ({
          event,
          claim: row,
          artist: indexed().get(normalizeName(row.artist))!,
        })),
      )
      .filter(
        (row) =>
          (!country() || row.event.countryCode === country()) &&
          normalizeName(
            [row.artist.name, row.event.title, row.event.city, row.event.venue].join(" "),
          ).includes(normalizeName(props.query)),
      )
      .sort(
        (a, b) =>
          (a.event.date ?? "9999").localeCompare(b.event.date ?? "9999") ||
          a.artist.name.localeCompare(b.artist.name),
      ),
  );
  const rowsForCountries = () => cache().filter((row) => indexed().has(normalizeName(row.artist)));
  const countries = createMemo(() =>
    [
      ...new Map(
        rowsForCountries().flatMap((row) =>
          row.events
            .filter((event) => event.countryCode)
            .map((event) => [event.countryCode!, event.country ?? event.countryCode!] as const),
        ),
      ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1])),
  );
  async function save(remove = false) {
    setSaving(true);
    setError("");
    try {
      await configureConcerts(remove ? null : key(), remove);
      if (disposed) return;
      setKey("");
      setEditing(false);
      await refetch();
    } catch (failure) {
      if (!disposed) setError(String(failure));
    } finally {
      if (!disposed) setSaving(false);
    }
  }
  async function refresh() {
    if (busy()) {
      cancelled = true;
      return;
    }
    if (!configured()?.ready) return;
    setBusy(true);
    setError("");
    cancelled = false;
    const targets = artists();
    setProgress({ done: 0, total: targets.length });
    const failures: string[] = [];
    try {
      for (const artist of targets) {
        const current = () => !disposed && !cancelled && indexed().has(normalizeName(artist.name));
        if (!current()) break;
        try {
          const result = await collectConcerts(artist.name, current, searchConcerts);
          if (!result || !current()) break;
          setCache(retainConcerts(localStorage, { ...result, at: Date.now() }));
        } catch (failure) {
          if (!current()) break;
          const message = String(failure);
          if (failures.length < 3) failures.push(`${artist.name} : ${message}`);
          if (/Limite Ticketmaster|Clé Ticketmaster/.test(message)) break;
        }
        if (current()) setProgress((value) => ({ ...value, done: value.done + 1 }));
      }
    } finally {
      if (!disposed) {
        setBusy(false);
        if (failures.length) setError(failures.join("\n"));
      }
    }
  }
  return (
    <section class="page concerts-page">
      <div class="concerts-toolbar">
        <span>
          {t("{0} artistes de votre CDthèque", artists().length)} ·{" "}
          {t("{0} concerts", rows().length)}
        </span>
        <div>
          <button
            class="icon-button quiet"
            title={t("Configurer Ticketmaster")}
            aria-label={t("Configurer Ticketmaster")}
            aria-expanded={editing()}
            onClick={() => setEditing(!editing())}
          >
            <Icon name="gear" />
          </button>
          <ActionButton
            icon={busy() ? "stop" : "refresh"}
            disabled={!configured()?.ready || !artists().length || configured.loading}
            onClick={() => void refresh()}
          >
            {busy() ? t("Arrêter") : t("Rechercher les concerts")}
          </ActionButton>
        </div>
      </div>
      <Show when={busy()}>
        <p class="concerts-progress" role="status">
          <span class="spinner" />
          {t("Artistes · {0}/{1}", progress().done, progress().total)}
        </p>
      </Show>
      <Show when={!configured()?.ready || editing()}>
        <form
          class="concerts-config"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            {t("Clé Ticketmaster Discovery")}
            <input
              type="password"
              autocomplete="off"
              value={key()}
              onInput={(event) => setKey(event.currentTarget.value)}
            />
          </label>
          <ActionButton type="submit" icon="check" busy={saving()} disabled={!key().trim()}>
            {t("Enregistrer")}
          </ActionButton>
          <Show when={configured()?.ready}>
            <ActionButton
              type="button"
              icon="trash"
              disabled={saving()}
              onClick={() => void save(true)}
            >
              {t("Supprimer la clé")}
            </ActionButton>
          </Show>
          <p>
            {t(
              "Les dates proviennent de Ticketmaster. La clé reste sur cette machine ; aucun compte Aède n’est nécessaire pour cette recherche.",
            )}{" "}
            <a href="https://developer.ticketmaster.com/products-and-docs/apis/getting-started/">
              {t("Obtenir une clé")}
            </a>
          </p>
        </form>
      </Show>
      <Feedback error message={error() || configured()?.error || ""} onClose={() => setError("")} />
      <Show when={countries().length}>
        <div class="choices">
          <button aria-pressed={!country()} onClick={() => setCountry("")}>
            {t("Tous")}
          </button>
          <For each={countries()}>
            {(row) => (
              <button aria-pressed={country() === row[0]} onClick={() => setCountry(row[0])}>
                {row[1]}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={rowsForCountries().some((row) => row.partial)}>
        <p class="notice">
          {t("Résultats partiels : la limite de pagination du fournisseur a été atteinte.")}
        </p>
      </Show>
      <Show
        when={rows().length}
        fallback={
          <EmptyState icon="concerts">
            {configured()?.ready
              ? t("Aucun concert enregistré pour ces artistes.")
              : t("Renseignez une clé Ticketmaster pour rechercher les concerts.")}
          </EmptyState>
        }
      >
        <ConcertResults rows={rows()} />
      </Show>
    </section>
  );
}
