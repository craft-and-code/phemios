import { Show } from "solid-js";
import { t } from "../i18n";
import type { createMenuPreferences } from "../navigation/menu-preferences";
import { createCollectionMenuSelection } from "../library/collection-menu-selection";
import type { createCollectionMenuChoices } from "../library/collection-menu-choices";
import { ObjectList } from "./ObjectList";
import { Feedback } from "./Feedback";
/** Choosing a private collection adds a presentation shortcut, never a new saved rule. */
export function CollectionMenuPicker(props: {
  menu: ReturnType<typeof createMenuPreferences>;
  choices?: ReturnType<typeof createCollectionMenuChoices> | undefined;
  onCollectionDrag?: (name: string, label: string) => void;
  onCollectionPointerOver?: ((hit: Element | null, y: number) => void) | undefined;
  onCollectionPointerDrop?: ((hit: Element | null, y: number) => void) | undefined;
  onCollectionDragEnd?: () => void;
}) {
  const selected = createCollectionMenuSelection({
    menu: props.menu,
    choices: () => props.choices,
  });
  const available = () => !!props.choices?.identity();
  const tooMany = () => props.menu.value().order.length + selected.selections().length > 96;
  return (
    <section class="collection-menu-picker" aria-label={t("Ajouter une collection au menu")}>
      <h3>{t("Collections")}</h3>
      <p class="muted">
        {t(
          "Sélectionnez une ou plusieurs collections (Maj pour une plage, Ctrl/⌘ pour des lignes séparées), puis ajoutez-les au menu. Réorganisez cette liste par glisser-déposer ou Alt+flèches, ou glissez une collection dans les menus.",
        )}
      </p>
      <Show
        when={available()}
        fallback={
          <p class="muted">
            {t("Connectez-vous à une bibliothèque Aède pour ajouter vos collections au menu.")}
          </p>
        }
      >
        <ObjectList
          label={t("Collections disponibles")}
          items={selected.rows().map((row) => row.id)}
          selected={selected.selection()}
          selectedItems={selected.selections()}
          onSelect={selected.select}
          onSelectMany={selected.selectMany}
          onReorder={selected.reorder}
          itemLabel={(id) => props.choices?.rows().find((row) => row.id === id)?.name ?? id}
          identity={props.choices?.identity()}
          disabled={props.choices?.loading()}
          busy={props.choices?.loading()}
          onActivate={() => {
            selected.add();
          }}
          onDragStart={(id) => {
            const row = props.choices?.rows().find((row) => row.id === id);
            if (row) props.onCollectionDrag?.(row.name, "");
          }}
          onPointerOver={props.onCollectionPointerOver}
          onPointerDrop={props.onCollectionPointerDrop}
          onDragEnd={() => props.onCollectionDragEnd?.()}
          empty={
            props.choices?.error()
              ? t("Liste indisponible.")
              : props.choices?.loading()
                ? t("Lecture des collections…")
                : t("Créez d’abord une collection depuis vos filtres ou la rubrique Collections.")
          }
        />
        <form
          class="collection-menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            selected.add();
          }}
        >
          <div class="settings-actions">
            <button
              class="primary"
              disabled={!selected.selections().length || props.choices?.loading() || tooMany()}
            >
              {selected.selections().length > 1
                ? t("Ajouter les {0} collections au menu", String(selected.selections().length))
                : t("Ajouter au menu")}
            </button>
            <Show when={props.choices?.error()}>
              <button
                type="button"
                class="quiet"
                disabled={!!props.choices?.loading()}
                onClick={() => void props.choices?.refresh()}
              >
                {t("Réessayer")}
              </button>
            </Show>
          </div>
        </form>
        <Show when={tooMany()}>
          <p class="muted">
            {t("La sélection dépasse la limite de 96 menus. Sélectionnez moins de collections.")}
          </p>
        </Show>
      </Show>
      <Feedback error message={props.choices?.error() ?? ""} />
    </section>
  );
}
