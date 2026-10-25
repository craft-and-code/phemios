import { createListDrag } from "../components/list-drag";
import { listInsertion, movesListItem, type ListInsertion } from "../components/list-insertion";
import { renameSavedCollection } from "../library/collection-rename";
import { Feedback } from "../components/Feedback";
import { reorderObjects } from "../library/object-list";
import { dropCollectionMenu } from "../navigation/collection-menu-drop";
import { CollectionMenuPicker } from "../components/CollectionMenuPicker";
import type { createCollectionMenuChoices } from "../library/collection-menu-choices";
import { isCollectionMenuId, removeCollectionMenu } from "../navigation/collection-menu";
import { interfaceProfileIdentity } from "../library/account-preferences";
import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import {
  moveMenu,
  renameMenuItem,
  removeMenuSpacer,
  menuItem,
  menuLabel,
  type MenuItem,
  type createMenuPreferences,
} from "../navigation/menu-preferences";
import { Icon } from "../components/Icon";
/** Visibility and order apply immediately, with native drag and equivalent keyboard buttons. */
export function SettingsNavigation(props: {
  menu: ReturnType<typeof createMenuPreferences>;
  collectionChoices?: ReturnType<typeof createCollectionMenuChoices> | undefined;
}) {
  const [dragged, setDragged] = createSignal<MenuItem>(),
    [target, setTarget] = createSignal<ListInsertion<MenuItem>>(),
    [editing, setEditing] = createSignal<MenuItem>(),
    [name, setName] = createSignal(""),
    [renaming, setRenaming] = createSignal(false),
    [renameError, setRenameError] = createSignal("");
  const [collectionDrag, setCollectionDrag] = createSignal<{
    name: string;
    label: string;
    targetId?: string | undefined;
    identity: unknown;
  }>();
  let menuList!: HTMLOListElement;
  let identity = interfaceProfileIdentity();
  const changed = () => {
    const next = interfaceProfileIdentity();
    if (next === identity) return;
    identity = next;
    setDragged(undefined);
    setCollectionDrag(undefined);
    setTarget(undefined);
    setEditing(undefined);
    setName("");
    setRenameError("");
  };
  onMount(() => window.addEventListener("phemios-settings-loaded", changed));
  onCleanup(() => window.removeEventListener("phemios-settings-loaded", changed));
  const move = (id: MenuItem, delta: number) => {
    const order = [...props.menu.value().order],
      index = order.indexOf(id),
      destination = index + delta;
    if (destination < 0 || destination >= order.length) return;
    [order[index], order[destination]] = [order[destination]!, order[index]!];
    props.menu.update({ ...props.menu.value(), order });
  };
  const position = (hit: Element | null, y: number) => {
    const copy = collectionDrag(),
      from = dragged();
    if (copy) {
      if (
        copy.identity !== props.collectionChoices?.identity() ||
        !props.collectionChoices
          ?.rows()
          .some((row) => row.id === copy.targetId && row.name === copy.name)
      )
        return;
    } else if (!from) return;
    const place = listInsertion(menuList, "data-menu-item", props.menu.value().order, hit, y);
    return place && (copy || movesListItem(props.menu.value().order, from!, place.before))
      ? place
      : undefined;
  };
  const drop = (before?: MenuItem) => {
    const held = collectionDrag();
    if (held)
      props.menu.update(() =>
        dropCollectionMenu(
          props.menu.value(),
          held,
          props.collectionChoices?.identity(),
          props.collectionChoices?.names() ?? [],
          `collection:${crypto.randomUUID()}`,
          before,
          props.collectionChoices?.rows(),
        ),
      );
    else if (dragged())
      props.menu.update({
        ...props.menu.value(),
        order: before
          ? moveMenu(props.menu.value().order, dragged()!, before)
          : (reorderObjects(props.menu.value().order, dragged()!) as MenuItem[]),
      });
    setDragged(undefined);
    setCollectionDrag(undefined);
    setTarget(undefined);
  };
  const dropAt = (hit: Element | null, y: number) => {
    const place = position(hit, y);
    setTarget(undefined);
    if (place) drop(place.before);
  };
  async function renameCollection(id: `collection:${string}`) {
    const held = props.collectionChoices?.identity(),
      targetId = props.menu.value().collectionIds?.[id],
      next = name().trim();
    if (!held || !targetId || renaming() || held.session.account.role === "auditor") return;
    setRenaming(true);
    setRenameError("");
    const current = () =>
      held === props.collectionChoices?.identity() &&
      props.menu.value().collectionIds?.[id] === targetId;
    try {
      if (
        await renameSavedCollection(
          props.menu.value().collections?.[id] ?? "",
          next,
          held.source,
          current,
          targetId,
          held.session,
        )
      ) {
        setEditing(undefined);
        void props.collectionChoices?.refresh();
      }
    } catch (failure) {
      if (current()) setRenameError(String(failure));
    } finally {
      setRenaming(false);
    }
  }
  const drag = createListDrag({
    identity: () => props.menu.value(),
    enabled: () => !renaming(),
    contains: (key) => props.menu.value().order.includes(key as MenuItem),
    start: (key) => {
      setCollectionDrag(undefined);
      setDragged(key as MenuItem);
    },
    end: () => {
      setDragged(undefined);
      setTarget(undefined);
    },
    over: (hit, y) => setTarget(position(hit, y)),
    drop: (_key, hit, y) => dropAt(hit, y),
  });
  const canRenameCollection = (id: MenuItem) => {
    if (!isCollectionMenuId(id)) return true;
    const held = props.collectionChoices?.identity();
    return (
      !!held && held.session.account.role !== "auditor" && !!props.menu.value().collectionIds?.[id]
    );
  };
  return (
    <div class="settings-card">
      <h2>{t("Navigation")}</h2>
      <p class="muted">
        {t(
          "Affichez les menus souhaités. Glissez une ligne ou utilisez les flèches pour modifier leur ordre. Les réglages sont enregistrés immédiatement.",
        )}
      </p>
      <div class="navigation-editor">
        <div class="navigation-menu-editor">
          <h3>{t("Menus")}</h3>
          <ol
            ref={(node) => {
              menuList = node;
            }}
            class="menu-settings object-list-frame"
            classList={{ "list-drop-empty": !!target() && target()!.row === undefined }}
            aria-label={t("Organisation des menus")}
            onDragOver={(event) => {
              const place = position(event.target as Element, event.clientY);
              setTarget(place);
              if (place) {
                event.preventDefault();
                if (event.dataTransfer)
                  event.dataTransfer.dropEffect = collectionDrag() ? "copy" : "move";
              }
            }}
            onDragLeave={(event) => {
              if (!event.relatedTarget || !menuList.contains(event.relatedTarget as Node))
                setTarget(undefined);
            }}
            onDrop={(event) => {
              if (collectionDrag() || dragged()) {
                event.preventDefault();
                event.stopPropagation();
                dropAt(event.target as Element, event.clientY);
              }
            }}
          >
            <For each={props.menu.value().order}>
              {(id, index) => {
                const item = () => menuItem(id, props.menu.value());
                return (
                  <li
                    data-menu-item={id}
                    classList={{
                      "menu-group-row": item().kind === "heading" || item().kind === "separator",
                      "drop-target": target()?.row === id,
                      "list-drop-before": target()?.row === id && target()?.edge === "before",
                      "list-drop-after": target()?.row === id && target()?.edge === "after",
                      "list-drag-source": drag.dragged() === id,
                    }}
                  >
                    <button
                      type="button"
                      class="menu-drag quiet"
                      onPointerDown={(event) => drag.pointerDown(event, id)}
                      onPointerMove={drag.pointerMove}
                      onPointerUp={drag.pointerUp}
                      onPointerCancel={drag.cancel}
                      onLostPointerCapture={drag.cancel}
                      draggable="true"
                      title={t("Déplacer {0}", menuLabel(id, props.menu.value()))}
                      onDragStart={(event) => {
                        drag.nativeStart(event, id, event.currentTarget.closest("li")!);
                        event.dataTransfer?.setData("text/plain", id);
                      }}
                      onDragEnd={() => {
                        drag.cancel();
                      }}
                      aria-label={t("Déplacer {0}", menuLabel(id, props.menu.value()))}
                    >
                      ⋮⋮
                    </button>
                    <label class="check menu-visibility">
                      <input
                        type="checkbox"
                        aria-label={menuLabel(id, props.menu.value())}
                        checked={!props.menu.value().hidden.includes(id)}
                        onChange={(event) =>
                          props.menu.update({
                            ...props.menu.value(),
                            hidden: event.currentTarget.checked
                              ? props.menu.value().hidden.filter((value) => value !== id)
                              : [...props.menu.value().hidden, id],
                          })
                        }
                      />
                      <Show when={item().kind === "section" || item().kind === "collection"}>
                        <span class="menu-icon-slot" aria-hidden="true">
                          <Icon name={item().symbol} />
                        </span>
                      </Show>
                    </label>
                    <div class="menu-name-slot">
                      <Show when={editing() !== id}>
                        <span
                          class="menu-name"
                          classList={{ "menu-group-name": item().kind === "heading" }}
                          title={menuLabel(id, props.menu.value())}
                        >
                          {item().kind === "separator" ? "" : menuLabel(id, props.menu.value())}
                        </span>
                      </Show>
                      <Show
                        when={editing() === id}
                        fallback={
                          <button
                            class="icon-button quiet"
                            aria-label={t("Renommer {0}", menuLabel(id, props.menu.value()))}
                            title={t("Renommer {0}", menuLabel(id, props.menu.value()))}
                            disabled={!canRenameCollection(id)}
                            onClick={() => {
                              setRenameError("");
                              setName(
                                id.startsWith("separator:")
                                  ? (props.menu.value().labels?.[id] ?? "")
                                  : menuLabel(id, props.menu.value()),
                              );
                              setEditing(id);
                            }}
                          >
                            <Icon name="edit" />
                          </button>
                        }
                      >
                        <form
                          class="menu-name-editor"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (isCollectionMenuId(id)) {
                              void renameCollection(id);
                              return;
                            }
                            props.menu.update(renameMenuItem(props.menu.value(), id, name()));
                            if (!props.menu.error()) setEditing(undefined);
                          }}
                        >
                          <input
                            autofocus
                            aria-label={
                              id.startsWith("separator:")
                                ? t("Titre du groupe (facultatif)")
                                : item().kind === "collection"
                                  ? t("Nom de la collection")
                                  : t("Nom du menu")
                            }
                            value={name()}
                            maxlength={item().kind === "collection" ? "256" : "80"}
                            disabled={renaming()}
                            required={!id.startsWith("separator:")}
                            onInput={(event) => setName(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") setEditing(undefined);
                            }}
                          />
                          <button
                            class="icon-button quiet"
                            type="submit"
                            disabled={renaming()}
                            aria-label={t("Enregistrer")}
                          >
                            <Icon name="check" />
                          </button>
                          <button
                            class="icon-button quiet"
                            type="button"
                            aria-label={t("Annuler")}
                            onClick={() => setEditing(undefined)}
                          >
                            <Icon name="close" />
                          </button>
                        </form>
                      </Show>
                      <Show when={id.startsWith("separator:") || item().kind === "collection"}>
                        <button
                          class="icon-button quiet menu-remove"
                          title={
                            item().kind === "collection"
                              ? t("Retirer ce menu de collection")
                              : t("Supprimer l’espacement")
                          }
                          aria-label={
                            item().kind === "collection"
                              ? t("Retirer le menu {0}", menuLabel(id, props.menu.value()))
                              : t("Supprimer l’espacement")
                          }
                          onClick={() =>
                            props.menu.update(
                              isCollectionMenuId(id)
                                ? removeCollectionMenu(props.menu.value(), id)
                                : removeMenuSpacer(props.menu.value(), id as `separator:${string}`),
                            )
                          }
                        >
                          <Icon name="trash" />
                        </button>
                      </Show>
                    </div>
                    <button
                      class="icon-button quiet"
                      disabled={index() === 0}
                      aria-label={t("Monter {0}", menuLabel(id, props.menu.value()))}
                      title={t("Monter {0}", menuLabel(id, props.menu.value()))}
                      onClick={() => move(id, -1)}
                    >
                      <Icon name="chevron-up" />
                    </button>
                    <button
                      class="icon-button quiet"
                      disabled={index() === props.menu.value().order.length - 1}
                      aria-label={t("Descendre {0}", menuLabel(id, props.menu.value()))}
                      title={t("Descendre {0}", menuLabel(id, props.menu.value()))}
                      onClick={() => move(id, 1)}
                    >
                      <Icon name="chevron-down" />
                    </button>
                  </li>
                );
              }}
            </For>
          </ol>
          <div class="settings-actions">
            <button
              disabled={props.menu.value().order.length >= 96}
              onClick={() =>
                props.menu.update({
                  ...props.menu.value(),
                  order: [...props.menu.value().order, `separator:${crypto.randomUUID()}`],
                })
              }
            >
              {t("Ajouter un espacement")}
            </button>
            <button onClick={() => props.menu.reset()}>{t("Réinitialiser le menu")}</button>
          </div>
        </div>
        <CollectionMenuPicker
          menu={props.menu}
          choices={props.collectionChoices}
          onCollectionDrag={(name, label) => {
            setDragged(undefined);
            setCollectionDrag({
              name,
              label,
              targetId: props.collectionChoices?.rows().find((row) => row.name === name)?.id,
              identity: props.collectionChoices?.identity(),
            });
          }}
          onCollectionPointerOver={(hit, y) => setTarget(position(hit, y))}
          onCollectionPointerDrop={dropAt}
          onCollectionDragEnd={() => {
            setCollectionDrag(undefined);
            setTarget(undefined);
          }}
        />
      </div>
      <Feedback error message={renameError()} />
      <Show when={props.menu.error()}>
        <p role="alert">{props.menu.error()}</p>
      </Show>
    </div>
  );
}
