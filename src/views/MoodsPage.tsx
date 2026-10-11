import { PageLoader } from "../components/PageLoader";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseMoods, moodName, type MoodRule } from "../library/moods";
import { Icon } from "../components/Icon";
import { Artwork } from "../components/Artwork";
import { EmptyState } from "../components/EmptyState";
/** Personal editable recipes expose every matching criterion and play only matched tracks. */
export function MoodsPage() {
  const library = useLibrary(),
    [selected, setSelected] = createSignal(""),
    [offset, setOffset] = createSignal(0),
    [editing, setEditing] = createSignal(false),
    [name, setName] = createSignal(""),
    [tags, setTags] = createSignal(""),
    [genres, setGenres] = createSignal(""),
    [id, setId] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  const [response, { refetch }] = createResource(
    () => ({
      session: library.session(),
      source: library.source(),
      selected: selected(),
      offset: offset(),
    }),
    async (key) => {
      if (!key.session) return undefined;
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        key.source,
      );
      if (!info.capabilities?.includes("mood_rules"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour utiliser les ambiances."));
      const page = parseMoods(
        await requestAede(
          "/api/me/v1/moods",
          {
            ...(key.selected ? { mood: key.selected } : {}),
            offset: String(key.offset),
            limit: "50",
          },
          "GET",
          null,
          key.source,
        ),
      );
      return { ...key, page };
    },
  );
  const current = () =>
    response()?.session === library.session() &&
    response()?.source === library.source() &&
    response()?.selected === selected()
      ? response()?.page
      : undefined;
  const rule = () => current()?.moods.find((mood) => mood.rule.id === selected())?.rule;
  createEffect(() => {
    library.session();
    library.source();
    setSelected("");
    setOffset(0);
    setEditing(false);
  });
  function edit(rule?: MoodRule) {
    setId(rule?.id ?? `custom:${crypto.randomUUID()}`);
    setName(rule ? moodName(rule) : "");
    setTags(rule?.tags.join(", ") ?? "");
    setGenres(rule?.genres.join(", ") ?? "");
    setEditing(true);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const source = library.source(),
        session = library.session();
      await requestAede(
        "/api/me/v1/moods",
        {},
        "PUT",
        {
          id: id(),
          name: name(),
          tags: tags()
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          genres: genres()
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        source,
      );
      if (session !== library.session() || source !== library.source())
        throw new Error(t("Session invalide."));
      setEditing(false);
      setSelected(id());
      setOffset(0);
      void refetch();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  async function play() {
    setBusy(true);
    setError("");
    try {
      const source = library.source(),
        session = library.session(),
        mood = selected(),
        total = current()?.total ?? 0;
      if (total > 4096) throw new Error(t("Sélection limitée à 4096 pistes."));
      const items: unknown[] = [];
      let epoch: number | undefined;
      for (let offset = 0; offset < total; offset += 200) {
        const page = parseMoods(
          await requestAede(
            "/api/me/v1/moods",
            { mood, offset: String(offset), limit: "200" },
            "GET",
            null,
            source,
          ),
        );
        if (
          (epoch !== undefined && epoch !== page.scanned_at) ||
          page.total !== total ||
          session !== library.session() ||
          source !== library.source()
        )
          throw new Error(t("Sélection modifiée ; resynchronisez la bibliothèque."));
        epoch = page.scanned_at;
        items.push(...page.items);
      }
      await library.player.startSelection({ items });
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="page moods-page">
      <div class="page-heading">
        <p class="muted">
          {t(
            "Des ambiances fondées sur vos tags et genres, avec des critères que vous pouvez modifier.",
          )}
        </p>
        <button
          class="icon-button"
          aria-label={t("Créer une ambiance")}
          title={t("Créer une ambiance")}
          disabled={!library.session() || library.session()?.account.role === "auditor"}
          onClick={() => edit()}
        >
          <Icon name="plus" />
        </button>
      </div>
      <Show when={library.origins().length > 1}>
        <div class="choices">
          <For each={library.origins()}>
            {(source) => (
              <button
                aria-pressed={source === library.source()}
                onClick={() => library.chooseSource(source)}
              >
                {source === "local" ? t("Local") : t("Serveur")}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={response.loading}>
        <PageLoader />
      </Show>
      <Show when={response.error || error()}>
        <p class="notice" role="alert">
          {String(response.error || error())}
        </p>
      </Show>
      <div class="mood-cards">
        <For each={current()?.moods ?? []}>
          {(mood) => (
            <button
              class="mood-card"
              aria-pressed={mood.rule.id === selected()}
              onClick={() => {
                setSelected(mood.rule.id);
                setOffset(0);
              }}
            >
              <strong>{moodName(mood.rule)}</strong>
              <small>{t("{0} pistes", mood.count)}</small>
            </button>
          )}
        </For>
      </div>
      <Show when={editing()}>
        <form
          class="settings-card mood-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2>{t("Critères de l’ambiance")}</h2>
          <label>
            {t("Nom")}
            <input
              required
              maxlength="100"
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label>
            {t("Tags, séparés par des virgules")}
            <input value={tags()} onInput={(event) => setTags(event.currentTarget.value)} />
          </label>
          <label>
            {t("Genres, séparés par des virgules")}
            <input value={genres()} onInput={(event) => setGenres(event.currentTarget.value)} />
          </label>
          <p class="muted">
            {t(
              "Une piste est retenue si au moins un tag ou genre correspond. Les tags de son album et de son artiste principal comptent aussi.",
            )}
          </p>
          <div class="settings-actions">
            <button class="primary" disabled={busy()} type="submit">
              {t("Enregistrer")}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {t("Annuler")}
            </button>
          </div>
        </form>
      </Show>
      <Show when={rule()}>
        {(row) => (
          <>
            <div class="page-heading">
              <div>
                <h2>{moodName(row())}</h2>
                <p class="muted">{[...row().tags, ...row().genres].join(" · ")}</p>
              </div>
              <div class="choices">
                <button
                  class="icon-button"
                  disabled={library.session()?.account.role === "auditor"}
                  aria-label={t("Modifier l’ambiance")}
                  title={t("Modifier l’ambiance")}
                  onClick={() => edit(row())}
                >
                  <Icon name="edit" />
                </button>
                <button
                  class="icon-button"
                  disabled={busy() || !current()?.total || !library.player.ready()}
                  aria-label={t("Lire cette ambiance")}
                  title={t("Lire cette ambiance")}
                  onClick={() => void play()}
                >
                  <Icon name="play" />
                </button>
              </div>
            </div>
            <ul class="mood-tracks">
              <For each={current()?.items ?? []}>
                {(item) => (
                  <li>
                    <a href={`#/track/${encodeURIComponent(item.reference)}`}>
                      <Show
                        when={library.albums().find((album) => album.reference === item.release)}
                      >
                        {(album) => <Artwork album={album()} thumbnail />}
                      </Show>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.reason.tag
                            ? t("Tag : {0}", item.reason.tag)
                            : t("Genre : {0}", item.reason.genre ?? "")}
                        </small>
                      </span>
                    </a>
                    <button
                      class="icon-button"
                      aria-label={t("Lire {0}", item.title)}
                      disabled={library.player.busy()}
                      onClick={() => void library.player.startReference(item.reference)}
                    >
                      <Icon name="play" />
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <Show when={current() && !current()?.total}>
              <EmptyState icon="moods">{t("Aucune piste dans cette ambiance.")}</EmptyState>
            </Show>
            <Show when={(current()?.total ?? 0) > 50 || offset()}>
              <nav class="page-controls">
                <button
                  class="icon-button"
                  disabled={!offset()}
                  aria-label={t("Précédent")}
                  onClick={() => setOffset(Math.max(0, offset() - 50))}
                >
                  <Icon name="back" />
                </button>
                <span>{t("Page {0}", offset() / 50 + 1)}</span>
                <button
                  class="icon-button"
                  disabled={offset() + 50 >= (current()?.total ?? 0)}
                  aria-label={t("Suivant")}
                  onClick={() => setOffset(offset() + 50)}
                >
                  <Icon name="forward" />
                </button>
              </nav>
            </Show>
          </>
        )}
      </Show>
      <Show when={!library.session()}>
        <EmptyState icon="moods">
          {t("Connectez-vous pour accéder aux données de votre compte.")}
        </EmptyState>
      </Show>
    </section>
  );
}
