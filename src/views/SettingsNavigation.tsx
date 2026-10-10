import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { sections, type Section } from "../navigation/routes";
import { moveMenu, type createMenuPreferences } from "../navigation/menu-preferences";
import { Icon } from "../components/Icon";
/** Visibility and order apply immediately, with native drag and equivalent keyboard buttons. */
export function SettingsNavigation(props: { menu: ReturnType<typeof createMenuPreferences> }) {
  const [dragged, setDragged] = createSignal<Section>(),
    [target, setTarget] = createSignal<Section>();
  const move = (id: Section, delta: number) => {
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
            const item = sections.find((row) => row.id === id)!;
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
                  title={t("Déplacer {0}", t(item.label))}
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
                  <span>{t(item.label)}</span>
                </label>
                <button
                  class="icon-button quiet"
                  disabled={index() === 0}
                  aria-label={t("Monter {0}", t(item.label))}
                  title={t("Monter {0}", t(item.label))}
                  onClick={() => move(id, -1)}
                >
                  <Icon name="chevron-up" />
                </button>
                <button
                  class="icon-button quiet"
                  disabled={index() === props.menu.value().order.length - 1}
                  aria-label={t("Descendre {0}", t(item.label))}
                  title={t("Descendre {0}", t(item.label))}
                  onClick={() => move(id, 1)}
                >
                  <Icon name="chevron-down" />
                </button>
              </li>
            );
          }}
        </For>
      </ol>
      <button onClick={() => props.menu.reset()}>{t("Réinitialiser le menu")}</button>
      <Show when={props.menu.error()}>
        <p role="alert">{props.menu.error()}</p>
      </Show>
    </div>
  );
}
