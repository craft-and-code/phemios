import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import {
  moveMenu,
  menuItem,
  menuLabel,
  type MenuItem,
  type createMenuPreferences,
} from "../navigation/menu-preferences";
import { Icon } from "../components/Icon";
/** Visibility and order apply immediately, with native drag and equivalent keyboard buttons. */
export function SettingsNavigation(props: { menu: ReturnType<typeof createMenuPreferences> }) {
  const [dragged, setDragged] = createSignal<MenuItem>(),
    [target, setTarget] = createSignal<MenuItem>(),
    [editing, setEditing] = createSignal<MenuItem>(),
    [name, setName] = createSignal("");
  const move = (id: MenuItem, delta: number) => {
    const order = [...props.menu.value().order],
      index = order.indexOf(id),
      destination = index + delta;
    if (destination < 0 || destination >= order.length) return;
    [order[index], order[destination]] = [order[destination]!, order[index]!];
    props.menu.update({ ...props.menu.value(), order });
  };
  return (
    <div class="settings-card">
      <h2>{t("Navigation")}</h2>
      <p class="muted">
        {t(
          "Affichez les menus souhaités. Glissez une ligne ou utilisez les flèches pour modifier leur ordre. Les réglages sont enregistrés immédiatement.",
        )}
      </p>
      <ol class="menu-settings">
        <For each={props.menu.value().order}>
          {(id, index) => {
            const item = menuItem(id);
            return (
              <li
                classList={{ "drop-target": target() === id }}
                onDragOver={(event) => {
                  if (dragged()) {
                    event.preventDefault();
                    setTarget(id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const held = dragged();
                  if (held)
                    props.menu.update({
                      ...props.menu.value(),
                      order: moveMenu(props.menu.value().order, held, id),
                    });
                  setDragged(undefined);
                  setTarget(undefined);
                }}
              >
                <span
                  class="menu-drag"
                  draggable="true"
                  title={t("Déplacer {0}", menuLabel(id, props.menu.value()))}
                  onDragStart={(event) => {
                    setDragged(id);
                    event.dataTransfer?.setData("text/plain", id);
                  }}
                  onDragEnd={() => {
                    setDragged(undefined);
                    setTarget(undefined);
                  }}
                  aria-hidden="true"
                >
                  ⋮⋮
                </span>
                <label class="check">
                  <input
                    type="checkbox"
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
                  <Icon name={item.symbol} />
                  <Show when={editing() !== id}>
                    <span>{menuLabel(id, props.menu.value())}</span>
                  </Show>
                </label>
                <Show when={item.kind !== "separator"}>
                  <Show
                    when={editing() === id}
                    fallback={
                      <button
                        class="icon-button quiet"
                        aria-label={t("Renommer {0}", menuLabel(id, props.menu.value()))}
                        title={t("Renommer {0}", menuLabel(id, props.menu.value()))}
                        onClick={() => {
                          setName(menuLabel(id, props.menu.value()));
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
                        props.menu.update({
                          ...props.menu.value(),
                          labels: { ...props.menu.value().labels, [id]: name().trim() },
                        });
                        if (!props.menu.error()) setEditing(undefined);
                      }}
                    >
                      <input
                        autofocus
                        aria-label={t("Nom du menu")}
                        value={name()}
                        maxlength="80"
                        required
                        onInput={(event) => setName(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditing(undefined);
                        }}
                      />
                      <button class="icon-button quiet" type="submit" aria-label={t("Enregistrer")}>
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
                </Show>
                <Show when={item.kind === "separator"}>
                  <button
                    class="icon-button quiet"
                    title={t("Supprimer l’espacement")}
                    aria-label={t("Supprimer l’espacement")}
                    onClick={() =>
                      props.menu.update({
                        ...props.menu.value(),
                        order: props.menu.value().order.filter((value) => value !== id),
                        hidden: props.menu.value().hidden.filter((value) => value !== id),
                      })
                    }
                  >
                    <Icon name="trash" />
                  </button>
                </Show>
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
      <Show when={props.menu.error()}>
        <p role="alert">{props.menu.error()}</p>
      </Show>
    </div>
  );
}
