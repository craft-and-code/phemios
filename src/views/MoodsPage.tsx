import { retryAedeReadOnRecovery } from "../library/aede-availability";
import { createPersonalActions } from "../library/personal-actions";
import { readMoodReply } from "../library/mood-reading";
import { moodSearch } from "../library/personal-search";
import { QueueAppend } from "../components/QueueAppend";
import { retainedMoodPage, retainedMoodReply, type MoodReply } from "../library/retained-mood-page";
import { MoodFeatures } from "../components/MoodFeatures";
import { Feedback } from "../components/Feedback";
import { isNative } from "../platform/desktop";
import { ResultCount } from "../components/ResultCount";
import { StickyHeader } from "../components/StickyHeader";
import { AccountNotice } from "../components/AccountNotice";
import { PageLoader } from "../components/PageLoader";
import {
  createMemo,
  on,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseMoods, moodName, moodReason, type MoodRule } from "../library/moods";
import { Icon } from "../components/Icon";
import { Artwork } from "../components/Artwork";
import { EmptyState } from "../components/EmptyState";
/** Personal editable recipes expose every matching criterion and play only matched tracks. */
export function MoodsPage(props: { query: string }) {
  const library = useLibrary(),
    [selected, setSelected] = createSignal(""),
    [offset, setOffset] = createSignal(0),
    [editing, setEditing] = createSignal(false),
    [name, setName] = createSignal(""),
    [tags, setTags] = createSignal(""),
    [genres, setGenres] = createSignal(""),
    [id, setId] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [submitting, setSubmitting] = createSignal(false),
    [expected, setExpected] = createSignal("");
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const owner = createMemo(() => ({ session: library.session(), source: library.source() }));
  const readKey = createMemo(() => ({
    session: owner().session,
    source: owner().source,
    owner: owner(),
    selected: selected(),
    offset: offset(),
    expected: expected(),
  }));
  const [response, { refetch }] = createResource(readKey, async (key): Promise<MoodReply> => {
    const empty = { ...key, audio: false, extractable: false };
    if (!key.session) return empty;
    try {
      const value = await readMoodReply(
        { ...key, session: key.session },
        () => alive && readKey() === key,
      );
      return { ...empty, ...value };
    } catch (failure) {
      return { ...empty, error: String(failure) };
    }
  });
  const current = () => retainedMoodPage(response, readKey());
  const currentReply = () => retainedMoodReply(response, readKey());
  retryAedeReadOnRecovery(
    () => currentReply()?.error,
    () => {
      if (!response.loading) return refetch();
    },
  );
  const actions = createPersonalActions(
    () => "moods",
    library.session,
    library.source,
    () => {
      setSelected("");
      setOffset(0);
      setExpected("");
      setEditing(false);
      setName("");
      setTags("");
      setGenres("");
      setId("");
      setError("");
      setBusy(false);
      setSubmitting(false);
    },
  );
  const rule = () => current()?.moods.find((mood) => mood.rule.id === selected())?.rule;
  const matched = createMemo(() =>
    (current()?.moods ?? []).filter((mood) =>
      moodSearch({ ...mood.rule, name: moodName(mood.rule) }, props.query),
    ),
  );
  createEffect(
    on(
      () => props.query,
      () => {
        setSelected("");
        setOffset(0);
        setExpected("");
      },
      { defer: true },
    ),
  );
  const featureJob = () =>
    library.tasks
      .jobs()
      .filter((job) => job.source === library.source() && job.kind === "mood_features")
      .at(-1);
  let watched = "";
  createEffect(() => {
    const job = featureJob(),
      key = `${library.source()}:${job?.task_id}:${job?.status}:${job?.progress?.done}`;
    if (watched && watched !== key) {
      setOffset(0);
      setExpected("");
      void refetch();
    }
    watched = key;
  });
  createEffect(() => {
    if (!current()?.acoustic?.warming) return;
    const timer = setTimeout(() => void refetch(), 1000);
    onCleanup(() => clearTimeout(timer));
  });
  async function extract() {
    const current = actions.capture(),
      source = library.source();
    if (!current() || library.session()?.account.role !== "admin" || submitting()) return;
    setSubmitting(true);
    setError("");
    try {
      await library.tasks.features(source);
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      if (current()) setSubmitting(false);
    }
  }
  async function stopFeatures() {
    const current = actions.capture(),
      job = featureJob();
    if (!current() || !job) return;
    try {
      await library.tasks.cancel(job.task_id, job.source);
    } catch (failure) {
      if (current()) setError(String(failure));
    }
  }
  function pageOffset(next: number) {
    setExpected(current()?.selection_revision ?? "");
    setOffset(next);
  }
  function edit(rule?: MoodRule) {
    setId(rule?.id ?? `custom:${crypto.randomUUID()}`);
    setName(rule ? moodName(rule) : "");
    setTags(rule?.tags.join(", ") ?? "");
    setGenres(rule?.genres.join(", ") ?? "");
    setEditing(true);
  }
  async function save() {
    const admitted = actions.capture(),
      session = library.session(),
      source = library.source(),
      savedId = id();
    if (!admitted() || !session || session.account.role === "auditor" || busy()) return;
    setBusy(true);
    setError("");
    try {
      await requestAede(
        "/api/me/v1/moods",
        {},
        "PUT",
        {
          id: savedId,
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
        session,
      );
      if (!admitted()) return;
      setEditing(false);
      setSelected(savedId);
      setOffset(0);
      void refetch();
    } catch (failure) {
      if (admitted()) setError(String(failure));
    } finally {
      if (admitted()) setBusy(false);
    }
  }
  async function play() {
    const admitted = actions.capture();
    if (
      !admitted() ||
      library.session()?.account.role === "auditor" ||
      busy() ||
      library.player.busy()
    )
      return;
    setBusy(true);
    setError("");
    try {
      const source = library.source(),
        session = library.session(),
        mood = selected(),
        total = current()?.total ?? 0,
        revision = current()?.selection_revision,
        acoustic = !!currentReply()?.audio;
      if (total > 4096) throw new Error(t("Sélection limitée à 4096 pistes."));
      await library.player.readSelection(async (playerCurrent) => {
        const currentSelection = () => admitted() && mood === selected() && playerCurrent();
        const items: unknown[] = [];
        let epoch: number | undefined;
        for (let offset = 0; offset < total; offset += 200) {
          if (!currentSelection()) return;
          const page = parseMoods(
            await requestAede(
              "/api/me/v1/moods",
              {
                mood,
                offset: String(offset),
                limit: "200",
                ...(acoustic ? { audio: "true", ...(revision ? { revision } : {}) } : {}),
              },
              "GET",
              null,
              source,
              session,
            ),
          );
          if (!currentSelection()) return;
          if (
            (epoch !== undefined && epoch !== page.scanned_at) ||
            page.total !== total ||
            page.selection_revision !== revision ||
            mood !== selected() ||
            session !== library.session() ||
            source !== library.source()
          )
            throw new Error(t("Sélection modifiée ; resynchronisez la bibliothèque."));
          epoch = page.scanned_at;
          items.push(...page.items);
        }
        return currentSelection() ? { items } : undefined;
      }, source);
    } catch (failure) {
      if (admitted()) setError(String(failure));
    } finally {
      if (admitted()) setBusy(false);
    }
  }
  return (
    <section class="page result-page moods-page">
      <StickyHeader visible={!!library.session()}>
        <div class="page-heading">
          <ResultCount value={selected() ? (current()?.total ?? 0) : matched().length} />
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
      </StickyHeader>
      <AccountNotice />
      <Show when={current()?.acoustic}>
        <MoodFeatures
          coverage={current()?.acoustic}
          {...(featureJob() ? { job: featureJob()! } : {})}
          admin={
            isNative() &&
            !!currentReply()?.extractable &&
            library.session()?.account.role === "admin"
          }
          submitting={submitting()}
          onStart={extract}
          onStop={() => void stopFeatures()}
        />
      </Show>
      <Show when={featureJob()?.status === "failed"}>
        <Feedback
          error
          message={
            featureJob()?.result?.stderr ||
            featureJob()?.error?.message ||
            t("Extraction audio interrompue.")
          }
        />
      </Show>
      <Show when={response.loading && !currentReply()}>
        <PageLoader />
      </Show>
      <Feedback error persistent message={currentReply()?.error || error() || ""} />
      <div class="mood-cards">
        <For each={matched()}>
          {(mood) => (
            <button
              class="mood-card"
              aria-pressed={mood.rule.id === selected()}
              onClick={() => {
                setSelected(mood.rule.id);
                setOffset(0);
                setExpected("");
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
              "Les tags d’ambiance de la piste priment sur ceux de l’album, puis de l’artiste. Sans tag d’ambiance, les genres sont utilisés.",
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
                <Show when={!row().acoustic}>
                  <button
                    class="icon-button"
                    disabled={library.session()?.account.role === "auditor"}
                    aria-label={t("Modifier l’ambiance")}
                    title={t("Modifier l’ambiance")}
                    onClick={() => edit(row())}
                  >
                    <Icon name="edit" />
                  </button>
                </Show>
                <button
                  class="icon-button"
                  disabled={
                    busy() ||
                    !current()?.total ||
                    !library.player.canStart(`track:@phemios/${library.source()}/queue`)
                  }
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
                        <small>{moodReason(item.reason)}</small>
                      </span>
                    </a>
                    <QueueAppend reference={item.reference} title={item.title} />
                    <button
                      class="icon-button"
                      aria-label={t("Lire {0}", item.title)}
                      disabled={!library.player.canStart(item.reference) || library.player.busy()}
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
                  onClick={() => pageOffset(Math.max(0, offset() - 50))}
                >
                  <Icon name="back" />
                </button>
                <span>{t("Page {0}", offset() / 50 + 1)}</span>
                <button
                  class="icon-button"
                  disabled={offset() + 50 >= (current()?.total ?? 0)}
                  aria-label={t("Suivant")}
                  onClick={() => pageOffset(offset() + 50)}
                >
                  <Icon name="forward" />
                </button>
              </nav>
            </Show>
          </>
        )}
      </Show>
      <Show when={library.session() && !response.loading && !!current() && !matched().length}>
        <EmptyState icon="moods">{t("Aucune ambiance dans cette sélection.")}</EmptyState>
      </Show>
      <Show when={!library.session()}>
        <EmptyState icon="moods">{t("Aucune piste dans cette ambiance.")}</EmptyState>
      </Show>
    </section>
  );
}
